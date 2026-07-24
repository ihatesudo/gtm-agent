# ☁️ GTM Agent: Cloud Deployment Research & Strategy

To run GTM Agent in the cloud cheaply, fast, and without the limits of the local macOS filesystem, **Cloudflare Workers** combined with either **Turso (LibSQL)** or **Cloudflare D1** is the optimal choice.

This report evaluates cloud runtime environments, storage adapters, cost profiles, and provides an implementation plan.

---

## 1. Cloud Provider Comparison

| Criteria | Cloudflare Workers (Edge Serverless) | Google Cloud Run (Container Serverless) | Traditional VPS (e.g. EC2 / DigitalOcean) |
| :--- | :--- | :--- | :--- |
| **Cold Start** | **<10ms** (Instant V8 Isolates) | **1s - 3s** (Container boot) | None (Always running) |
| **Cost Profile** | **Generous Free Tier** ($5/mo flat for 10M requests) | Pay-per-use ($0.00001667/vCPU-second, scales to 0) | Fixed cost ($5/mo - $10/mo flat) |
| **Edge Routing** | Native global distribution | Regional (multi-region setup is complex) | Single Location |
| **File I/O** | Read-only ephemeral (Requires remote storage) | Read-write ephemeral (Requires volume/DB) | Native Read-Write SSD |
| **Mastra Support** | Natively supported via `@mastra/deployer-cloudflare` | Standard Docker build | Node PM2 or Docker setup |
| **Recommendation**| **🥇 Strongly Recommended (Fastest & Cheapest)** | 🥈 Secondary choice (for heavy file storage) | ❌ Not recommended (high maintenance) |

---

## 2. Storage & Database Architecture for Edge Runtimes

Since Cloudflare Workers cannot write to a local SQLite file (`mastra.db`), we must adapt the database storage layer. Mastra supports two main solutions:

```
                            ┌────────────────────────┐
                            │   Cloudflare Worker    │
                            │ (Mastra Engine Node.js)│
                            └─────┬────────────┬─────┘
                                  │            │
             Option A: HTTP API   │            │ Option B: Cloudflare Binding
                                  ▼            ▼
                            ┌───────────┐┌───────────┐
                            │   Turso   ││    D1     │
                            │ (LibSQL)  ││ (SQL DB)  │
                            └───────────┘└───────────┘
```

### Option A: Turso (Remote LibSQL) — *Recommended for zero code change*
Turso is a distributed database built on `libSQL` (SQLite fork). It allows us to continue using the existing `@mastra/libsql` package.
*   **Pros**: No code syntax adjustments needed. Workflows and agents persist transparently. Generous free tier (500 databases, 9GB storage).
*   **Cons**: Minor network hop latency (minimized by Turso edge replication).
*   **Code Config**:
    ```typescript
    import { LibSQLStore } from '@mastra/libsql';

    const storage = new LibSQLStore({
      url: process.env.TURSO_DATABASE_URL!, // e.g. libsql://your-db.turso.io
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    ```

### Option B: Cloudflare D1 — *Recommended for native performance*
D1 is Cloudflare's serverless SQL database running natively within the Workers network.
*   **Pros**: Ultra-low latency (runs directly in the worker isolate context). Zero extra bills (included in Workers subscription).
*   **Cons**: Requires installing `@mastra/cloudflare-d1` and switching the storage adapter. Doesn't support full observability traces currently.
*   **Code Config**:
    ```typescript
    import { D1Store } from '@mastra/cloudflare-d1';

    // inside constructor where env is available
    const storage = new D1Store({ db: env.DB });
    ```

---

## 3. Step-by-Step Cloudflare + Turso Deployment Blueprint

Here is the plan to deploy the Mastra app using the **Turso** database path:

### Step 1: Initialize Turso Database
1. Sign up/install the Turso CLI and create a database:
   ```bash
   turso db create gtm-agent-db
   ```
2. Retrieve the connection credentials:
   ```bash
   turso db show gtm-agent-db --url
   turso db tokens create gtm-agent-db
   ```

### Step 2: Configure Cloudflare Deployer in Mastra
Update your [mastra/src/mastra/index.ts](file:///Users/miczhuang/Code/AI/gtm-agent/mastra/src/mastra/index.ts) configuration:

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

// Setup Cloudflare deployer config
const deployer = new CloudflareDeployer({
  name: 'gtm-agent-mastra',
  compatibility_date: '2025-04-01',
  compatibility_flags: ['nodejs_compat'],
});

const storage = new LibSQLStore({
  url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const mastra = new Mastra({
  deployer,
  storage,
  agents: { ... },
  workflows: { ... },
});
```

### Step 3: Bundle & Deploy
1. Compile the app and generate the Cloudflare config:
   ```bash
   make mastra-prd
   ```
2. Upload deployment secrets (LLM keys, Turso tokens):
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put TURSO_DATABASE_URL
   npx wrangler secret put TURSO_AUTH_TOKEN
   ```
3. Publish to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```

---

## 4. Key Architectural Decisions Needed

1. **Which database option do you prefer?**
   - **Turso**: Easiest migration, keeps existing SQLite code.
   - **Cloudflare D1**: Lowest latency, but requires database migration config steps.
2. **How to handle Sandbox/Execution tools in Cloud?**
   - Headless Playwright crawling and file compilation (Sandboxing) cannot run inside a lightweight V8 worker sandbox directly.
   - We must delegating heavy browser/compilation tools to a separate microservice (like a Cloud Run container running Playwright, or using browser services like Browserless.io).
