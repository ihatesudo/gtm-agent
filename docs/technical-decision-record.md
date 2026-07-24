# 🔩 GTM Agent: Technical Decision Record (TDR)

All decisions below were resolved through a structured interview on 2026-07-24.

---

## Decision Summary

| # | Domain | Decision | Rationale |
|---|--------|----------|-----------|
| 1 | Project Memory | Migrate from in-memory `Map` → **Turso/LibSQL** | Current `Map` loses all data on restart. Turso is already wired for conversation memory — reuse for project context. |
| 2 | File/Asset Storage | **Turso (metadata) + Cloudflare R2 (blobs)** | `node:fs` doesn't exist on Workers. R2 is S3-compatible, supports images/attachments, $0.015/GB/month. |
| 3 | Skills/Playbooks | **Build-time JSON bundle** | Embed all 47 skill MDs into a static JSON registry at `mastra build` time. Zero runtime I/O, updates on deploy. |
| 4 | CLI Tool Execution | **Replace `execFile` with direct `fetch()` API calls** | `child_process` is forbidden in V8. Each platform integration (Resend, Ahrefs, GA4) becomes a dedicated Mastra tool using `fetch()`. |
| 5 | LLM Model | **Gemini API key mode** (`google/gemini-2.5-flash`) | Works on Cloudflare Workers (no ADC token refresh needed). Vertex AI ADC requires Google Cloud runtime. |
| 6 | Model Tier Strategy | **Director: Gemini 3.5 (stronger reasoning)**, Specialists: Gemini Flash (cheaper) | Trial users get $0.50 budget (~500K tokens). Higher-tier model for Director ensures quality campaign planning. |
| 7 | Web Crawling | **Cloudflare Browser Run** (primary) + DuckDuckGo `fetch()` (fallback) | Browser Run is GA, supports Playwright natively inside Workers. 10hr/mo on $5 plan. Fallback to simple fetch when sessions exhausted. |
| 8 | Authentication | **Cloudflare Access + JWT** | Free for ≤50 users, supports Google/GitHub OAuth. JWT in cookie, credit balance lookup in Turso. |
| 9 | Trial Mode | **Token-counting credit system** ($0.50 budget per user) | Track input/output tokens per user in Turso. Show remaining credits in UI header. |
| 10 | Replay Mode | **Pre-recorded SSE replay files** stored in R2 | Record full SSE event streams during real executions. Replay at realistic speed with typing animations. Zero LLM cost. |

---

## Detailed Decisions

### 1. Project Memory Persistence

**Problem**: [project-memory.ts](file:///Users/miczhuang/Code/AI/gtm-agent/mastra/src/mastra/memory/project-memory.ts) uses `const projectStore = new Map<string, ProjectMemory>()` — all project context (product name, ICP, brand voice, past campaigns) is lost on every restart.

**Solution**: Create a `projects` table in Turso. Replace `Map` operations with SQL queries via the same `LibSQLStore` connection already configured in [index.ts](file:///Users/miczhuang/Code/AI/gtm-agent/mastra/src/mastra/index.ts).

```sql
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON blob of ProjectMemory
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### 2. Asset Storage: Turso + R2

**Problem**: [save_asset](file:///Users/miczhuang/Code/AI/gtm-agent/mastra/src/mastra/tools/gtm-tools.ts#L70-L88) writes to local `output/` via `node:fs`. Workers have no writable filesystem.

**Solution**:
- **Metadata** (filename, size, project_id, content_type, created_at) → Turso `assets` table
- **File blobs** (markdown, images, attachments) → Cloudflare R2 bucket `gtm-agent-assets`
- Tools call R2 via the Workers API binding instead of `node:fs`

```
save_asset(filename, content)
  → R2.put(key, content)
  → Turso INSERT INTO assets (...)

read_asset(filename)
  → Turso SELECT → R2.get(key)

list_assets()
  → Turso SELECT filename, size, created_at FROM assets
```

---

### 3. Skills Bundle at Build Time

**Problem**: `list_skills` and `read_skill_reference` scan `skills/` directory at runtime via `fs.readdir`.

**Solution**: Add a build step that generates `skills-registry.json`:

```bash
# In mastra build pipeline:
node scripts/bundle-skills.js  # Reads skills/**/*.md → outputs skills-registry.json
```

Tools query the in-memory JSON map instead of filesystem. Skills update on each deploy.

---

### 4. Marketing CLI → Direct API Tools

**Problem**: `execute_marketing_cli` uses `execFile('node', [cliPath, ...])` which is forbidden in V8.

**Solution**: Replace with dedicated Mastra tools per platform:
- `resend_send_email` → `fetch('https://api.resend.com/emails', ...)`
- `ahrefs_keywords` → `fetch('https://api.ahrefs.com/v3/...', ...)`
- `ga4_report` → `fetch('https://analyticsdata.googleapis.com/...', ...)`

Each tool is self-contained, testable, and V8-safe.

---

### 5 & 6. LLM Model Strategy

| Agent | Model | Cost Estimate |
|-------|-------|---------------|
| Director | `google/gemini-3.5-flash` | ~$0.15/1M input tokens |
| All Specialists | `google/gemini-2.5-flash` | ~$0.075/1M input tokens |

- Use Gemini API key mode (env var `GEMINI_API_KEY`), not Vertex AI ADC
- Install `@ai-sdk/google` package for Mastra integration

---

### 7. Web Crawling: Browser Run + Fetch Fallback

**Primary**: Cloudflare Browser Run (GA, supports Playwright natively in Workers)
- Free: 10 min/day, 3 concurrent browsers
- Paid ($5/mo): 10 hr/month, 10 concurrent browsers

**Fallback**: Current DuckDuckGo HTML scraping via `fetch()` when browser sessions exhausted.

**V8 Isolate blocker: RESOLVED** — Browser Run eliminates the need for external Playwright containers.

---

### 8. Authentication: Cloudflare Access + JWT

```
User → Cloudflare Access (Google/GitHub OAuth)
  → JWT cookie issued
  → Worker validates JWT on each request
  → Looks up user credit balance in Turso `users` table
```

Free for ≤50 users. No additional auth service needed.

---

### 9 & 10. Trial Mode & Replay System

**Credit Tracking** (Turso):
```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  credits_remaining_cents INTEGER NOT NULL DEFAULT 50,  -- $0.50 = 50 cents
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**SSE Recording** (R2):
- During real campaign executions, middleware records the full SSE event stream
- Saved as `replays/{campaign_id}.jsonl` in R2
- Replay viewer in the UI plays events back with realistic timing delays
- Trial users who've exhausted credits can browse and replay past campaigns

---

## Architecture After All Decisions

```
Browser → Cloudflare Access (OAuth + JWT)
            ↓
         Cloudflare Worker (Mastra Engine)
            ├── Director Agent (Gemini 3.5 Flash)
            │     └── delegates to Specialist Agents (Gemini 2.5 Flash)
            ├── Skills Registry (bundled JSON)
            ├── Browser Run (headless crawling)
            ├── Direct API tools (Resend, Ahrefs, GA4...)
            ↓
         Turso (LibSQL) ←── conversations, project memory, users/credits, asset metadata
         Cloudflare R2  ←── asset blobs, images, replay recordings
```
