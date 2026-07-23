# 多 Provider 支持 — 用户自带密钥

**Date:** 2026-07-23
**Status:** Draft

## Problem Statement

Chinese users cannot access OpenAI or Anthropic due to policy restrictions. The
GTM agent currently only supports Google Gemini (Vertex AI or Developer API),
leaving Chinese users with no option when Gemini is unavailable, too expensive,
or suboptimal for certain tasks. Users have DeepSeek, GLM (Zhipu), MiniMax,
SiliconFlow, and other domestic provider API keys, but cannot use them.

Meanwhile, different Chinese providers have different strengths: DeepSeek
excels at reasoning/thinking, GLM at vision, MiniMax at long context (1M).
Users should be able to pick the right model per conversation.

## Solution

A **provider plugin system** where providers are declared as YAML config files
under `providers/`. Each provider config specifies `base_url`, `model`,
`api_key_env` (which env var holds the key), and a capability registry
(`thinking`, `tools`, `vision`). The user sets API keys in their environment and
selects a provider per conversation via a new `--provider` CLI flag or `/provider`
REPL command.

All OpenAI-compatible providers share the same adapter (just a `base_url` +
`api_key` swap). Provider selection is re-resolved per task (mirrors `--role` /
`--skill`), so switching mid-session takes effect on the next message.

## User Stories

1. As a Chinese user, I want to use my own DeepSeek API key, so that I can run
   the agent without depending on Gemini or OpenAI.
2. As a Chinese user, I want to use my own GLM (Zhipu) API key, so that I can
   leverage GLM's vision and thinking capabilities.
3. As a Chinese user, I want to use my own MiniMax API key, so that I can
   leverage MiniMax M3's 1M context window.
4. As a Chinese user, I want to use my own SiliconFlow API key, so that I can
   access their hosted open-source model lineup.
5. As a user, I want to see which providers are available and what capabilities
   each supports (`--list-providers`), so that I can make an informed choice.
6. As a user, I want to switch the active provider mid-session (`/provider`),
   so that I can use DeepSeek for reasoning tasks and GLM for vision tasks in
   the same session.
7. As a user, I want the active provider to be shown in the prompt prefix, so
   that I always know which model is answering.
8. As a user, I want to fall back to a different provider when the active one
   returns an auth/permission error, so that a stale key does not block work.
9. As an operator, I want to add a new provider by dropping a single YAML file
   into `providers/`, so that adding providers does not require code changes.
10. As an operator, I want each provider to declare its capabilities (thinking,
    tools, vision), so that the UI can show/hide features that the active
    provider supports.

## Implementation Decisions

### Provider config format (YAML, `providers/<name>.yaml`)

```yaml
version: 1
provider:
  name: deepseek
  title: "DeepSeek"
  description: "DeepSeek v4 — strong reasoning/thinking, OpenAI-compatible"
  base_url: "https://api.deepseek.com"
  model: "deepseek-v4-pro"
  api_key_env: "DEEPSEEK_API_KEY"
  capabilities:
    thinking: true
    tools: true
    vision: false
  currency: "CNY"
  website: "https://platform.deepseek.com"
```

Each provider file is self-contained. No code change needed to add a provider.

### Provider loader (`marketing_agent/providers_loader.py`)

New module, parallel to `roles_loader.py` / `skills_loader.py`. Exports:

- `list_providers() -> list[Provider]` — scans `providers/` directory
- `find_provider(name: str) -> Provider | None` — by name or unique prefix
- `load_provider(name: str) -> Provider` — single config parse (the testable seam)

`Provider` is a dataclass:

```python
@dataclass
class Provider:
    name: str
    title: str
    description: str
    base_url: str
    model: str
    api_key_env: str
    capabilities: dict[str, bool]  # {"thinking": True, "tools": True, "vision": False}
    currency: str = "CNY"
    website: str = ""
```

### Model factory change (`marketing_agent/agent.py::build_model`)

`build_model()` gains an optional `provider: str | None` parameter:

