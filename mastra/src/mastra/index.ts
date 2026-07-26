import { Mastra } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { Observability, ConsoleExporter } from '@mastra/observability';
import { MastraEditor } from '@mastra/editor';
import { directorAgent } from './agents/director.js';
import { directorMemory } from './agents/director.js';
import { ALL_SPECIALIST_AGENTS } from './agents/specialists.js';
import { campaignWorkflow } from './workflows/campaign-workflow.js';
import { ALL_GTM_TOOLS } from './tools/gtm-tools.js';
import { getCachedConnectivity } from './healthCheck.js';
import { sharedStorage as storage } from './storage/store.js';
import { listConversations, setThreadCSAT, type AdminMemory } from './admin/conversations.js';
import { classifyIntent } from './intent/classifier.js';
import { logRoutingDecision } from './intent/logging.js';
import { listFaqs, upsertFaq, deleteFaq } from './memory/faq-store.js';

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
    SPECIALIST_MODEL: 'google/gemini-2.5-flash',
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

      // Admin read-only API: list conversations with message counts + CSAT.
      // CSAT rides on thread metadata (zero schema change). directorMemory is
      // persisted to the shared LibSQL store, so this reads real history.
      if (c.req.path === '/api/admin/conversations') {
        try {
          const perPage = Number(c.req.query('perPage') ?? 100);
          const result = await listConversations(directorMemory as unknown as AdminMemory, { perPage });
          return c.json(result);
        } catch (e: any) {
          return c.json({ conversations: [], total: 0, error: String(e?.message || e) });
        }
      }

      // Write CSAT for a thread. Body: { threadId, rating(1-5), comment? }
      if (c.req.path === '/api/admin/csat' && c.req.method === 'POST') {
        const body = await c.req.json().catch(() => ({}));
        try {
          await setThreadCSAT(directorMemory as unknown as AdminMemory, {
            threadId: body.threadId,
            rating: Number(body.rating),
            comment: body.comment,
          });
          return c.json({ success: true });
        } catch (e: any) {
          return c.json({ success: false, error: String(e?.message || e) }, 400);
        }
      }

      // Admin FAQ API: list / create / delete curated knowledge-base entries.
      if (c.req.path === '/api/admin/faqs' && c.req.method === 'GET') {
        try {
          const faqs = await listFaqs();
          return c.json({ faqs, total: faqs.length });
        } catch (e: any) {
          return c.json({ faqs: [], total: 0, error: String(e?.message || e) });
        }
      }
      if (c.req.path === '/api/admin/faqs' && c.req.method === 'POST') {
        const body = await c.req.json().catch(() => ({}));
        try {
          if (!body.id || !body.question || !body.answer) {
            return c.json({ success: false, error: 'id, question, answer are required' }, 400);
          }
          const now = new Date().toISOString();
          await upsertFaq({
            id: String(body.id),
            question: String(body.question),
            answer: String(body.answer),
            tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
            source: typeof body.source === 'string' ? body.source : 'admin',
            createdAt: now,
            updatedAt: now,
          });
          return c.json({ success: true });
        } catch (e: any) {
          return c.json({ success: false, error: String(e?.message || e) }, 400);
        }
      }
      if (c.req.path.startsWith('/api/admin/faqs/') && c.req.method === 'DELETE') {
        const id = c.req.path.replace('/api/admin/faqs/', '');
        try {
          await deleteFaq(id);
          return c.json({ success: true });
        } catch (e: any) {
          return c.json({ success: false, error: String(e?.message || e) }, 400);
        }
      }

      const requestContext = c.get('requestContext') as { set: (key: string, value: unknown) => void };
      if (requestContext?.set) {
        requestContext.set('cloudflareBindings', c.env);
        // Thread the UI's runtime model choice + classified intent into requestContext.
        if (c.req.method === 'POST') {
          const body = await c.req.raw.clone().json().catch(() => null as null | Record<string, unknown>);
          if (body && typeof body.modelChoice === 'string') {
            requestContext.set('modelChoice', body.modelChoice);
          }
          // Classify the user's latest message for routing observability.
          // Pure + deterministic; logged to the dev console. Does not change
          // routing — the Director still decides via its LLM tool-calling.
          if (body && Array.isArray(body.messages)) {
            const lastUser = [...body.messages].reverse().find((m: any) => m?.role === 'user');
            const text = typeof lastUser?.content === 'string' ? lastUser.content : '';
            if (text) {
              const decision = classifyIntent(text);
              const threadId = (body as any)?.memory?.thread as string | undefined;
              requestContext.set('intent', decision);
              void logRoutingDecision({ threadId: threadId ?? '-', userText: text.slice(0, 120), decision });
            }
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

