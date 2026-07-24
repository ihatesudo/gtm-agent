#!/usr/bin/env node
// Reads skills/**/*.md from the project root and outputs skills-registry.json
// Run before mastra build: node scripts/bundle-skills.mjs

import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SKILLS_DIR = join(ROOT, 'skills');
const OUT = resolve(import.meta.dirname, '..', 'src', 'mastra', 'skills-registry.json');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const registry = {};
const entries = await readdir(SKILLS_DIR, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const skillName = entry.name;
  const skillMd = join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!await exists(skillMd)) continue;

  const content = await readFile(skillMd, 'utf-8');
  const descMatch = content.match(/description:\s*"([^"]+)"/);
  const description = descMatch ? descMatch[1] : '(no description)';

  // Also collect reference files
  const refsDir = join(SKILLS_DIR, skillName, 'references');
  const refs = {};
  if (await exists(refsDir)) {
    const refFiles = await readdir(refsDir);
    for (const rf of refFiles) {
      if (rf.endsWith('.md') || rf.endsWith('.txt')) {
        refs[rf] = await readFile(join(refsDir, rf), 'utf-8');
      }
    }
  }

  registry[skillName] = { description, content, refs };
  console.log(`  bundled: ${skillName} (${Object.keys(refs).length} refs)`);
}

await writeFile(OUT, JSON.stringify(registry, null, 2), 'utf-8');
console.log(`\n✓ skills-registry.json written (${Object.keys(registry).length} skills)`);
