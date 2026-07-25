# Marketing Roles — Director + 6 Specialists

**Date:** 2026-07-16
**Status:** **Implemented** — 7 roles shipped, `--role`/`/role`/`/roles` wired in CLI + Mastra.

## Goal

Upgrade the single "Head of Growth" agent into a **commandable 7-person marketing
team**: one Marketing Director (default base prompt + a selectable role) and six
switchable specialist roles, modelled on a competitive digital-marketing org and on
kimi-cli's `agents/default/*.yaml` format.

## Decisions

- **Architecture:** Director is the base system prompt. `--role <name>` selects one
  of the six specialists and appends that role's persona to the prompt — parallel to
  the existing `--skill` mechanism. Reuses `skills_loader` patterns.
- **Format:** kimi-cli-style YAML per role under `roles/`.
- **Director:** serves double duty — default orchestrator **and** a selectable role
  (`growth-lead`). The base `SYSTEM_PROMPT` *is* the Director persona.
- **Scope:** full implementation this round (definitions + loader + agent/CLI wiring).

## Deliverables

1. `roles/TOOLS.md` — canonical tool list (callable LangChain tools + per-role
   preferred platform integrations from `tools/REGISTRY.md`).
2. `roles/*.yaml` (7 files): `director` + `paid-search`, `social-ads`, `seo`,
   `b2b-linkedin`, `lifecycle-retention`, `growth-lead`.
3. `marketing_agent/roles_loader.py` — YAML parse / `list_roles` / `find_role` /
   `load_role_persona`.
4. `agent.py` — `build_agent(role=, skill=)`; `_compose_prompt` layers
   Director base + active role persona + (optional) skill playbook.
5. `__main__.py` — `--role`, `/role`, `/roles` (mirror the skill menu).

## Role YAML schema

```yaml
version: 1
role:
  name: paid-search            # kebab-case id used by --role
  title: "Paid Search Specialist (SEM / Google Ads)"
  persona: |                  # 2-4 sentence "soul" — voice, expertise, instincts
    ...
  core_focus: "High-intent capture, conversion optimization, immediate ROI."
  tags: [GoogleAds, PPC, SEM, ROAS, GA4]   # the #Keywords from the template
  owned_skills: [ads]                        # primary accountable skills
  shared_skills: [analytics, ab-testing, cro, copywriting, copy-editing]
  preferred_tools: [google-ads, ga4, google-search-console]  # REGISTRY.md slugs
  when_to_use: "..."
```

Director additionally carries `orchestrates: [...]` and routing guidance.

## Skill → role mapping (all 47 skills covered)

| Role | owned | shared |
|------|-------|--------|
| Paid Search (SEM) | ads | analytics, ab-testing, cro, copywriting, copy-editing |
| Social & Perf Ads | social, ad-creative, video, image, aso | copywriting, ab-testing, analytics |
| Technical & Content SEO | seo-audit, ai-seo, programmatic-seo, schema, site-architecture | content-strategy, copywriting |
| B2B & LinkedIn | prospecting, sales-enablement, revops, cold-email, public-relations, competitor-profiling, competitors | customer-research, content-strategy |
| Lifecycle & Retention | emails, sms, churn-prevention, onboarding, referrals, community-marketing, lead-magnets | copywriting, analytics |
| Director / Growth Lead (base) | marketing-plan, marketing-ideas, marketing-psychology, marketing-council, marketing-loops, product-marketing, pricing, offers, launch, signup, co-marketing, content-strategy, customer-research | all |

**General pool** (any role may invoke): analytics, ab-testing, cro, copywriting,
copy-editing, popups, free-tools, directory-submissions, marketing-council
(advisory board; Director chairs, specialists may consult).

## Prompt composition

```
Director base SYSTEM_PROMPT            # always present
  + (active role persona block)        # when --role set
  + (active skill playbook block)      # when --skill set (unchanged behavior)
```

## CLI additions

- `--role NAME` / `--list-roles`
- REPL `/roles` (menu), `/role [name|n]`, `/role-off`
- Role selection is re-resolved per task (mirrors skill switching).

## Non-goals

- No multi-agent subagent dispatch (option B rejected) — single ReAct loop keeps it
  simple and reuses existing infra.
- No changes to the 47 skills themselves; only how they're grouped/selected.
