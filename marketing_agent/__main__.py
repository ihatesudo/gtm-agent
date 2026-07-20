"""CLI entry point: interactive REPL + streamed thinking, toggleable at any time.

Usage:
    # Single task (args joined), thinking stream on by default
    uv run python -m marketing_agent "Write 3 versions of Xiaohongshu copy for an AI note-taking app"

    # Disable the thinking stream (only stream the final answer + tool calls)
    uv run python -m marketing_agent --no-thinking "Write a cold-outreach email"

    # Run with a specific skill playbook driving the session
    uv run python -m marketing_agent --skill copywriting "3 hero headlines for a notes app"

    # Run as a specific specialist role (Director base + role persona)
    uv run python -m marketing_agent --role seo "技术 SEO 审计要点"

    # Combine a role with a skill
    uv run python -m marketing_agent --role paid-search --skill ads "ROAS 目标怎么设"

    # Interactive REPL (no args); toggle thinking or pick a skill/role mid-session
    uv run python -m marketing_agent

REPL commands:
    /think        toggle the thinking stream (on <-> off)
    /think-on     turn the thinking stream on
    /think-off    turn the thinking stream off
    /roles        show the role menu (read-only)
    /role         pick / switch the active specialist role
    /role-off     clear the active role (Director base)
    /skills       show the skill menu (read-only)
    /skill        pick / switch the active skill playbook
    /skill-off    clear the active skill (general agent)
    /help         help
    /quit         quit
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from langchain_core.messages import HumanMessage

from . import roles_loader, skills_loader
from .agent import build_agent

# ANSI styling (enabled only on a TTY and when NO_COLOR is unset).
_DIM = "\033[2;3m"
_RESET = "\033[0m"
_BOLD = "\033[1m"
_CYAN = "\033[36m"


def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _iter_blocks(chunk) -> list[tuple[str, str]]:
    """Split a streaming chunk into (type, text) pairs.

    The type is "thinking" (the model's reasoning) or "text" (the formal answer).
    A Gemini thinking block's content is a list whose dict elements have type
    "thinking"/"reasoning"; a normal answer has type "text" or is a plain string.
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
    """Stream output token by token via astream_events(v2).

    - Thinking stream on: the model's reasoning streams live in dim/italic (💭),
      followed by the formal answer (🤖).
    - Thinking stream off: thinking blocks are skipped; only the final answer and
      tool-call progress stream live.
    Tool calls are always shown (🔧 calls / ↳ returns).
    """
    so = sys.stdout
    # role: the type of segment currently being written — used to print prefixes
    # and switch ANSI styles on demand.
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
            so.write(f"\n🔧 call tool {name}({tool_input})\n")
            so.flush()

        elif kind == "on_tool_end":
            close_think()
            raw = str(ev["data"].get("output", ""))
            preview = raw if len(raw) <= 200 else raw[:200] + " …"
            so.write(f"   ↳ returned: {preview}\n")
            so.flush()

    close_think()
    so.write("\n")
    so.flush()


def run_once(
    user_input: str,
    show_thinking: bool,
    color: bool,
    skill: str | None = None,
    role: str | None = None,
    language: str = "zh",
) -> None:
    """Run one task: build the agent per the current toggle and stream the output.

    ``skill`` is the optional active skill playbook name; ``role`` is the optional
    specialist seat. Both are re-resolved each call so switching mid-session takes
    effect on the next task.
    """
    agent = build_agent(include_thoughts=show_thinking, skill=skill, role=role, language=language)
    so = sys.stdout
    tags = []
    if role:
        tags.append(f"role: {role}")
    if skill:
        tags.append(f"skill: {skill}")
    label = f" ({', '.join(tags)})" if tags else ""
    so.write(f"\n🤖 agent starting{label}...\n")
    so.flush()
    asyncio.run(_stream_run(agent, user_input, show_thinking, color))


def _print_thinking_status(show: bool) -> None:
    print(f"  → streamed thinking {'on 💭' if show else 'off'}\n")


# ---------------------------------------------------------------------------
# Skill menu
# ---------------------------------------------------------------------------

def _render_skill_menu(color: bool) -> list[str]:
    """Print the categorized skill menu and return the ordered list of skill names."""
    skills = skills_loader.list_skills()
    if not skills:
        print("  (no skills installed — expected a top-level skills/ folder)\n")
        return []
    names: list[str] = []
    for cat, members in skills_loader.categorize(skills):
        header = cat if not color else f"{_CYAN}{_BOLD}{cat}{_RESET}"
        print(f"\n  {header}")
        for s in members:
            names.append(s.name)
            idx = len(names)
            desc = skills_loader.short_description(s.description, width=70)
            line = f"    {idx:>2}. {s.name}"
            if color:
                line = f"    {idx:>2}. {_BOLD}{s.name}{_RESET}"
            print(f"{line}  — {desc}" if desc else line)
    print("")
    return names


def print_skill_menu(color: bool) -> None:
    """Show the menu with a header and count."""
    skills = skills_loader.list_skills()
    print(f"\n📚 {len(skills)} marketing skills available:\n")
    _render_skill_menu(color)
    print("  Use /skill <name|number> to activate, or /skill to pick interactively.\n")


def pick_skill(color: bool) -> str | None:
    """Show the menu and prompt for a choice. Returns a skill name or None."""
    names = _render_skill_menu(color)
    if not names:
        return None
    try:
        choice = input("  Activate skill (number or name, Enter=none, q=cancel) > ").strip()
    except (EOFError, KeyboardInterrupt):
        print("")
        return None
    if not choice or choice.lower() in ("q", "quit", "cancel"):
        return None
    # Numeric choice
    if choice.isdigit():
        i = int(choice)
        if 1 <= i <= len(names):
            return names[i - 1]
        print(f"  number out of range (1–{len(names)}); no skill selected.\n")
        return None
    found = skills_loader.find_skill(choice)
    if found is None:
        print(f"  unknown skill: {choice!r}  (try /skills to list, or use a unique prefix)\n")
        return None
    return found.name


def _print_skill_status(skill: str | None) -> None:
    if skill:
        print(f"  → active skill: {skill} 📚\n")
    else:
        print("  → active skill: none (general agent)\n")


# ---------------------------------------------------------------------------
# Role menu
# ---------------------------------------------------------------------------

def _render_role_menu(color: bool) -> list[str]:
    """Print the role menu and return the ordered list of role names."""
    roles = roles_loader.list_roles()
    if not roles:
        print("  (no roles installed — expected a top-level roles/ folder)\n")
        return []
    names: list[str] = []
    print("")
    for r in roles:
        names.append(r.name)
        idx = len(names)
        line = f"    {idx:>2}. {r.name}"
        if color:
            line = f"    {idx:>2}. {_BOLD}{r.name}{_RESET}"
        title = r.title or r.name
        print(f"{line}  — {title}")
    print("")
    return names


def print_role_menu(color: bool) -> None:
    """Show the role menu with a header and count."""
    roles = roles_loader.list_roles()
    print(f"\n👥 {len(roles)} marketing roles available:\n")
    _render_role_menu(color)
    print("  Use /role <name|number> to switch, or /role to pick interactively.\n")


def pick_role(color: bool) -> str | None:
    """Show the menu and prompt for a choice. Returns a role name or None."""
    names = _render_role_menu(color)
    if not names:
        return None
    try:
        choice = input("  Activate role (number or name, Enter=none, q=cancel) > ").strip()
    except (EOFError, KeyboardInterrupt):
        print("")
        return None
    if not choice or choice.lower() in ("q", "quit", "cancel"):
        return None
    if choice.isdigit():
        i = int(choice)
        if 1 <= i <= len(names):
            return names[i - 1]
        print(f"  number out of range (1–{len(names)}); no role selected.\n")
        return None
    found = roles_loader.find_role(choice)
    if found is None:
        print(f"  unknown role: {choice!r}  (try /roles to list)\n")
        return None
    return found.name


def _print_role_status(role: str | None) -> None:
    if role:
        print(f"  → active role: {role} 👥\n")
    else:
        print("  → active role: none (Director base)\n")


def _prompt_prefix(skill: str | None, role: str | None) -> str:
    tags = []
    if role:
        tags.append(f"role:{role}")
    if skill:
        tags.append(f"skill:{skill}")
    if tags:
        return f"📝 [{' · '.join(tags)}] > "
    return "📝 > "


# ---------------------------------------------------------------------------
# REPL
# ---------------------------------------------------------------------------

def repl(
    default_thinking: bool,
    color: bool,
    default_skill: str | None = None,
    default_role: str | None = None,
) -> None:
    show = default_thinking
    skill = default_skill
    role = default_role
    print("Marketing agent interactive mode. Type a task and press Enter; Ctrl-D/Ctrl-C to exit.")
    status = f"  streamed thinking: {'on' if show else 'off'}   "
    status += f"active role: {role or 'none'}   "
    status += f"active skill: {skill or 'none'}   "
    status += "(/roles · /role · /skills · /skill · /think · /help)\n"
    print(status)
    while True:
        try:
            line = input(_prompt_prefix(skill, role)).strip()
        except (EOFError, KeyboardInterrupt):
            print("\nbye 👋")
            break
        if not line:
            continue

        if line.startswith("/"):
            cmd, _, arg = line.partition(" ")
            cmd = cmd.lower()
            if cmd in ("/think", "/thinking"):
                show = not show
                _print_thinking_status(show)
            elif cmd == "/think-on":
                show = True
                _print_thinking_status(show)
            elif cmd == "/think-off":
                show = False
                _print_thinking_status(show)
            elif cmd == "/roles":
                print_role_menu(color)
            elif cmd == "/role":
                picked = arg.strip() or None
                if picked:
                    if picked.isdigit():
                        names = [r.name for r in roles_loader.list_roles()]
                        i = int(picked)
                        picked_name = names[i - 1] if 1 <= i <= len(names) else None
                    else:
                        found = roles_loader.find_role(picked)
                        picked_name = found.name if found else None
                    role = picked_name
                    _print_role_status(role)
                    if role is None:
                        print("  unknown role; active role unchanged or cleared.\n")
                else:
                    role = pick_role(color)
                    _print_role_status(role)
            elif cmd == "/role-off":
                role = None
                _print_role_status(role)
            elif cmd == "/skills":
                print_skill_menu(color)
            elif cmd == "/skill":
                picked = arg.strip() or None
                if picked:
                    # Inline argument: resolve directly.
                    if picked.isdigit():
                        names = [s.name for s in skills_loader.list_skills()]
                        i = int(picked)
                        picked_name = names[i - 1] if 1 <= i <= len(names) else None
                    else:
                        found = skills_loader.find_skill(picked)
                        picked_name = found.name if found else None
                    skill = picked_name
                    _print_skill_status(skill)
                    if skill is None:
                        print("  unknown skill; active skill unchanged or cleared.\n")
                else:
                    skill = pick_skill(color)
                    _print_skill_status(skill)
            elif cmd == "/skill-off":
                skill = None
                _print_skill_status(skill)
            elif cmd in ("/help", "/?"):
                print(
                    "  /roles list roles · /role [name|n] pick/switch · /role-off clear\n"
                    "  /skills list skills · /skill [name|n] pick/switch · /skill-off clear\n"
                    "  /think toggle · /think-on · /think-off · /quit to exit\n"
                )
            elif cmd in ("/quit", "/exit"):
                print("bye 👋")
                break
            else:
                print(f"  unknown command: {line}  (try /help)\n")
            continue

        run_once(line, show, color, skill, role)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="marketing_agent",
        description="Marketing agent (streamed output, thinking toggleable, skill playbooks)",
    )
    parser.add_argument(
        "task",
        nargs="*",
        help="Task text; if omitted, enters the interactive REPL",
    )
    parser.add_argument(
        "--skill",
        dest="skill",
        default=None,
        metavar="NAME",
        help="Activate a skill playbook by name (e.g. copywriting). Use --list-skills to see all.",
    )
    parser.add_argument(
        "--list-skills",
        dest="list_skills",
        action="store_true",
        help="Print the skill menu and exit.",
    )
    parser.add_argument(
        "--role",
        dest="role",
        default=None,
        metavar="NAME",
        help="Switch to a specialist role by name (e.g. seo, paid-search). Use --list-roles to see all.",
    )
    parser.add_argument(
        "--language",
        choices=("zh", "en"),
        default="zh",
        help="Response and system-prompt language (default: zh).",
    )
    parser.add_argument(
        "--list-roles",
        dest="list_roles",
        action="store_true",
        help="Print the role menu and exit.",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--thinking",
        dest="thinking",
        action="store_true",
        help="Turn the thinking stream on (default)",
    )
    group.add_argument(
        "--no-thinking",
        dest="thinking",
        action="store_false",
        help="Turn the thinking stream off; only stream the final answer",
    )
    parser.set_defaults(thinking=None)
    args = parser.parse_args()

    color = _supports_color()

    if args.list_roles:
        print_role_menu(color)
        return

    if args.list_skills:
        print_skill_menu(color)
        return

    # Validate --role up front so a typo fails fast with a clear message.
    role = None
    if args.role:
        found = roles_loader.find_role(args.role)
        if found is None:
            print(f"error: unknown role {args.role!r}. Run with --list-roles to see options.")
            sys.exit(2)
        role = found.name

    # Validate --skill up front so a typo fails fast with a clear message.
    skill = None
    if args.skill:
        found = skills_loader.find_skill(args.skill)
        if found is None:
            print(f"error: unknown skill {args.skill!r}. Run with --list-skills to see options.")
            sys.exit(2)
        skill = found.name

    show_thinking = True if args.thinking is None else args.thinking

    if args.task:
        run_once(" ".join(args.task), show_thinking, color, skill, role, args.language)
    else:
        repl(show_thinking, color, default_skill=skill, default_role=role)


if __name__ == "__main__":
    main()
