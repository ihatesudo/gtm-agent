# 📊 GTM Agent: PRD Gap Analysis for Production Deployment

This report identifies the technical gaps between our local development setup (Mastra + Local Sandbox Tools) and a fully production-grade deployment on **Cloudflare Workers** + **Turso Database**.

---

## 1. The Production Gap Matrix

| Domain | Local Development Setup | Production (Cloudflare Workers + Turso) | Gaps & Action Items | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | Local SQLite file (`file:mastra.db`) | Remote Turso (LibSQL over HTTP) | **Resolved**: Updated [index.ts](file:///Users/miczhuang/Code/AI/gtm-agent/mastra/src/mastra/index.ts) to support env var fallbacks. Needs migration on production startup. | ✅ Ready |
| **Secret Management**| Local `.env` | Cloudflare Secrets (`wrangler secret`) | **Gap**: Need a Makefile script/instructions to batch upload secrets to the Mastra worker namespace. | ⚠️ Missing tooling |
| **Process Execution**| Native shell execution (`child_process`) | V8 Isolate (Process spawning is forbidden) | **Gap**: Playwright crawler & local asset compilers cannot run in V8. Needs remote sandbox service. | ❌ Blocker |
| **Frontend Assets**  | Served from Vite dev server or local studio | Cloudflare Workers Assets / Pages | **Gap**: Ensure `CloudflareDeployer` correctly uploads `.mastra/output/studio` as static assets. | ⚠️ Configuration gap |
| **Telemetry & Traces**| File-based trace logs | Remote logs or LibSQL traces | **Gap**: Mastra's tracing engine needs optimization or disabling to prevent latency overhead on the edge. | ⚠️ Optimization gap |

---

## 2. Deep Dive: High-Priority Gaps & Mitigation Strategies

### Gap 1: Process Execution & Browser Automation in V8 (Critical Blocker)
*   **The Issue**: GTM Agent's core tools require launching Playwright for web crawling and spawning compiler processes. Cloudflare Workers run inside lightweight V8 Isolates which **do not support process spawning, filesystem writes, or running Node native binaries**.
*   **Mitigation Options**:
    1.  **Option A (Decoupled Sandbox)**: Spin up a lightweight Google Cloud Run container hosting our execution tools/sandboxes. The Cloudflare Worker calls this container over HTTP to run tasks.
    2.  **Option B (Headless API delegation)**: Route browser crawler calls to an online headless browser service (e.g. Browserless.io) via WebSocket protocol, avoiding local container requirements.
    3.  **Option C (Mock/Bypass mode)**: Detect Cloudflare environment and mock heavy execution tools during initial stages.

### Gap 2: Production Secret Bindings (Tooling Gap)
*   **The Issue**: The new Mastra Worker requires environment secrets (`GEMINI_API_KEY`, `TURSO_DATABASE_URL`, etc.). The existing `Makefile` targets like `web-secrets` only upload secrets for the *old* `workers/backend` stack, not the new `mastra` deployment.
*   **Mitigation**: Create a new Makefile target `mastra-secrets` to batch-upload credentials from the `mastra/.env` file.

### Gap 3: Serving the Custom Chat UI (Configuration Gap)
*   **The Issue**: Our custom React chat UI is built under `mastra/ui/dist` and copied to `.mastra/output/studio/` by our script. We must configure `@mastra/deployer-cloudflare` or `wrangler.jsonc` to upload and serve these files correctly.
*   **Mitigation**: Add an `assets` binding in Wrangler to serve `.mastra/output/studio` statically, or configure Pages deployment.

---

## 3. Recommended Production Action Items

To reach full production readiness, we need to execute the following steps:

1.  **Add `mastra-secrets` to Makefile**:
    Add a target to upload the secrets for the Mastra worker namespace:
    ```makefile
    mastra-secrets:
    	cd mastra && npx wrangler secret put TURSO_DATABASE_URL
    	cd mastra && npx wrangler secret put TURSO_AUTH_TOKEN
    	cd mastra && npx wrangler secret put GEMINI_API_KEY
    ```
2.  **Verify Bundle Sizes**:
    Check if the bundled output `.mastra/output` fits under the Cloudflare Workers 10MB script size limit.
3.  **Introduce Environment-Aware Tools**:
    In specialist agent tool scripts, check if running in a Serverless/Worker environment. If so, fall back to headless API crawlers (e.g. Browserless.io) rather than executing `playwright` locally.
