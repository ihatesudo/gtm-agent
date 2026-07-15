"""LangGraph-based marketing agent.

High-level approach: langgraph.prebuilt.create_react_agent (provides a built-in
ReAct loop, tool calling, and message-state management). The underlying model is
ChatGoogleGenerativeAI (gemini-3.5-flash, reusing GEMINI_API_KEY from the
environment), wired up with the real tools defined in marketing_agent.tools.
"""

from __future__ import annotations

import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from .tools import ALL_TOOLS

SYSTEM_PROMPT = """你是一名资深增长营销官（Head of Growth），拥有十年以上品牌、内容、投放与 SEO 经验。
你能胜任以下四类任务，按用户需求选择最合适的方式：

1. 文案生成（Copywriting）
   - 广告语、落地页文案、社媒贴文、邮件标题/正文、产品描述。
   - 给出多个版本（如 3 版）并标注语气/受众差异，必要时用 save_asset 存成 .md。

2. 策略与策划（Strategy）
   - 给定产品/受众，产出营销策略、内容日历、渠道优先级、预算分配建议、KPI。
   - 结构化输出（目标 → 受众洞察 → 信息屋 → 渠道 → 指标）。

3. 竞品 / 市场调研（Research）
   - 需要实时或事实信息时，**必须先调用 web_search** 再下结论，不要凭空编造数据。
   - 产出竞品对比、市场格局、差异化机会。

4. SEO / 关键词
   - 关键词挖掘、内容选题、页面 SEO 结构、内链/外链建议。
   - 如需热门词验证，用 web_search 取材。

通用原则：
- 涉及实时信息（价格、新闻、竞品动态、热度）一律先 web_search。
- 长篇/最终交付物用 save_asset 落盘，文件名用语义化的 kebab-case + .md。
- 用中文回答，保持专业、具体、可执行；避免空话套话。
"""


def build_model(include_thoughts: bool = True) -> ChatGoogleGenerativeAI:
    """Build the Gemini chat model. Reuses the GEMINI_API_KEY env var.

    When include_thoughts=True the model emits a human-readable reasoning
    (thinking) trace; combined with the CLI's streaming output you can watch
    the thinking tokens appear one by one. When disabled, the model no longer
    returns thinking blocks and only outputs the final answer.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is missing. Run `source env.sh` first."
        )
    return ChatGoogleGenerativeAI(
        model="gemini-3.5-flash",
        temperature=0.7,  # marketing benefits from a bit of creativity
        google_api_key=api_key,
        include_thoughts=include_thoughts,  # Gemini 3+ thinking-summary toggle
    )


def build_agent(include_thoughts: bool = True):
    """Build and return the compiled LangGraph ReAct agent.

    include_thoughts controls whether the underlying model returns its thinking
    process. To toggle it, just rebuild the agent — no need to restart the
    process.
    """
    return create_react_agent(
        model=build_model(include_thoughts=include_thoughts),
        tools=ALL_TOOLS,
        prompt=SYSTEM_PROMPT,
    )


# Singleton (thinking on by default) for convenient reuse via `python -m marketing_agent`
agent = build_agent(include_thoughts=True)
