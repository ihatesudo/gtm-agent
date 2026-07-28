"""LangGraph-based marketing agent.

Supports multiple LLM providers via the ``provider`` parameter.
Gemini is the default; OpenAI-compatible providers (DeepSeek, GLM, etc.)
use ``ChatOpenAI`` with a provider-specific base URL and API key.

Provider selection mirrors Mastra's model.ts: ``pickProvider`` checks for a
Vertex service account → Vertex AI (GCP trial credits); otherwise → OpenRouter
free tier. No ADC, no AI Studio / Express API keys.
"""

from __future__ import annotations

import json
import os
import tempfile

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from .tools import ALL_TOOLS

SYSTEM_PROMPT_ZH = """你是这家公司的增长负责人（Marketing Director / Head of Growth），手下带一支六人专家小队：搜索投放（Paid Search/SEM）、社交效果广告（Social Ads）、技术与内容 SEO、B2B 与 LinkedIn、生命周期与留存（Email/CRM），外加你这个统筹全局的指挥官。你不亲自下场做完每一件事——你的价值在判断与调度。

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

SYSTEM_PROMPT_EN = """You are this company's Marketing Director / Head of Growth. You lead a six-person specialist team: Paid Search/SEM, Social Ads, Technical & Content SEO, B2B & LinkedIn, Lifecycle & Retention, plus you as the cross-functional leader. You do not need to personally execute every task: your value is judgment, prioritisation, and routing work to the right expert.

## Your team (switch with --role for deep execution)

- **paid-search**: Google Ads/SEM, keywords and negatives, bidding, ROAS/CPA, and landing-page conversion.
- **social-ads**: Meta/TikTok paid acquisition, audiences and lookalikes, retargeting, and creative briefs.
- **seo**: Technical SEO, search intent, content gaps, internal/external links, schema, Core Web Vitals, and AI search/AEO.
- **b2b-linkedin**: ABM, target accounts, Lead Gen Forms, thought leadership, sales enablement, and cold email.
- **lifecycle-retention**: Email/SMS sequences, onboarding, segmentation, churn prevention, and LTV.
- **growth-lead**: Full-funnel strategy, budget allocation, attribution, KPI alignment, and growth loops.

## How to work

1. First identify the owning channel or function. For deep execution, recommend the relevant `--role` or a skill playbook (`/skills` lists them).
2. Answer directly whenever possible, in the voice and depth of the relevant specialist.
3. Make cross-channel decisions yourself: budgets, channel priorities, positioning, product marketing, pricing, offers, launches, and growth loops are your home turf.

