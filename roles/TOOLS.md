# Marketing Agent — Tool Inventory

This file is the **canonical, written-down list of every "tool"** the marketing
agent can reach, so roles, prompts, and humans all share one vocabulary. Tools come
in two layers — keep them distinct.

---

## Layer 1 — Agent-callable tools (LangChain, always available)

Defined in `marketing_agent/tools.py`. **Every role shares all of these.** These are
the only functions the model can actually *call* in the ReAct loop.

| Tool | What it does |
|------|--------------|
| `web_search` | DuckDuckGo search (no API key). Use for any real-time info: prices, news, competitor moves, keyword popularity. **Always call before stating a live fact.** |
| `save_asset` | Write a deliverable (copy, strategy doc, keyword list…) to `output/` as a file. Use a semantic kebab-case `.md` name; call once after the full output is ready. |
| `read_asset` | Read a previously saved asset back from `output/`. |
| `list_assets` | List saved asset filenames in `output/`. |
| `list_skills` | List the 47 marketing skill playbooks by name + one-line summary. |
| `read_skill_reference` | Pull a deeper `references/*.md` playbook for a skill (e.g. `ads` → `references/b2b-paid-playbook.md`). |
| `read_tool_guide` | Pull a platform integration how-to from `tools/integrations/<slug>.md` (e.g. `google-ads.md`). Returns reference text only — does not execute the CLI wrappers. |

> Convention: real-time info → `web_search`; final long-form deliverable →
> `save_asset`; deep platform how-to → `read_tool_guide`.

---

## Layer 2 — Platform integration guides (`tools/REGISTRY.md`)

Layer-1 `read_tool_guide` loads these on demand. Each role declares the integrations
it reaches for most under `preferred_tools` (slugs match `tools/integrations/<slug>.md`
and the REGISTRY index). The full catalog (~100 platforms) lives in
`tools/REGISTRY.md`; below is each role's go-to set.

### Paid Search Specialist (SEM / Google Ads)
`google-ads`, `ga4`, `google-search-console`, `optimizely`, `hotjar`

### Social & Performance Ads Manager (Meta / TikTok)
`meta-ads`, `tiktok-ads`, `buffer`, `ga4`, `heygen`, `wistia`

### Technical & Content SEO Specialist
`google-search-console`, `ahrefs`, `semrush`, `dataforseo`, `rankparse`, `schema` (skill)

### B2B Growth & LinkedIn Specialist
`linkedin-ads`, `apollo`, `clay`, `clearbit`, `hunter`, `instantly`, `hubspot`, `rb2b`, `crossbeam`

### Lifecycle & Retention Specialist (Email / CRM)
`klaviyo`, `customer-io`, `resend`, `postmark`, `attentive`/`postscript`, `hubspot`, `stripe`, `pendo`

### Director / Growth Lead (orchestrator)
All of the above, plus `similarweb`, `supermetrics`, `ga4`, `g2`/`trustpilot` — whatever attribution and benchmarking the question needs.

---

## Adding / changing tools

- **New callable tool:** add a `@tool` function in `tools.py`, append to `ALL_TOOLS`,
  add a row to Layer 1 here.
- **New integration guide:** drop a `tools/integrations/<slug>.md`, add a REGISTRY
  row, then (if a role should default to it) list the slug in that role's
  `preferred_tools` YAML.
