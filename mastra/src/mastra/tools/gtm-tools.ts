import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import skillsRegistry from '../skills-registry.json';
import { getAssetStore, type AssetStore, type R2Bucket } from '../storage/asset-store.js';
import {
  getProject,
  saveProject,
  updateProjectContext,
  addCampaignToProject,
  addDecisionToProject,
  formatProjectContext,
  ProjectMemory,
} from '../memory/project-memory.js';

type SkillsRegistry = Record<string, { description: string; content: string; refs: Record<string, string> }>;
const registry = skillsRegistry as SkillsRegistry;

function filename(value: string): string | null {
  const name = value.split(/[\\/]/).pop()?.trim() ?? '';
  return name && name === value ? name : null;
}

function requestAssetStore(context: unknown): AssetStore {
  const requestContext = (context as { requestContext?: { get?: (key: string) => unknown } })?.requestContext;
  const bindings = requestContext?.get?.('cloudflareBindings') as { ASSETS_BUCKET?: R2Bucket } | undefined;
  return getAssetStore(bindings);
}

export const webSearchTool = createTool({
  id: 'web_search',
  description: 'Search the web for the latest pages and return a few result summaries. Use for competitive research, market trends, keyword popularity, and industry data.',
  inputSchema: z.object({
    query: z.string().describe('The search keywords'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ query }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GTM-Agent-Mastra/1.0)' },
      });
      const html = await res.text();
      const results: string[] = [];
      const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      const links: string[] = [];
      const snippets: string[] = [];
      let m;
      while ((m = linkRe.exec(html)) !== null) {
        links.push(`${stripHtml(m[2]).trim()} — ${m[1]}`);
      }
      while ((m = snippetRe.exec(html)) !== null) {
        snippets.push(stripHtml(m[1]).trim());
      }
      for (let i = 0; i < Math.min(links.length, 8); i++) {
        results.push(`${i + 1}. ${links[i]}${snippets[i] ? '\n   ' + snippets[i] : ''}`);
      }
      return { output: results.length ? results.join('\n') : '(no results found)' };
    } catch (err) {
      return { output: `[web_search failed: ${err}]` };
    }
  },
});

