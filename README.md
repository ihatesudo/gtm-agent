# Marketing Agent

**English** · [简体中文](README.zh-CN.md)

> **One AI that doesn't try to do everything badly — it runs a whole marketing team.**

Most marketing AIs are a single generalist: ask it about SEO and it's okay, ask it
about paid ads and it's okay, ask it to write the launch email and it's… okay. The
result is shallow work across every channel.

This project takes a different bet. Instead of one person faking every job, the
agent is structured as a **real marketing org**: a Growth Lead who directs, and six
specialists — search, social, SEO, B2B, lifecycle, and more — each with their own
voice, instincts, playbook, and toolkit. You talk to the team the way you'd brief an
agency: tell them the goal, and the right specialist picks it up.

It's built for founders, marketers, and growth teams who want expert-level thinking
on tap — strategy, copy, campaigns, SEO, lifecycle flows — without paying seven
salaries or copy-pasting out of a chat window.

---

## Why this shape

A competitive marketing team doesn't succeed because one person is brilliant at
everything. It succeeds because the work is **divided into domains**, each owned by
someone who lives and breathes it. That division is exactly what's missing from
"one prompt does all" tools.

So this agent makes the division explicit:

- You get a **Director** who thinks about budget, channels, and the whole picture.
- You get **specialists** you can switch into when a job needs depth — the SEO person
  thinks about crawl budgets and search intent; the paid-search person thinks about
  ROAS and negative keywords; the lifecycle person thinks about churn curves and LTV.
- The output reads like it came from someone who actually does the job, not a
  word-salad summary.

The payoff: answers that are specific, opinionated, and end on a concrete next step
instead of "it depends."

---

## Feature matrix

| | Capability | What it means in practice |
|---|---|---|
| 🎯 | **7 specialized roles** | Director + Paid Search, Social Ads, SEO, B2B/LinkedIn, Lifecycle & Retention, Growth Lead. Each has its own persona, focus, and instincts. |
| 📚 | **47 skill playbooks** | Deep, step-by-step expertise — copywriting, ads, SEO audits, ABM, churn prevention, a legendary-marketers advisory board, and more. |
| 🧰 | **100+ platform integrations** | Reference guides for the tools real marketers use (Google Ads, GA4, Klaviyo, HubSpot, Apollo, Ahrefs, …), loaded on demand. |
| 🧠 | **Layered prompting** | Director base → active role → active skill. Compose a specialist *with* a playbook for deep, focused execution. |
| 💭 | **Live reasoning stream** | Watch the agent think token-by-token, or turn it off for clean output only. |
| 💾 | **Deliverables on disk** | Final copy, strategies, keyword lists saved to `output/` as files — not lost in a chat scroll. |
| 🔍 | **Grounded, not guessed** | Real-time facts (prices, competitor moves, keyword popularity) are searched before they're stated. |
| 🇨🇳 | **Chinese-first** | Speaks your language; professional, specific, and to the point. |
| 🔌 | **Bring-your-own model** | Google Vertex AI (ADC) or the Gemini Developer API (API key) — your choice. |
| 🪶 | **Lean & hackable** | Plain LangGraph + Gemini, no heavyweight frameworks. Adding a role or skill is just dropping in a file. |

---

## Meet the team

| Role | Lives for |
|------|-----------|
| **Director / Growth Lead** | The whole picture — strategy, budget, attribution, where to place the next bet. |
| **Paid Search** | High-intent demand. ROAS, conversion rate, negative keywords, the click you paid for. |
| **Social Ads** | Attention on Meta & TikTok. Creative as targeting, lookalikes, the first 3 seconds. |
| **SEO** | Compounding organic growth. Technical health, search intent, content gaps, links. |
| **B2B / LinkedIn** | High-value decision-makers. ABM, target accounts, thought leadership, the long sales cycle. |
| **Lifecycle & Retention** | The customers you already won. Email/SMS flows, segments, churn, lifetime value. |

Switch into any of them mid-conversation — `--role seo`, then `/role social-ads` —
and the agent picks up that specialist's voice for the next task.

---

## See real output

Don't take the feature list on faith — the [`output/`](./output) folder holds
**unedited deliverables from actual runs**. Two examples worth reading in full:

- 📊 **[Kimi Code vs. MiniMax — growth strategy deep-dive](./output/kimi-vs-minimax-coding-growth-analysis.md)**
  — a Director-level competitive analysis: positioning, audiences, mindshare, and
  go-to-market playbooks, with comparison tables and concrete recommendations.
