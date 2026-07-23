"""Marketing agent built on LangGraph + Gemini."""

from .agent import SYSTEM_PROMPT, build_agent
from .providers_loader import Provider, list_providers
from .skills_loader import Skill, list_skills

# `agent` is intentionally not imported eagerly here: it is a lazily-built
# singleton in .agent (see agent.__getattr__) so importing the package does not
# require GEMINI_API_KEY.

__all__ = ["build_agent", "agent", "SYSTEM_PROMPT", "Provider", "Skill", "list_providers", "list_skills"]


def __getattr__(name: str):  # PEP 562
    if name == "agent":
        from .agent import agent as _agent

        return _agent
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
