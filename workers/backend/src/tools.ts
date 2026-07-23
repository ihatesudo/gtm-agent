import type { Env } from './types';
import { listSkills, findSkill, shortDescription } from './skills';
import { listRoles } from './roles';

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const ALL_TOOL_DEFS: ToolDef[] = [
  {
    name: 'web_search',
    description: 'Search the web for the latest pages and return a few result summaries. Use this for scenarios that need real-time information: competitive research, market trends, keyword popularity, industry data, etc.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search keywords' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_asset',
    description: 'Save a piece of marketing output (copy, strategy doc, keyword list, etc.) to persistent storage. A .md suffix is recommended. Call once after producing complete output.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The file name, e.g. "launch-copy.md". Bare name only — no path.' },
        content: { type: 'string', description: 'The full content to write.' },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'read_asset',
    description: 'Read the contents of a previously saved marketing asset file.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'A file name in the asset storage.' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'list_assets',
    description: 'List all saved marketing asset file names.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_skills',
    description: 'List every available marketing skill by name with short description. Useful to discover what playbooks exist.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_skill_reference',
    description: 'Load a deeper playbook file content for a skill. Use when the active skill playbook mentions files under its references/ folder.',
    parameters: {
      type: 'object',
      properties: {
        skill_name: { type: 'string', description: 'The skill name.' },
        filename: { type: 'string', description: 'The reference filename.' },
      },
      required: ['skill_name', 'filename'],
    },
  },
  {
    name: 'read_tool_guide',
    description: 'Read a marketing-platform integration guide from the tools/integrations folder.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The guide filename, e.g. "ahrefs.md".' },
      },
      required: ['filename'],
    },
  },
];

interface ToolResult {
  success: boolean;
  output: string;
}

async function webSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GTM-Agent/1.0)' },
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
    return results.length ? results.join('\n') : '(no results found)';
  } catch (err) {
    return `[web_search failed: ${err}]`;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

async function saveAsset(filename: string, content: string, env: Env): Promise<string> {
  const name = filename.split('/').pop() || filename;
  if (!name) return '[Invalid filename]';
  await env.ASSETS_BUCKET.put(name, content);
  return `Saved to assets/${name} (${content.length} chars)`;
}

async function readAsset(filename: string, env: Env): Promise<string> {
  const name = filename.split('/').pop() || filename;
  if (!name) return '[Invalid filename]';
  const obj = await env.ASSETS_BUCKET.get(name);
  if (!obj) return `[File not found: ${filename}]`;
  return await obj.text();
}

async function listAssets(env: Env): Promise<string> {
  const objects = await env.ASSETS_BUCKET.list();
  if (!objects.objects.length) return '(no saved assets yet)';
  return objects.objects.map(o => o.key).sort().join('\n');
}

async function listSkillsTool(): Promise<string> {
  const skills = listSkills();
  if (!skills.length) return '(no skills installed)';
  return skills.map(s => `${s.name} — ${shortDescription(s.description)}`).join('\n');
}

async function readSkillReference(skillName: string, filename: string): Promise<string> {
  const skill = findSkill(skillName);
  if (!skill) return `[Unknown skill: ${skillName}]`;
  return `[Skill references are bundled in the skill body. Check the active skill playbook for embedded references.]`;
}

async function readToolGuide(filename: string): Promise<string> {
  return `[Tool guides are available in the tools/integrations folder. This feature requires KV storage for full support.]`;
}

export type ToolHandler = (args: Record<string, unknown>, env: Env) => Promise<string>;

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  web_search: async (args) => webSearch(String(args.query || '')),
  save_asset: async (args, env) => saveAsset(String(args.filename || ''), String(args.content || ''), env),
  read_asset: async (args, env) => readAsset(String(args.filename || ''), env),
  list_assets: async (_args, env) => listAssets(env),
  list_skills: async () => listSkillsTool(),
  read_skill_reference: async (args) => readSkillReference(String(args.skill_name || ''), String(args.filename || '')),
  read_tool_guide: async (args) => readToolGuide(String(args.filename || '')),
};

export async function executeTool(name: string, args: Record<string, unknown>, env: Env): Promise<string> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return `[Unknown tool: ${name}]`;
  try {
    return await handler(args, env);
  } catch (err) {
    return `[Tool ${name} failed: ${err}]`;
  }
}
