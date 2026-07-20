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

SYSTEM_PROMPT = """你是这家公司的增长负责人（Marketing Director / Head of Growth），手下带一支六人专家小队：搜索投放（Paid Search/SEM）、社交效果广告（Social Ads）、技术与内容 SEO、B2B 与 LinkedIn、生命周期与留存（Email/CRM），外加你这个统筹全局的指挥官。你不亲自下场做完每一件事——你的价值在判断与调度。

## 你的团队（可按需切换 --role 深度执行）

- **paid-search（搜索投放）**：Google Ads/SEM、关键词与否定词、出价、ROAS/CPA、落地页转化。#GoogleAds #PPC #SEM #ROAS #CRO
- **social-ads（社交效果广告）**：Meta/TikTok 付费获客、人群与 lookalike、再营销、素材 brief。#PaidSocial #MetaAds #TikTokAds #CAC #LookalikeAudiences
- **seo（技术与内容 SEO）**：技术审计、关键词意图、内容缺口、内链/外链、schema、Core Web Vitals、AI 搜索/AEO。#TechnicalSEO #SearchIntent #Ahrefs #SearchConsole
- **b2b-linkedin（B2B/LinkedIn）**：ABM、目标账户、Lead Gen Forms、思想领导力、销售赋能、冷邮件。#AccountBasedMarketing #LinkedInCampaignManager #ThoughtLeadership
- **lifecycle-retention（生命周期/留存）**：邮件/SMS 序列、欢迎流、分群、流失预防、LTV。#CRM #EmailMarketing #MarketingAutomation #CustomerLifetimeValue
- **growth-lead（你自己）**：整体策略、预算分配、归因、KPI 对齐、增长闭环。#MarketingStrategy #BudgetAllocation #MultiTouchAttribution

## 工作方式

1. **先判断任务归属**：属于哪个渠道/职能？需要深度执行时，建议切换到对应 `--role`，或激活相关 skill playbook（`/skills` 查看 47 个技能）。
2. **能答就直接答**：作为统筹者，你可以直接以对应专家的口吻给出专业、具体、可执行的回答。
3. **跨渠道问题自己拍板**：预算分配、渠道优先级、定位/产品营销、定价/offer、新品上市、增长闭环——这些是你的主场。

通用原则：
- 涉及实时信息（价格、新闻、竞品动态、热度）**一律先 web_search**，不要凭空编造数据。
- 长篇/最终交付物用 save_asset 落盘，文件名用语义化的 kebab-case + .md。
- 需要平台 how-to（如 google-ads、klaviyo）时用 read_tool_guide 按需拉取集成指南。
- 用中文回答，保持专业、具体、可执行；避免空话套话。给建议永远落到"下一步做什么"。
"""


def build_model(include_thoughts: bool = True) -> ChatGoogleGenerativeAI:
    """Build the Gemini chat model.

    Two auth backends, selected by the ``GENAI_PROVIDER`` env var (or the
    ``GOOGLE_GENAI_USE_VERTEXAI`` flag):

    - ``vertex`` (default here): Google Cloud Vertex AI. Authenticates via
      Application Default Credentials (e.g. ``gcloud auth application-default
      login``) — no API key needed. Requires ``GOOGLE_CLOUD_PROJECT`` and uses
      ``GOOGLE_CLOUD_LOCATION`` (default ``us-central1``).
    - ``api``: Gemini Developer API (Generative Language API). Authenticates
      with the ``GEMINI_API_KEY`` env var.

    When include_thoughts=True the model emits a human-readable reasoning
    (thinking) trace; combined with the CLI's streaming output you can watch
    the thinking tokens appear one by one. When disabled, the model no longer
    returns thinking blocks and only outputs the final answer.
    """
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    provider = os.environ.get("GENAI_PROVIDER", "").strip().lower()
    use_vertex = provider == "vertex" or os.environ.get(
        "GOOGLE_GENAI_USE_VERTEXAI", ""
    ).strip().lower() == "true"

    common = dict(
        model=model,
        temperature=0.7,  # marketing benefits from a bit of creativity
        include_thoughts=include_thoughts,  # show reasoning trace when on
    )

    if use_vertex:
        # Vertex uses ADC; the project/location are read by the google-genai SDK
        # from the env vars below.
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "us-central1")
        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        if not project:
            raise RuntimeError(
                "Vertex mode needs GOOGLE_CLOUD_PROJECT. Set it in .env "
                "(your GCP project id)."
            )
        return ChatGoogleGenerativeAI(**common)

    # Developer API path: needs a valid API key.
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing and GENAI_PROVIDER is not 'vertex'. "
            "Either set a valid Gemini API key, or use Vertex "
            "(GENAI_PROVIDER=vertex with ADC). See .env."
        )
    return ChatGoogleGenerativeAI(google_api_key=api_key, **common)


def build_agent(
    include_thoughts: bool = True, skill: str | None = None, role: str | None = None
):
    """Build and return the compiled LangGraph ReAct agent.

    include_thoughts controls whether the underlying model returns its thinking
    process. To toggle it, just rebuild the agent — no need to restart the
    process.

    ``role`` optionally selects one of the six specialist seats (see roles/). The
    Director persona in SYSTEM_PROMPT is always the base; an active role's persona
    is appended to narrow the session to that channel's expertise.

    ``skill`` optionally activates a marketing skill playbook (from skills/),
    appended after the role block. Pass ``None`` for the general Director agent.
    """
    prompt = _compose_prompt(skill=skill, role=role)
    return create_react_agent(
        model=build_model(include_thoughts=include_thoughts),
        tools=ALL_TOOLS,
        prompt=prompt,
    )


def _compose_prompt(skill: str | None, role: str | None = None) -> str:
    """Return the system prompt: Director base + (optional) role + (optional) skill."""
    prompt = SYSTEM_PROMPT

    if role:
        from . import roles_loader

        found = roles_loader.find_role(role)
        if found is not None:
            prompt += (
                "\n\n本次会话你切换为下面的专家角色，以其人设与专长驱动回答"
                "（仍遵守上面的通用原则）：\n\n"
                + roles_loader.render_role_block(found)
            )

    if skill:
        from . import skills_loader

        found = skills_loader.find_skill(skill)
        if found is not None:
            body = skills_loader.load_skill_body(found.name)
            prompt += (
                f"\n\n## Active skill playbook: {found.name}\n\n"
                + "Follow this playbook for the current task. When it links to a file "
                "under references/, use the read_skill_reference tool to pull it in. "
                "Stay within this playbook's expertise.\n\n"
                + body
            )

    return prompt


# Singleton (thinking on by default) for convenient reuse via
# `python -m marketing_agent`. Built lazily on first access so that simply
# importing the package (e.g. for --list-skills) does not require GEMINI_API_KEY.
def __getattr__(name: str):  # PEP 562
    if name == "agent":
        built = build_agent(include_thoughts=True)
        globals()["agent"] = built
        return built
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
