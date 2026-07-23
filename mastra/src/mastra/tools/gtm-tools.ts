import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const OUTPUT_DIR = path.resolve('output');

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

function stripHtml(html: string): string {
  return html
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
  execute: async ({ filename, content }) => {
    const name = path.basename(filename);
    if (!name) return { output: '[Invalid filename]' };
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const filePath = path.join(OUTPUT_DIR, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return { output: `Saved to ${filePath} (${content.length} chars)` };
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
  execute: async ({ filename }) => {
    const name = path.basename(filename);
    if (!name) return { output: '[Invalid filename]' };
    const filePath = path.join(OUTPUT_DIR, name);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { output: content };
    } catch {
      return { output: `[File not found: ${filename}]` };
    }
  },
});

export const listAssetsTool = createTool({
  id: 'list_assets',
  description: 'List all saved marketing asset file names.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    try {
      const files = await fs.readdir(OUTPUT_DIR);
      const names = files.filter(f => f !== '.gitkeep').sort();
      return { output: names.length ? names.join('\n') : '(no saved assets yet)' };
    } catch {
      return { output: '(no saved assets yet)' };
    }
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
    const skillsDir = path.resolve('skills');
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const lines: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
          try {
            const content = await fs.readFile(skillMd, 'utf-8');
            const descMatch = content.match(/description:\s*"([^"]+)"/);
            const desc = descMatch ? descMatch[1] : '(no description)';
            lines.push(`${entry.name} — ${desc}`);
          } catch {
            lines.push(`${entry.name} — (no SKILL.md)`);
          }
        }
      }
      return { output: lines.length ? lines.join('\n') : '(no skills installed)' };
    } catch {
      return { output: '(no skills installed)' };
    }
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
  execute: async ({ skill_name, filename }) => {
    const refPath = path.resolve('skills', skill_name, 'references', path.basename(filename));
    try {
      const content = await fs.readFile(refPath, 'utf-8');
      return { output: content };
    } catch {
      return { output: `[Reference not found: ${skill_name}/references/${filename}]` };
    }
  },
});

export const readToolGuideTool = createTool({
  id: 'read_tool_guide',
  description: 'Read a marketing-platform integration guide from the tools/integrations folder.',
  inputSchema: z.object({
    filename: z.string().describe('The guide filename, e.g. "ahrefs.md".'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ filename }) => {
    const guidePath = path.resolve('tools', 'integrations', path.basename(filename));
    try {
      const content = await fs.readFile(guidePath, 'utf-8');
      return { output: content };
    } catch {
      return { output: `[Tool guide not found: tools/integrations/${filename}]` };
    }
  },
});

export const ALL_GTM_TOOLS = {
  webSearchTool,
  saveAssetTool,
  readAssetTool,
  listAssetsTool,
  listSkillsTool,
  readSkillReferenceTool,
  readToolGuideTool,
};
