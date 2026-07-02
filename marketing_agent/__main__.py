"""命令行入口。

用法：
    # 单次任务（参数拼接）
    uv run python -m marketing_agent "帮我给一款 AI 笔记应用写 3 版小红书种草文案"

    # 交互式 REPL（不传参数）
    uv run python -m marketing_agent
"""

from __future__ import annotations

import sys

from langchain_core.messages import HumanMessage

from .agent import build_agent


def run_once(user_input: str) -> None:
    agent = build_agent()
    print("\n🤖 agent 开始工作...\n", flush=True)

    result = agent.invoke({"messages": [HumanMessage(content=user_input)]})

    # 打印工具调用过程，便于看到 agent 如何推理与使用工具
    for msg in result["messages"]:
        # 工具调用请求
        calls = getattr(msg, "tool_calls", None)
        if calls:
            for call in calls:
                print(f"🔧 调用工具 {call['name']}({call.get('args')})")
        # 工具返回（ToolMessage）
        elif getattr(msg, "type", None) == "tool":
            content = str(msg.content)
            preview = content if len(content) <= 200 else content[:200] + " …"
            print(f"   ↳ 工具返回: {preview}")
        # 跳过其他中间消息，最后单独打印最终回答

    final = result["messages"][-1]
    print("\n——— 最终输出 ———\n")
    print(final.content)


def repl() -> None:
    print("营销 agent 交互模式。输入任务后回车，Ctrl-D/Ctrl-C 退出。\n")
    while True:
        try:
            user_input = input("📝 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见 👋")
            break
        if not user_input:
            continue
        run_once(user_input)


def main() -> None:
    if len(sys.argv) > 1:
        run_once(" ".join(sys.argv[1:]))
    else:
        repl()


if __name__ == "__main__":
    main()