- 🌱 **[TikTok viral gardening products — growth guide](./output/tiktok-viral-gardening-products-guide.md)**
  — a social-ads specialist's category teardown: market insight, content formulas,
  and an e-commerce conversion path, thinking natively in the channel.

**The impact:** these aren't bullet-point summaries. They're structured,
opinionated, ready-to-use documents — the kind of thing you'd otherwise wait days
for from an agency, produced in a single prompt. See [`output/README.md`](./output/README.md)
for the bilingual gallery index.

---

## Quick start

```bash
make setup     # uv sync — install dependencies
make auth      # one-time: gcloud application-default login (enables Vertex AI)
make run       # interactive REPL
```

Auth is one of two paths (auto-selected by `GENAI_PROVIDER`):

- **Vertex AI (default):** ADC via `gcloud auth application-default login`. Needs
  `GOOGLE_CLOUD_PROJECT` in `.env`. No API key.
- **Gemini Developer API:** set `GENAI_PROVIDER=api` and `GEMINI_API_KEY` in `.env`.

## Running the agent

```bash
make run                            # interactive REPL
make ask MSG="write 3 ad headlines" # one-shot as the Director

# switch to a specialist role
make role NAME=seo MSG="给我一份技术 SEO 审计清单"
uv run python -m marketing_agent --role paid-search --skill ads "ROAS 目标怎么设"

make roles      # browse roles
make skills     # browse the 47 skill playbooks
```

### REPL commands

```
/roles · /role [name|n] · /role-off     switch specialist roles
/skills · /skill [name|n] · /skill-off  switch skill playbooks
/think · /think-on · /think-off         toggle the streamed reasoning trace
/help · /quit
```

Role and skill are re-resolved per task, so switching takes effect on the next prompt.

---

## Future plan

This is early. The team metaphor is the foundation; here's where it's headed.

**Soon**
- **Real platform execution, not just guides.** Today the 100+ integrations are
  how-to references the agent reads. The next step is *acting* — launching a Google
  Ads campaign, sending a Klaviyo flow, pulling live GA4 numbers — behind opt-in
  API keys.
- **A Director that actually delegates.** Right now switching roles is manual. The
  goal is a Director that reads a brief, decides which specialist(s) are needed, and
  routes the work itself — then stitches their outputs into one deliverable.
- **Project memory.** Let the team remember your product, ICP, brand voice, and past
  campaigns so you stop re-explaining context every session.

**Next**
- **More seats at the table.** Brand/creative, product marketing, analytics, PR,
  partnerships — grow the org as the playbooks mature.
- **Eval & self-improvement.** A scored suite of marketing tasks so each role's
  output is measured, not just felt.
- **Web UI.** A friendlier front-end than the terminal for non-engineers — pick a
  role from a sidebar, watch the team work.

**Later / exploring**
- **Human-in-the-loop checkpoints** for anything spending money or sending to
  customers.
- **Multilingual expansion** beyond Chinese-first.
- **A "marketing council" live mode** — multiple advisors debating a decision in
  real time before you commit.

Ideas and contributions welcome — see `docs/superpowers/specs/` for the design
thinking behind what's built so far.

---

## How the pieces fit

- `marketing_agent/agent.py` — LangGraph ReAct agent. `SYSTEM_PROMPT` is the Director
  persona; `build_agent(role=, skill=)` composes **Director base + role persona +
  skill playbook**.
- `marketing_agent/tools.py` — the 7 callable tools (`web_search`, `save_asset`,
  `read_asset`, `list_assets`, `list_skills`, `read_skill_reference`,
  `read_tool_guide`).
- `roles/` — one YAML per role (kimi-cli style). `roles/TOOLS.md` = full tool
  inventory + each role's preferred platform integrations.
- `marketing_agent/roles_loader.py` / `skills_loader.py` — parse and serve
  roles/skills from disk.
- `skills/` — 47 marketing skill playbooks.
- `tools/REGISTRY.md` — ~100 platform integration guides (loaded on demand).

### Conventions

- Real-time info (prices, news, competitor moves) → always `web_search` first.
- Final long-form deliverables → `save_asset` to `output/` (kebab-case `.md`).
- Platform how-to → `read_tool_guide` (e.g. `google-ads.md`).

## Housekeeping

```bash
make clean     # remove .venv and build artifacts
```
