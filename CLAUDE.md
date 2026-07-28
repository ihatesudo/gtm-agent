# CLAUDE.md — project guide for agents

## Goal

Build a **marketing agent** (LangGraph + Gemini) that behaves like a commandable
growth team, not a generic chatbot. The bar: give specific, executable marketing
advice and deliverables — strategy, copy, SEO, ad plans, lifecycle flows — grounded
in real data, not vague platitudes.

## Specialty — the 7-person team

The agent is modeled as **1 Director + 6 specialist roles**. This is the core mental
model; preserve it.

- **Director / Growth Lead** (default base prompt in `marketing_agent/agent.py::SYSTEM_PROMPT`) — orchestrator. Routes work, owns strategy/budget/attribution/positioning.
- Six switchable roles (YAML in `roles/`): `paid-search`, `social-ads`, `seo`, `b2b-linkedin`, `lifecycle-retention`, `growth-lead`.

A role layers that expert's **persona + owned/shared skills + preferred platform
integrations** on top of the Director base. Switch via `--role` (CLI) or `/role`
(REPL). Roles compose with the 47 **skill playbooks** (`skills/`, switched via
`--skill` / `/skill`).

Prompt layering (in `agent._compose_prompt`):
`Director base  →  active role persona  →  active skill playbook`.

## Run it

```bash
make setup && make run            # uv sync + REPL
make ask MSG="..."               # one-shot as Director
make role NAME=seo MSG="..."     # one-shot as a specialist
make role NAME=seo MSG="..." ; make skill NAME=ads MSG="..."   # role + skill
make roles | make skills         # browse menus

Auth: service account JSON inline in `GOOGLE_APPLICATION_CREDENTIALS` (Vertex AI, burns GCP trial credits). No ADC, no API key mode. OpenRouter and GLM also supported — provider picked dynamically from what's in `.env`. Config lives in `.env`.

## Architecture map

- `marketing_agent/agent.py` — ReAct agent (`create_react_agent`), model build, prompt composition.
- `marketing_agent/tools.py` — the 7 callable tools + `ALL_TOOLS`.
- `marketing_agent/roles_loader.py` / `skills_loader.py` — parse & serve roles/skills from disk.
- `roles/` — one YAML per role (kimi-cli style). `roles/TOOLS.md` = full tool inventory.
- `skills/` — 47 marketing skill playbooks (`*/SKILL.md` + optional `references/`).
- `tools/REGISTRY.md` + `tools/integrations/*.md` — ~100 platform integration guides.
- `marketing_agent/__main__.py` — CLI + REPL (`--role`, `--skill`, thinking stream).

## Conventions (follow these)

- **Real-time facts first.** Prices/news/competitor moves/keyword popularity → call `web_search` before asserting. Never fabricate data.
- **Deliverables land on disk.** Long-form final output → `save_asset` to `output/` with a semantic kebab-case `.md` name.
- **Platform how-tos on demand.** Use `read_tool_guide` (e.g. `google-ads.md`) and `read_skill_reference` for deeper playbooks — don't dump them into the prompt unless needed.
- **Respond in Chinese.** Professional, specific, actionable; avoid filler. Always end advice on a concrete next step.
- **Both loaders are dependency-light.** `skills_loader` parses frontmatter by hand (no PyYAML); `roles_loader` uses PyYAML (already a transitive dep, declared in `pyproject.toml`). Keep them I/O-only — no prints/prompts.
- **Bilingual roles.** Each role ships as a **pair**: `roles/<name>.en.yaml` + `roles/<name>.zh.yaml`. English is canonical (always required) and the default; Chinese is opt-in via `--language zh` or the `/lang` REPL command. The loader picks the variant by language with EN fallback, so a missing `.zh.yaml` degrades gracefully to English rather than disappearing. Persona / core_focus / when_to_use text lives in the YAML (in that language); structural labels in `render_role_block` switch language automatically.

## Editing rules

- Adding a role → create **both** `roles/<name>.en.yaml` and `roles/<name>.zh.yaml` (match the schema in `roles/director.en.yaml`); they auto-appear in `--list-roles`. Add it to the team table in `README.md`.
- Adding a skill → `skills/<name>/SKILL.md` with frontmatter (`name`, `description`, `metadata.version`); optionally map it into a role's `owned_skills`/`shared_skills`.
- Adding a callable tool → `@tool` in `tools.py`, append to `ALL_TOOLS`, add a row in `roles/TOOLS.md` Layer 1.
- New platform integration → `tools/integrations/<slug>.md` + a `tools/REGISTRY.md` row; reference the slug from a role's `preferred_tools` if it should default to it.

## Don't

- Don't run `git commit`/`push`/`reset`/`rebase` unless asked.
- Don't add heavy runtime deps — the project deliberately stays lean (LangGraph + Gemini + duckduckgo + pyyaml).
- Don't widen scope into multi-agent subagent dispatch; the single ReAct loop + role/skill switching is intentional.