- `provider=None` — current behavior (Gemini, Vertex or Developer API)
- `provider="deepseek"` — looks up the provider config, reads `DEEPSEEK_API_KEY`
  from env, builds a `ChatOpenAI` with the provider's `base_url`

The factory selects the LangChain chat class:

| Provider type | LangChain class | Key parameter |
|---|---|---|
| Gemini (default) | `ChatGoogleGenerativeAI` | `google_api_key` |
| OpenAI-compatible | `ChatOpenAI` | `openai_api_key` + `openai_api_base` |

This requires adding `langchain-openai` to dependencies.

### Capability-aware UI

When streaming, the `_iter_blocks` logic for thinking tokens only executes
if the active provider's capabilities include `thinking: true`. Providers
without thinking support skip the thinking-delta parsing entirely.

### Provider selection lifecycle

- `--provider deepseek` on CLI → entire session uses DeepSeek
- `/provider` in REPL → interactive menu, then re-resolved on next task
- Provider is re-resolved per task (mirrors `--role` and `--skill`)
- Default provider: `gemini` (current behavior, no API key config needed if
  using Vertex ADC; if Developer API, `GEMINI_API_KEY` is required)

### First-party provider definitions (shipped in `providers/`)

1. `gemini.yaml` — the built-in default (Vertex ADC or Developer API)
2. `deepseek.yaml` — DeepSeek v4 series
3. `glm.yaml` — Zhipu GLM-5.2 series
4. `minimax.yaml` — MiniMax M3 series (post-MVP, pending thinking-flag
   verification)

Community additions are single-file PRs.

### Key storage

API keys live exclusively in environment variables, declared by each
provider's `api_key_env` field. The loader reads `os.environ.get(config.api_key_env)`
and raises a clear error if the variable is unset. No server-side key storage,
no encrypted config files, no UI for entering keys.

### Dependency changes

- Add `langchain-openai` to `pyproject.toml` (for `ChatOpenAI`)

### CLI additions

- `--provider NAME` — select active provider
- `--list-providers` — print the provider menu and exit
- `PROVIDER` env var — default provider name (defaults to `gemini`)

### REPL additions

- `/providers` — show provider menu (read-only)
- `/provider [name|n]` — pick / switch active provider
- Active provider shown in prompt prefix: `📝 [role:seo · provider:deepseek] >`

## Testing Decisions

### Test seam

The primary test boundary is `load_provider(name)`. It is a pure function:
given a YAML file on disk, return a `Provider` dataclass. No API keys, no
network, no env vars.

### What to test

1. **`providers_loader.load_provider`** — for each YAML file under `providers/`,
   assert the parsed `Provider` has the expected fields. Tests are parameterized
   over all shipped provider files.
2. **`providers_loader.list_providers`** — returns all providers; empty list when
   directory is missing.
3. **`providers_loader.find_provider`** — exact match by name, prefix match,
   case-insensitive match.
4. **`build_model(provider="deepseek")`** — integration test: mock env var,
   assert the returned object is a `ChatOpenAI` with the right `base_url` and
   `model`.

### No testing for

- Actual API calls (not unit-testable without keys; left to manual smoke testing)

### Prior art

This is the first automated test in the repo. Pattern: `pytest` with plain
asserts, no mock framework beyond `monkeypatch` (built into pytest). Tests
live in a new top-level `tests/` directory with minimal `pyproject.toml`
additions (just `pytest` in `[dependency-groups.dev]`).

## Out of Scope

- Auto-failover between providers on error or rate-limit
- Usage dashboards or token counters per provider
- Rate-limit queuing and retry logic
- Per-provider pricing display in the menu
- Multi-provider parallel dispatch (one task → multiple models)
- UI for entering API keys in-app (keys remain env-var-only)
- Provider performance benchmarks or latency comparison

## Further Notes

- The gemini provider is special: it uses `ChatGoogleGenerativeAI` and does not
  require an API key when using Vertex ADC. Its YAML config serves as the
  fallback when no `--provider` is given.
- Provider selection is per-conversation (re-resolved per task), not global.
- MiniMax M3 support is post-MVP — its thinking/reasoning API surface needs
  verification before shipping the config.