General principles:
- For time-sensitive facts—prices, news, competitor moves, popularity—use `web_search` first. Do not invent data.
- Save long-form or final deliverables using `save_asset`; use descriptive kebab-case `.md` filenames.
- When platform setup detail is required, use `read_tool_guide` to load the relevant integration guide.
- Reply in clear, professional, actionable English only. Avoid filler. Every recommendation should end with a concrete next step.
"""

# Kept as the backwards-compatible default for the existing Chinese-first CLI.
SYSTEM_PROMPT = SYSTEM_PROMPT_ZH


# ─── Vertex SA resolution (port of Mastra model.ts resolveVertexCredentials) ┤


def _resolve_vertex_credentials() -> str | None:
    """Resolve Vertex service-account credentials from env.

    Returns the path to a SA JSON file (possibly a temp file for inline JSON),
    or None when no valid credential is found.  Mutates
    ``GOOGLE_APPLICATION_CREDENTIALS`` so that ``google.auth.default()`` can
    read it (Python's SDK expects a file path, not inline JSON).

    Accepts three shapes, matching Mastra's ``resolveVertexCredentials``:
      1. Inline SA JSON  → written to a temp file
      2. File path        → used as-is
      3. Separate fields  → ``GOOGLE_CLIENT_EMAIL`` + ``GOOGLE_PRIVATE_KEY``
    """
    raw = (os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    if not raw:
        return None

    # 1. Inline SA JSON (Cloudflare deploy shape — works in Node, needs temp
    #    file for Python's google.auth).
    if raw.startswith("{"):
        try:
            parsed = json.loads(raw)
            if not parsed.get("client_email") or not parsed.get("private_key"):
                return None
            tmp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            )
            json.dump(parsed, tmp)
            tmp.flush()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            return tmp.name
        except (json.JSONDecodeError, KeyError, OSError):
            return None

    # 2. File path (local-dev convenience).
    if os.path.isfile(raw):
        return raw

    return None


# ─── Provider picker (port of Mastra model.ts pickProvider) ┤


def _pick_provider() -> str:
    """Pick the default provider — port of Mastra's ``pickProvider``.

    1. ``GENAI_PROVIDER`` explicitly set → respect it.
    2. Service account JSON/fields present → ``vertex`` (burn GCP trial credits).
    3. Otherwise → ``openrouter`` (free-tier fallback).

    No ADC, no AI Studio / Express API keys.
    """
    explicit = os.environ.get("GENAI_PROVIDER", "").strip().lower()
    if explicit in ("vertex", "openrouter", "gemini"):
        return explicit
    if explicit:
        # Any other value (deepseek, glm, etc.) — pass through
        return explicit
    return "vertex" if _resolve_vertex_credentials() else "openrouter"


# ─── Model factories ┤


def _build_gemini(include_thoughts: bool) -> ChatGoogleGenerativeAI:
    """Build Gemini — Vertex AI via SA, or API key fallback.  No ADC."""
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    common = dict(model=model, temperature=0.7, include_thoughts=include_thoughts)

    # Vertex via service account (burns GCP trial credits).
    sa_path = _resolve_vertex_credentials()
    if sa_path:
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "us-central1")
        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        if project:
            return ChatGoogleGenerativeAI(**common)

    # API key fallback.
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        return ChatGoogleGenerativeAI(google_api_key=api_key, **common)

    raise RuntimeError(
        "No Gemini model available. "
        "Set up Vertex AI by putting a service account JSON in "
        "GOOGLE_APPLICATION_CREDENTIALS (inline or file path), "
        "or set GEMINI_API_KEY in .env."
    )


def _build_openai_compatible(config_name: str) -> ChatOpenAI:
    """Build ChatOpenAI for a provider config (OpenRouter, DeepSeek, GLM, etc.)."""
    from . import providers_loader

    config = providers_loader.load_provider(config_name)
    api_key = os.environ.get(config.api_key_env)
    if not api_key:
        raise RuntimeError(
            f"{config.api_key_env} is required for provider {config.name!r}. "
            f"Set it in your environment."
        )
    return ChatOpenAI(
        model=config.model,
        openai_api_base=config.base_url,
        openai_api_key=api_key,
        temperature=0.7,
    )


def build_model(include_thoughts: bool = True, provider: str | None = None):
    """Build a chat model for the given provider.

    - ``provider=None`` or ``"auto"`` → dynamic ``_pick_provider()`` (Vertex SA
      if available, else OpenRouter).
    - ``"vertex"/"gemini"`` → Gemini via SA or API key.
    - Any other provider name → looked up in ``providers/`` and built via
      ``ChatOpenAI``.

    When *provider* is unspecified, the ``PROVIDER`` env var is read as the
    default (falls back to dynamic pick).
    """
    if provider is None:
        provider = (
            os.environ.get("PROVIDER")
            or os.environ.get("GENAI_PROVIDER")
            or "auto"
        ).strip().lower()
    if provider in (None, "", "auto"):
        provider = _pick_provider()
    if provider in ("vertex", "gemini"):
        return _build_gemini(include_thoughts=include_thoughts)
    return _build_openai_compatible(provider)


def build_agent(
    include_thoughts: bool = True,
    skill: str | None = None,
    role: str | None = None,
    language: str = "en",
    provider: str | None = None,
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

    ``provider`` optionally selects an LLM provider (from providers/). When
    ``None``, the ``PROVIDER`` env var is read (falls back to ``"gemini"``).
    """
    prompt = _compose_prompt(skill=skill, role=role, language=language)
    return create_react_agent(
        model=build_model(include_thoughts=include_thoughts, provider=provider),
        tools=ALL_TOOLS,
        prompt=prompt,
    )


def _compose_prompt(
    skill: str | None, role: str | None = None, language: str = "en"
) -> str:
    """Return the system prompt: Director base + (optional) role + (optional) skill."""
    is_english = language.lower().startswith("en")
    prompt = SYSTEM_PROMPT_EN if is_english else SYSTEM_PROMPT_ZH

    if role:
        from . import roles_loader

        found = roles_loader.find_role(role)
        if found is not None:
            role_intro = (
                "\n\nFor this session, adopt the following specialist role and let its "
                "persona and expertise drive the answer (while still following the "
                "general principles above):\n\n"
                if is_english
                else "\n\n本次会话你切换为下面的专家角色，以其人设与专长驱动回答"
                "（仍遵守上面的通用原则）：\n\n"
            )
            prompt += (
                role_intro
                + roles_loader.render_role_block(found, language="en" if is_english else "zh")
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