export const webFetchTool = createTool({
  id: 'web_fetch',
  description: 'Open a specific public HTTP or HTTPS URL and return its readable page text. Use this when the user provides a URL or asks about a specific website, instead of claiming that external websites are inaccessible.',
  inputSchema: z.object({
    url: z.string().describe('The full public URL to open, including https:// when possible'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ url }) => {
    try {
      const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const parsed = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { output: '[web_fetch failed: only HTTP and HTTPS URLs are supported]' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(parsed, {
          headers: {
            Accept: 'text/html, text/plain, application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0 (compatible; GTM-Agent-Mastra/1.0)',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        const body = await res.text();
        const contentType = res.headers.get('content-type') || '';
        const text = contentType.includes('html') ? stripHtml(body) : body;
        const readable = text.replace(/\s+/g, ' ').trim().slice(0, 16000);
        if (!res.ok) return { output: `[web_fetch ${res.status} ${res.statusText}] ${readable}`.trim() };
        return { output: readable || '(page returned no readable text)' };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      return { output: `[web_fetch failed: ${err instanceof Error ? err.message : String(err)}]` };
    }
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

export const saveAssetTool = createTool({
  id: 'save_asset',
  description: 'Save a piece of marketing output (copy, strategy doc, keyword list) to persistent storage. A .md suffix is recommended.',
  inputSchema: z.object({
    filename: z.string().describe('The file name, e.g. "launch-copy.md". Bare name only — no path.'),
    content: z.string().describe('The full content to write.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ filename: requestedFilename, content }, context) => {
    const name = filename(requestedFilename);
    if (!name) return { output: '[Invalid filename]' };
    await requestAssetStore(context).put(name, content);
    return { output: `Saved ${name} (${content.length} chars)` };
  },
});

export const readAssetTool = createTool({
  id: 'read_asset',
  description: 'Read the contents of a previously saved marketing asset file.',
  inputSchema: z.object({
    filename: z.string().describe('A file name in the output directory.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ filename: requestedFilename }, context) => {
    const name = filename(requestedFilename);
    if (!name) return { output: '[Invalid filename]' };
    const content = await requestAssetStore(context).get(name);
    return { output: content ?? `[File not found: ${requestedFilename}]` };
  },
});

export const listAssetsTool = createTool({
  id: 'list_assets',
  description: 'List all saved marketing asset file names.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async (_input, context) => {
    const assets = await requestAssetStore(context).list();
    return { output: assets.length ? assets.map((asset) => asset.filename).join('\n') : '(no saved assets yet)' };
  },
});

export const listSkillsTool = createTool({
  id: 'list_skills',
  description: 'List every available marketing skill by name with short description.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    const lines = Object.entries(registry).map(([name, skill]) => `${name} — ${skill.description}`);
    return { output: lines.length ? lines.join('\n') : '(no skills installed)' };
  },
});

export const readSkillReferenceTool = createTool({
  id: 'read_skill_reference',
  description: 'Load a deeper playbook file content for a skill.',
  inputSchema: z.object({
    skill_name: z.string().describe('The skill name.'),
    filename: z.string().describe('The reference filename from the skill\'s references/ folder.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ skill_name, filename: requestedFilename }) => {
    const skill = registry[skill_name];
    if (!skill) return { output: `[Skill not found: ${skill_name}]` };
    const ref = skill.refs[filename(requestedFilename) ?? ''];
    return { output: ref ?? `[Reference not found: ${skill_name}/references/${requestedFilename}]` };
  },
});


export const getProjectContextTool = createTool({
  id: 'get_project_context',
  description: 'Retrieve the marketing project context (product details, target market, ICP description, brand voice, past campaigns, and key decisions) for a given project ID.',
  inputSchema: z.object({
    projectId: z.string().describe('The unique identifier of the project.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ projectId }) => {
    const project = await getProject(projectId);
    if (!project) {
      return { output: `Project with ID "${projectId}" not found.` };
    }
    return { output: formatProjectContext(project) };
  },
});

export const updateProjectContextTool = createTool({
  id: 'update_project_context',
  description: 'Initialize or update the core parameters of a marketing project (product name, ICP description, brand voice, target market, and goals).',
  inputSchema: z.object({
    projectId: z.string().describe('The unique identifier of the project.'),
    productName: z.string().optional().describe('Name of the product.'),
    icpDescription: z.string().optional().describe('Ideal Customer Profile description.'),
    brandVoice: z.string().optional().describe('Tone and style guidelines.'),
    targetMarket: z.string().optional().describe('Target demographic or geographic market.'),
    goals: z.array(z.string()).optional().describe('List of strategic goals.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ projectId, productName, icpDescription, brandVoice, targetMarket, goals }) => {
    const existing = await getProject(projectId);
    const updatedProject: ProjectMemory = {
      projectId,
      productName: productName ?? existing?.productName ?? '',
      icpDescription: icpDescription ?? existing?.icpDescription ?? '',
      brandVoice: brandVoice ?? existing?.brandVoice ?? '',
      targetMarket: targetMarket ?? existing?.targetMarket ?? '',
      goals: goals ?? existing?.goals ?? [],
      pastCampaigns: existing?.pastCampaigns ?? [],
      keyDecisions: existing?.keyDecisions ?? [],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProject(updatedProject);
    return { output: `Project context updated successfully:\n${formatProjectContext(updatedProject)}` };
  },
});

export const recordProjectCampaignTool = createTool({
  id: 'record_project_campaign',
  description: 'Record a new marketing campaign run under the project context (name, channels used, and results/outcomes).',
  inputSchema: z.object({
    projectId: z.string().describe('The unique identifier of the project.'),
    name: z.string().describe('Name of the campaign.'),
    channels: z.array(z.string()).describe('Channels targeted, e.g. ["google-ads", "email"].'),
    results: z.string().describe('Outcome of the campaign, e.g. "15% increase in conversions".'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ projectId, name, channels, results }) => {
    const updated = await addCampaignToProject(projectId, { name, channels, results });
    if (!updated) {
      return { output: `Failed to record campaign. Project with ID "${projectId}" not found.` };
    }
    return { output: `Campaign recorded successfully. New project context:\n${formatProjectContext(updated)}` };
  },
});

export const recordProjectDecisionTool = createTool({
  id: 'record_project_decision',
  description: 'Record a key strategic marketing decision under the project context for future alignment.',
  inputSchema: z.object({
    projectId: z.string().describe('The unique identifier of the project.'),
    decision: z.string().describe('The strategic decision that was made.'),
    rationale: z.string().describe('The reasoning or justification for the decision.'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ projectId, decision, rationale }) => {
    const updated = await addDecisionToProject(projectId, { decision, rationale });
    if (!updated) {
      return { output: `Failed to record decision. Project with ID "${projectId}" not found.` };
    }
    return { output: `Decision recorded successfully. New project context:\n${formatProjectContext(updated)}` };
  },
});

export const ALL_GTM_TOOLS = {
  webSearchTool,
  webFetchTool,
  saveAssetTool,
  readAssetTool,
  listAssetsTool,
  listSkillsTool,
  readSkillReferenceTool,
  getProjectContextTool,
  updateProjectContextTool,
  recordProjectCampaignTool,
  recordProjectDecisionTool,
};
