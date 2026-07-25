import { Mastra } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { LibSQLStore } from '@mastra/libsql';
import { directorAgent } from './agents/director.js';
import { ALL_SPECIALIST_AGENTS } from './agents/specialists.js';
import { campaignWorkflow } from './workflows/campaign-workflow.js';
import { ALL_GTM_TOOLS } from './tools/gtm-tools.js';
import { getCachedConnectivity } from './healthCheck.js';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Keep Worker-specific configuration beside the Mastra app. `mastra build`
// uses this to generate the Worker entrypoint and Wrangler configuration.
const deployer = new CloudflareDeployer({
  name: 'gtm-agent-mastra',
  compatibility_date: '2026-07-24',
  compatibility_flags: ['nodejs_compat'],
  assets: {
    // Wrangler resolves asset paths from the generated config directory
    // (`.mastra/output`), so the bundled UI is simply its `studio` sibling.
    directory: 'studio',
    not_found_handling: 'single-page-application',
  },
  r2_buckets: [{
    binding: 'ASSETS_BUCKET',
    bucket_name: 'gtm-agent-assets',
    preview_bucket_name: 'gtm-agent-assets-preview',
  }],
  browser: { binding: 'BROWSER' },
  vars: {
    DIRECTOR_MODEL: 'google/gemini-2.5-flash',
    SPECIALIST_MODEL: 'google/gemini-2.5-flash-lite-preview-06-17',
  },
});

export const mastra = new Mastra({
  deployer,
  storage,
  // Mastra turns the incoming request's `requestContext` into the context
  // received by every tool. Attach Worker bindings there, rather than putting
  // them in module globals (which would leak across concurrent requests).
  server: {
    middleware: async (c, next) => {
      if (c.req.path === '/api/providers/status') {
        // Real zero-token connectivity probe of the active provider
        // (cached 60s). Merges Worker bindings over process.env.
        return c.json(await getCachedConnectivity(c.env || {}));
      }
      const requestContext = c.get('requestContext') as { set: (key: string, value: unknown) => void };
      if (requestContext?.set) {
        requestContext.set('cloudflareBindings', c.env);
      }
      await next();
    },
  },
  agents: {
    directorAgent,
    ...ALL_SPECIALIST_AGENTS,
  },
  tools: ALL_GTM_TOOLS,
  workflows: {
    campaignWorkflow,
  },
});
