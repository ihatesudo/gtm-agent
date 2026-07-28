# Email Platform Recommendation (Free / Open-Source)

For a solo operator who sends scheduled email and wants an AI agent to auto-reply
24/7, with rendering that survives **both Outlook (the hard Word-engine desktop
client) and Gmail**.

## The concrete stack

| Layer | Pick | Why |
|---|---|---|
| **Sending engine** | **Postal v3.3.7** | API-first "open-source Sendgrid." SMTP + HTTP API + delivery & *inbound* webhooks. Purpose-built for app-driven sending. |
| **Templating** | **MJML v5.4.0** | Actively maintained, generates the most Outlook-safe HTML of any OSS framework. |
| **Testing** | **Outlook desktop (Win VM) + Outlook Web + Gmail Web + Gmail mobile** | No free OSS truly replaces Litmus. This 4-client gauntlet catches ~90% of issues. |
| **Inbox-for-agent** | **Postal inbound webhooks** (primary) or **`imap-tools`** against a Mailcow/Dovecot mailbox (fallback) | Webhooks = zero polling, pure HTTP into your agent. |

---

## 1. Sending engine — why Postal

Verified July 2026 maintenance status:

| Engine | Status | Verdict |
|---|---|---|
| **Postal** `postalserver/postal` | v3.3.7 (June 2026), active. HTTP API, `MessageDelivery`/`MessageBounced`/**`MessageIncoming`** webhooks, SPF/DKIM signing. | **Pick this.** It is literally "Mailgun/Postmark but open source." |
| **Listmonk** | v6.2.0 (June 2026), very active. Single Go binary + Postgres. | Excellent newsletter/list manager, but it's not an MTA — sends *through* Postal/SMTP. Add only if you need list management. |
| **Mailcow (dockerized)** | Active, full stack: Postfix + Dovecot + SOGo webmail + admin GUI. | The "one box does send + receive + webmail" option. Heavier (6GB+ RAM). Best if you want a human-readable inbox too. |
| **Mautic** | v7.0 GA Jan 2026, active but flagged a $40k funding gap. Symfony, 2–4GB RAM. | **Overkill for a solo operator.** HubSpot-scale marketing automation. |
| **Mailtrain v2** | Effectively dead — last release June 2021, targets Node 14 (EOL). | **Do not deploy.** |
| **Postfix + Dovecot bare** | Eternal, but you hand-roll everything. | Maximum control, minimum convenience. |

**Recommendation: Postal.** Send (SMTP + API), delivery tracking, AND inbound
webhooks in one daemon. The inbound webhook is the key feature that makes the
AI-agent loop clean (no IMAP polling).

---

## 2. Outlook rendering — the hard part

**2026 critical fact:** there are now *two* Outlook desktops with different engines:
- **Classic Outlook (Win, 2007–2021/365)** → **Microsoft Word's rendering engine.** No flexbox, no grid, broken margins, no `border-radius` on buttons.
- **New Outlook for Windows + Outlook for Mac** → **WebView2 (Edge-based) engine.** Ignores MSO conditionals and VML, renders modern CSS fine.

Microsoft's migration is completing ~2026, but **classic Outlook is still heavy
in enterprises** — so you write for Word's engine and let it degrade.

### Battle-tested techniques (still required)

1. **Tables-based layout, not flexbox/grid.** Word can't do fl/grid.
2. **MSO conditional comments** — the backbone of every Outlook fix:
   ```html
   <!--[if mso]>
     <!-- Word-only content: ghost tables, VML buttons -->
   <![endif]-->
   ```
3. **Ghost tables/columns** — invisible tables inside `<!--[if mso]>` to force column widths.
4. **VML for bulletproof buttons** — the only reliable clickable button in Word-engine Outlook (CSS `border-radius` is stripped). Canonical pattern: Stig Morten Myre's "bulletproof button" (`<v:rect>` + `<v:fill>` inside MSO conditional).
5. **Inline CSS** — many clients (notably Gmail) strip `<style>` blocks; keep critical styles inline.

### Frameworks ranked by Outlook-safety

| Framework | Output safety | Verdict |
|---|---|---|
| **MJML** (`mjml@5.4.0`) | Highest. Auto-generates MSO ghost tables, VML buttons, proper `<!--[if mso]-->` shims. | **Pick this.** |
| **Foundation for Emails / Inky** | Also excellent, emits bulletproof tables. | Viable, but less actively maintained, steeper build. |
| **HEML** | Decent, lower community velocity. | Skip. |
| **Hand-coded HTML** | Max control, max pain. | Only for one-off tricks MJML can't express. |

**Recommendation: MJML.** Install via `npm install mjml` (CLI: `mjml input.mjml -o output.html`) or use the Node/Python API to render templates programmatically.

---

## 3. Free testing — the honest truth

**There is no free open-source equivalent of Litmus/Email on Acid.** Anything
claiming otherwise is overpromising. What you can actually do for free:

| Method | What it catches | Limitation |
|---|---|---|
| **Outlook desktop on a Windows box/VM** (classic = Word engine) | The real Word-engine breakage. | Need Windows (free Microsoft dev VMs work). |
| **Outlook on the Web (outlook.com)** | WebView2-engine rendering. | Free, browser-based. |
| **Gmail web + Gmail mobile** | The other half of your audience. | Free. |
| **Thunderbird** | Sanity check for IMAP / general HTML. | Its own engine; does NOT approximate Outlook. |

**The practical 4-client gauntlet:** build → render in (1) classic Outlook Win,
(2) Outlook Web, (3) Gmail web, (4) Gmail mobile. Catches ~90% of real-world
breakage for zero cost. The remaining 10% (Yahoo, Samsung Mail, dark-mode
overrides) is where paid Litmus earns its money — not required to ship.

---

## 4. Inbox-for-agent — two clean paths

### Path A (recommended): Postal inbound webhooks — no IMAP
- Point an MX record at your Postal server for an inbound domain.
- Postal fires an HTTP **`MessageIncoming`** webhook (JSON: raw RFC822 + parsed headers) to your agent's endpoint.
- Agent processes the JSON, drafts a reply, sends via Postal's HTTP send API.
- **Zero polling, pure HTTP, trivial to deploy** as a small web service (FastAPI).
- Tradeoff: no human-readable inbox/UI — purely machine-to-machine. Fine if the agent owns the address.

### Path B (fallback): real mailbox + IMAP polling
Use this if you also want a normal inbox you can read.
- Host the mailbox on **Mailcow** (Dovecot IMAP) or any cheap IMAP provider.
- Agent polls via **`imap-tools`** (`pip install imap-tools`, async-compatible, returns parsed objects):
  ```python
  from imap_tools import MailBox, A
  with MailBox('imap.example.com').login('user','pass') as mb:
      for msg in mb.fetch(A(seen=False), mark_seen=True):
          handle(msg.from_, msg.subject, msg.html)
  ```
- Reply by submitting to Postal's SMTP/API.
- `imap-tools` > `IMAPClient` > raw `imaplib` — imap-tools gives parsed `EmailMessage` objects + `async`.

**Note:** Mailcow exposes SOGo but no first-class "read my inbox" REST API — IMAP
is still the clean interface. Nylas is not open-source (freemium SaaS).

---

## 5. Scheduling / drip (定期发邮件)

| Approach | When to use |
|---|---|
| **`cron` + Python (`smtplib` or Postal HTTP API) + MJML templates** | **Default.** Simplest. Render `.mjml` → HTML at send time, loop recipients, submit to Postal. ~50 lines. |
| **Listmonk v6.2.0** | Add *only* if you need subscriber list management, double opt-in, unsubscribe handling, suppression lists, campaign UI. |
| **Mautic** | Only if you need full marketing automation (lead scoring, multi-step branching). Too heavy. |

**Recommendation:** Start with **cron + Python + MJML + Postal**. Graduate to
Listmonk only when list-management pain becomes real.

---

## Final architecture (simplest thing that works)

```
        ┌──────────────┐   MJML (.mjml templates)
        │  Templates   │ ──────────────┐
        └──────────────┘               ▼
   cron / scheduler ──► Python job ──► render MJML ──► Postal (SMTP/HTTP send)
                                                          │
                                                  DKIM/SPF-signed send
                                                          │
                                            ┌─────────────▼──────────────┐
                                            │   Recipients (Gmail etc.)  │
                                            └─────────────┬──────────────┘
                                              inbound replies │
                                                          ▼
                                          Postal MessageIncoming webhook
                                                          │
                                                          ▼
                                                   Your AI agent  ◄── 24/7
                                                  (FastAPI service)
```

### Honest tradeoffs

Postal is lighter and more API-native than Mailcow, but it's *not* a full mailbox
host — if you want a human inbox and webmail, use Mailcow (at the cost of ~6GB RAM).
MJML produces the safest Outlook HTML of any OSS framework, but no framework can
make classic Outlook's Word engine render `flexbox` or true `border-radius` —
you're always trading design ambition for Word-engine compatibility. There is
**no free Litmus replacement**; budget for a Windows VM to eyeball classic
Outlook. The agent loop is cleanest as **Postal webhooks → HTTP agent**, not IMAP
polling — but if you want a real inbox, `imap-tools` against Mailcow/Dovecot is
correct.

### Versions to pin (verified July 2026)
- `mjml` **v5.4.0** — `npm i mjml@5.4.0`
- Postal **v3.3.7** — Docker deploy
- Listmonk **v6.2.0** — only if you adopt it
- `imap-tools` — latest on PyPI, if using Path B
- **Avoid:** Mailtrain v2 (dead since 2021), Mautic for solo use (too heavy).

---

## How this maps to gtm-agent (build plan, when approved)

1. **`skills/email-rendering/SKILL.md`** — the MJML + Outlook-techniques playbook
   (ghost tables, VML buttons, MSO conditionals, the 4-client test gauntlet).
   Belongs under the `lifecycle-retention` role (email is their domain).
2. **`tools/integrations/postal.md`** — Postal setup guide (SMTP/HTTP send,
   inbound webhooks). `lifecycle-retention.preferred_tools` += `[postal]`.
3. **`tools/integrations/imap-tools.md`** — the Path B inbox-polling guide, if
   you want a real mailbox instead of webhooks.
4. **A `send_email` tool in `tools.py`** — wraps Postal's HTTP send API +
   MJML render. This is the agent-callable surface. (Defer until Postal is
   deployed — it needs credentials/config, not just code.)
5. **Auto-reply agent loop** — a separate FastAPI service (not in the CLI REPL)
   that receives Postal webhooks, drafts replies via the marketing agent, and
   sends them back. This is the "24/7" piece — it's a deployment, not a skill.
