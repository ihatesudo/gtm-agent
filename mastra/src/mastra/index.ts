import { Mastra } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, ConsoleExporter } from '@mastra/observability';
import { MastraEditor } from '@mastra/editor';
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

export const editor = new MastraEditor({
  source: 'db',
});

// Trace to the console instead of the storage layer. MastraStorageExporter
// calls `observabilityStorage.batchCreateLogs(...)`, which LibSQLStore does not
// implement — that threw "storage provider does not support batch creating
// logs" on every request and surfaced as a mid-stream `TypeError: unusable`.
// ConsoleExporter keeps telemetry visible without touching storage.
export const observability = new Observability({
  configs: {
    default: {
      serviceName: 'gtm-agent',
      exporters: [new ConsoleExporter()],
    },
  },
});

export const mastra = new Mastra({
  deployer,
  storage,
  editor,
  observability,
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

      // Observability telemetry API for UI dashboard & trace logs
      if (c.req.path === '/api/observability/telemetry') {
        try {
          const telemetryStore = await storage.getStore('observability');
          const logRes = telemetryStore ? await telemetryStore.listLogs({ limit: 50 }).catch(() => null) : null;
          const traceRes = telemetryStore ? await telemetryStore.listTraces({ limit: 50 }).catch(() => null) : null;
          const logs = logRes?.logs || [];
          const spans = traceRes?.spans || [];
          return c.json({
            enabled: true,
            serviceName: 'gtm-agent',
            tracesCount: spans.length,
            logsCount: logs.length,
            recentTraces: spans.slice(0, 20),
            recentLogs: logs.slice(0, 30),
          });
        } catch (e: any) {
          return c.json({ enabled: true, serviceName: 'gtm-agent', tracesCount: 0, logsCount: 0, recentTraces: [], recentLogs: [], error: String(e?.message || e) });
        }
      }

      // Editor API endpoint for stored agent instructions & prompt blocks
      if (c.req.path === '/api/editor/agent-overrides') {
        try {
          const storedAgents = await editor.agent.list();
          return c.json({ storedAgents });
        } catch (e: any) {
          return c.json({ storedAgents: [], error: String(e?.message || e) });
        }
      }

      if (c.req.path.startsWith('/api/editor/agent-overrides/') && c.req.method === 'POST') {
        const agentId = c.req.path.replace('/api/editor/agent-overrides/', '');
        const body = await c.req.json().catch(() => ({}));
        try {
          const updated = await editor.agent.update({
            id: agentId,
            instructions: body.instructions,
          });
          return c.json({ success: true, updated });
        } catch (e: any) {
          // If creation needed instead of update
          try {
            const created = await editor.agent.create({
              id: agentId,
              name: body.name || agentId,
              model: { provider: 'google', name: 'gemini-2.5-flash' },
              instructions: body.instructions || '',
            });
            return c.json({ success: true, created });
          } catch (createErr: any) {
            return c.json({ success: false, error: String(createErr?.message || createErr) }, 400);
          }
        }
      }

      const requestContext = c.get('requestContext') as { set: (key: string, value: unknown) => void };
      if (requestContext?.set) {
        requestContext.set('cloudflareBindings', c.env);
        // Thread the UI's runtime model choice into requestContext
        if (c.req.method === 'POST') {
          const body = await c.req.json().catch(() => null as null | Record<string, unknown>);
          if (body && typeof body.modelChoice === 'string') {
            requestContext.set('modelChoice', body.modelChoice);
          }
        }
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

