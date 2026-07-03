"""命令行入口：交互式 + 流式输出思考，可随时开关。

用法：
    # 单次任务（参数拼接），默认开启思考流
    uv run python -m marketing_agent "帮我给一款 AI 笔记应用写 3 版小红书种草文案"

    # 关闭思考流（只流式输出最终答案 + 工具过程）
    uv run python -m marketing_agent --no-thinking "写一封冷启动邮件"

    # 交互式 REPL（不传参数），可在会话中用 /think 随时切换
    uv run python -m marketing_agent

REPL 命令：
    /think        切换思考流（开↔关）
    /think-on     打开思考流
    /think-off    关闭思考流
    /help         帮助
    /quit         退出
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from langchain_core.messages import HumanMessage

from .agent import build_agent

# ANSI 样式（仅 TTY 且未设置 NO_COLOR 时启用）
_DIM = "\033[2;3m"
_RESET = "\033[0m"


def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _iter_blocks(chunk) -> list[tuple[str, str]]:
    """从一个流式 chunk 里拆出 (类型, 文本) 对。

    类型为 "thinking"（模型推理过程）或 "text"（正式回答）。
    Gemini 的思考块 content 是 list，元素 dict 的 type 为
    "thinking"/"reasoning"；普通回答为 "text" 或纯字符串。
    """
    content = getattr(chunk, "content", "")
    out: list[tuple[str, str]] = []
    if isinstance(content, str):
        if content:
            out.append(("text", content))
        return out
    if isinstance(content, list):
        for block in content:
            if isinstance(block, str):
                if block:
                    out.append(("text", block))
                continue
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype in ("thinking", "reasoning"):
                txt = block.get("thinking") or block.get("reasoning") or ""
                if txt:
                    out.append(("thinking", txt))
            elif btype == "text":
                txt = block.get("text", "")
                if txt:
                    out.append(("text", txt))
    return out


async def _stream_run(agent, user_input: str, show_thinking: bool, color: bool) -> None:
    """通过 astream_events(v2) 逐 token 流式输出。

    - 思考流开启：模型的推理过程以暗色/斜体实时涌出（💭），再接正式回答（🤖）。
    - 思考流关闭：跳过思考块，只实时输出最终答案与工具调用过程。
    工具调用始终展示（🔧 调用 / ↳ 返回）。
    """
    so = sys.stdout
    # role: 当前正在写入的片段类型，用于按需打印前缀、切换 ANSI 样式
    state = {"role": None}

    def close_think() -> None:
        if state["role"] == "think":
            so.write("\n" + (_RESET if color else ""))
            so.flush()
            state["role"] = None

    def open_think() -> None:
        so.write("\n" + (_DIM if color else "") + "💭 ")
        so.flush()
        state["role"] = "think"

    def open_text() -> None:
        so.write("\n🤖 ")
        so.flush()
        state["role"] = "text"

    async for ev in agent.astream_events(
        {"messages": [HumanMessage(content=user_input)]},
        version="v2",
    ):
        kind = ev["event"]

        if kind == "on_chat_model_stream":
            chunk = ev["data"].get("chunk")
            if chunk is None:
                continue
            for btype, txt in _iter_blocks(chunk):
                if btype == "thinking":
                    if not show_thinking:
                        continue
                    if state["role"] != "think":
                        open_think()
                    so.write(txt)
                    so.flush()
                else:  # text
                    if state["role"] != "text":
                        close_think()
                        open_text()
                    so.write(txt)
                    so.flush()

        elif kind == "on_tool_start":
            close_think()
            name = ev.get("name", "")
            tool_input = ev["data"].get("input", "")
            so.write(f"\n🔧 调用工具 {name}({tool_input})\n")
            so.flush()

        elif kind == "on_tool_end":
            close_think()
            raw = str(ev["data"].get("output", ""))
            preview = raw if len(raw) <= 200 else raw[:200] + " …"
            so.write(f"   ↳ 返回: {preview}\n")
            so.flush()

    close_think()
    so.write("\n")
    so.flush()


def run_once(user_input: str, show_thinking: bool, color: bool) -> None:
    """运行一次任务：按当前开关构造 agent 并流式输出。"""
    agent = build_agent(include_thoughts=show_thinking)
    so = sys.stdout
    so.write("\n🤖 agent 开始工作...\n")
    so.flush()
    asyncio.run(_stream_run(agent, user_input, show_thinking, color))


def _print_thinking_status(show: bool) -> None:
    print(f"  → 流式思考已 {'开启 💭' if show else '关闭'}\n")


def repl(default_thinking: bool, color: bool) -> None:
    show = default_thinking
    print("营销 agent 交互模式。输入任务后回车，Ctrl-D/Ctrl-C 退出。")
    print(
        f"  流式思考: {'开' if show else '关'}   "
        "(/think 切换 · /think-on · /think-off · /help)\n"
    )
    while True:
        try:
            line = input("📝 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见 👋")
            break
        if not line:
            continue

        if line.startswith("/"):
            cmd = line.lower()
            if cmd in ("/think", "/thinking"):
                show = not show
                _print_thinking_status(show)
            elif cmd == "/think-on":
                show = True
                _print_thinking_status(show)
            elif cmd == "/think-off":
                show = False
                _print_thinking_status(show)
            elif cmd in ("/help", "/?"):
                print("  /think 切换思考流  ·  /think-on  ·  /think-off  ·  /quit 退出\n")
            elif cmd in ("/quit", "/exit"):
                print("再见 👋")
                break
            else:
                print(f"  未知命令: {line}  (试试 /help)\n")
            continue

        run_once(line, show, color)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="marketing_agent",
        description="营销 agent（流式输出，可开关思考过程）",
    )
    parser.add_argument(
        "task",
        nargs="*",
        help="任务文本；不提供则进入交互式 REPL",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--thinking",
        dest="thinking",
        action="store_true",
        help="开启思考流（默认）",
    )
    group.add_argument(
        "--no-thinking",
        dest="thinking",
        action="store_false",
        help="关闭思考流，只流式输出最终答案",
    )
    parser.set_defaults(thinking=None)
    args = parser.parse_args()

    show_thinking = True if args.thinking is None else args.thinking
    color = _supports_color()

    if args.task:
        run_once(" ".join(args.task), show_thinking, color)
    else:
        repl(show_thinking, color)


if __name__ == "__main__":
    main()
