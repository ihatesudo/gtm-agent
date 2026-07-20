# Marketing Agent

**English** · [简体中文](README.zh-CN.md)

> **One AI that doesn't try to do everything badly — it runs a whole marketing team.**
> And it plugs straight into the 150+ marketing tools you already pay for.

[**→ Try it in 60 seconds**](#quick-start) · [**→ See real output**](#see-real-output) · [**→ Browse the 150+ integrations**](#plugs-into-your-stack) · [**→ Meet the team**](#meet-the-team)

Most marketing AIs are a single generalist: ask it about SEO and it's okay, ask it
about paid ads and it's okay, ask it to write the launch email and it's… okay. The
result is shallow work across every channel.

This project takes a different bet. Instead of one person faking every job, the
agent is structured as a **real marketing org**: a Growth Lead who directs, and six
specialists — search, social, SEO, B2B, lifecycle, and more — each with their own
voice, instincts, playbook, and toolkit. You talk to the team the way you'd brief an
agency: tell them the goal, and the right specialist picks it up — then hands off to
the platform tools that actually execute.

It's built for founders, marketers, and growth teams who want expert-level thinking
on tap — strategy, copy, campaigns, SEO, lifecycle flows — without paying seven
salaries or copy-pasting out of a chat window.

> **Stop briefing a chatbot. Start commanding a team.** ↓

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

## Plugs into your stack

This is where most "marketing AI" stops at copy. **This one ships a real toolkit:**
**64 ready-to-run CLIs** + **90+ integration guides**, covering 150+ of the platforms
real marketers live in — Google Ads, Klaviyo, GA4, Ahrefs, HubSpot, Apollo, and the
rest. The agent reads the how-to on demand and, where you've added a key, can drive
the tool itself. No vendor lock-in, no walled garden.

> 💡 **Everything below is in the repo today** — `tools/clis/` for zero-dependency
> scripts you can run right now, `tools/integrations/` for the full reference library.

Every CLI follows the same shape — `{tool} <resource> <action> [options]`, JSON to
stdout, keys read from env vars. So once you've seen one, you've seen them all.
Full source of truth: [`tools/clis/README.md`](./tools/clis/README.md). The complete
inventory, organized by category:

### 💰 Ads

| Category | Tool |
|---|---|
| Ads | [Google Ads](https://ads.google.com) |
| Ads | [LinkedIn Ads](https://business.linkedin.com/marketing-solutions/ads) |
| Ads | [Meta Ads](https://www.facebook.com/business/ads) |
| Ads | [TikTok Ads](https://ads.tiktok.com) |

### 🔍 SEO

| Category | Tool |
|---|---|
| SEO | [Ahrefs](https://ahrefs.com) |
| SEO | [DataForSEO](https://dataforseo.com) |
| SEO | [Google Search Console](https://search.google.com/search-console) |
| SEO | [Keywords Everywhere](https://keywordseverywhere.com) |
| SEO | [SEMrush](https://semrush.com) |
| SEO | [RankParse](https://rankparse.com) |

### ✉️ Email & SMS

| Category | Tool |
|---|---|
| Email/CRM | [ActiveCampaign](https://activecampaign.com) |
| Email/SMS | [Brevo](https://brevo.com) |
| Email | [Customer.io](https://customer.io) |
| Email | [Kit](https://kit.com) |
| Email/SMS | [Klaviyo](https://klaviyo.com) |
| Email | [Mailchimp](https://mailchimp.com) |
| Email | [Postmark](https://postmarkapp.com) |
| Email | [Resend](https://resend.com) |
| Email | [SendGrid](https://sendgrid.com) |
| Newsletter | [Beehiiv](https://beehiiv.com) |
| Push | [OneSignal](https://onesignal.com) |

### 📊 Analytics

| Category | Tool |
|---|---|
| Analytics | [Adobe Analytics](https://business.adobe.com/products/analytics) |
| Analytics | [Amplitude](https://amplitude.com) |
| Analytics | [Google Analytics 4](https://analytics.google.com) |
| Analytics | [Mixpanel](https://mixpanel.com) |
| Analytics | [Plausible](https://plausible.io) |
| Analytics | [Segment](https://segment.com) |
| Product Analytics | [Pendo](https://pendo.io) |
| Competitive Intelligence | [SimilarWeb](https://similarweb.com) |
| CRO | [Hotjar](https://hotjar.com) |
| A/B Testing | [Optimizely](https://optimizely.com) |

### 🤝 CRM, Messaging & Lifecycle

| Category | Tool |
|---|---|
| Messaging | [Intercom](https://intercom.com) |
| CRM | [Close](https://close.com) |
| Sales Engagement | [Outreach](https://outreach.io) |

### 🎯 Outbound & Enrichment

| Category | Tool |
|---|---|
| Data Enrichment | [Apollo.io](https://apollo.io) |
| Data Enrichment | [Clearbit](https://clearbit.com) |
| Data Enrichment | [Clay](https://clay.com) |
| Data Enrichment | [ZoomInfo](https://zoominfo.com) |
| Email Outreach | [Hunter.io](https://hunter.io) |
| Email Outreach | [Instantly.ai](https://instantly.ai) |
| Email Outreach | [Lemlist](https://lemlist.com) |
| Email Outreach | [Snov.io](https://snov.io) |
| Partnerships | [Crossbeam](https://crossbeam.com) |
| Developer Prospecting | [GitHub Prospects](https://github.com) |

### ⭐ Reviews & Social

| Category | Tool |
|---|---|
| Social | [Buffer](https://buffer.com) |
| Reviews | [G2](https://g2.com) |
| Reviews | [Trustpilot](https://trustpilot.com) |

### 🎥 Webinar, Video & Forms

| Category | Tool |
|---|---|
| Webinar | [Demio](https://demio.com) |
| Webinar | [Livestorm](https://livestorm.co) |
| Video | [Wistia](https://wistia.com) |
| Forms | [Typeform](https://typeform.com) |
| Scheduling | [Calendly](https://calendly.com) |
| Scheduling | [SavvyCal](https://savvycal.com) |

### 💳 Payments, Referral & Affiliate

| Category | Tool |
|---|---|
| Payments | [Paddle](https://paddle.com) |
| Affiliate | [PartnerStack](https://partnerstack.com) |
| Referral | [Mention Me](https://www.mention-me.com) |
| Referral | [Rewardful](https://www.getrewardful.com) |
| Referral | [Tolt](https://tolt.io) |

### 🔗 Links, Search & Automation

| Category | Tool |
|---|---|
| Links | [Dub.co](https://dub.co) |
| AI Search | [Exa](https://exa.ai) |
| Automation | [Zapier](https://zapier.com) |
| Data Integration | [Coupler](https://coupler.io) |
| Reporting | [Supermetrics](https://supermetrics.com) |

### 🤖 AI & Content

| Category | Tool |
|---|---|
| AI Content | [AirOps](https://airops.com) |

…plus 90+ integration guides in [`tools/REGISTRY.md`](./tools/REGISTRY.md) — HubSpot,
Salesforce, Stripe, Shopify, Twilio, PostHog, Clay, ZoomInfo, and more — loaded on
demand whenever the agent needs the playbook.

→ **Browse the live menus:** `make roles` · `make skills` · [`tools/clis/README.md`](./tools/clis/README.md)

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

→ **Want your own?** Run `make run` and paste a brief. The first deliverable lands
in `output/` within minutes.

---

## Quick start

**Three commands to your first deliverable.** Seriously.

```bash
make setup     # uv sync — install dependencies
make auth      # one-time: gcloud application-default login (enables Vertex AI)
make run       # interactive REPL — you're talking to the team
```

For English-only agent instructions and responses in one-shot CLI mode, add
`--language en` (for example: `uv run python -m marketing_agent --language en
--role seo "Audit this site structure"`). The Reflex app has the same per-session
selector in its sidebar; Chinese (`zh`) remains the default.

```bash
uv run python -m marketing_agent --language en --role seo "Audit this site structure"
```

### Web app with passwordless login

The Reflex app is available through `make web`. It uses Appwrite Magic URL
authentication: users enter an email address and receive a one-time sign-in
link. There is no Google OAuth app, password database, or custom domain needed.

1. Create a free Appwrite Cloud project and add a **Web** platform for
   `localhost` while developing. After deployment, add the hostname printed by
   Reflex Cloud (for example `your-app.reflex.run`).
2. Copy `.env.example` to `.env` and set `APPWRITE_ENDPOINT` and
   `APPWRITE_PROJECT_ID` from the Appwrite console. These are public client
   configuration values; never add an Appwrite API key.
3. Run `make web`. Deploy with `make deploy` after logging in to Reflex Cloud.

The `/auth/callback` route validates the Appwrite browser JWT again on the
Python server before granting agent access. The Node integration CLIs remain
server-side repository tools and are not executable from the browser.

### Production release

Follow this order once. You do **not** need to own a domain.

1. Create a free Appwrite Cloud project. Add `localhost` as a Web platform for
   local testing, then copy its **Endpoint** (ending in `/v1`) and **Project ID**.
2. Create an OpenRouter API key with a spending limit.
3. Create the production env file and fill in those four values:

   ```bash
   cp .env.sample .env.production
   ```

4. Sign in to Reflex Cloud once; this opens a browser login:

   ```bash
   make release-login
   ```

5. Deploy the app:

   ```bash
   make release
   ```

   This validates `.env.production`, builds the Reflex app, and securely uploads
   the values as Reflex Cloud environment variables. It then prints the live app
   URL.
6. Register that live hostname in Appwrite as a second **Web** platform. This
   enables the browser to request Magic URLs from your deployed app:

```bash
make appwrite-platform APP_URL=https://your-app.reflex.run
```

7. Open the deployed URL, enter an email address, and use the received sign-in
   link to verify the login flow.

For later changes to OpenRouter or Appwrite values, edit `.env.production` and
run `make release-secrets`.

> 👉 **New here?** Run `make run`, then type a real brief —
> *"我的 SaaS 要在北美做冷启动，给我 90 天获客计划"* — and watch the Director
> route it. Or jump straight to a specialist: `make role NAME=paid-search MSG="..."`.

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

---

## Ready to put a marketing team in your terminal?

**[→ Get started in 60 seconds](#quick-start)** · **[→ See what it produces](#see-real-output)** · **[→ Explore 150+ integrations](#plugs-into-your-stack)**

Founders, marketers, and growth teams use this to ship agency-grade work without the
agency. Star ⭐ the repo if it saves you a week — contributions, new roles, and new
playbooks all welcome.
