import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DATA_DIR = resolve(import.meta.dirname, '..', 'src', 'data');

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function asStr(v: unknown): string {
  return v != null ? String(v).trim() : '';
}

function asArr(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return v.split(/[,\s]+/).filter(Boolean);
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return [];
}

// --- Roles ---
function generateRoles() {
  const rolesDir = join(ROOT, 'roles');
  const roles: any[] = [];
  for (const f of readdirSync(rolesDir).filter(f => f.endsWith('.yaml'))) {
    const raw = parse(readFileSync(join(rolesDir, f), 'utf-8'));
    const block = raw?.role;
    if (!block) continue;
    roles.push({
      name: asStr(block.name),
      title: asStr(block.title),
      persona: asStr(block.persona),
      coreFocus: asStr(block.core_focus),
      tags: asArr(block.tags),
      orchestrates: asArr(block.orchestrates),
      ownedSkills: asArr(block.owned_skills),
      sharedSkills: asArr(block.shared_skills),
      preferredTools: asArr(block.preferred_tools),
      whenToUse: asStr(block.when_to_use),
    });
  }
  roles.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA_DIR, 'roles.json'), JSON.stringify(roles, null, 2));
  console.log(`Generated ${roles.length} roles`);
}

// --- Skills ---
function splitFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const lines = text.split('\n');
  if (!lines[0]?.trim()?.startsWith('---')) return { meta: {}, body: text };
  let end = lines.length;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  const meta: Record<string, string> = {};
  let inMeta = false;
  for (let i = 1; i < end; i++) {
    const s = lines[i].trim();
    if (!s || s.startsWith('#')) continue;
    if (s === 'metadata:') { inMeta = true; continue; }
    const idx = s.indexOf(':');
    if (idx === -1) { inMeta = false; continue; }
    const key = s.slice(0, idx).trim();
    let val = s.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (inMeta && key === 'version') meta.version = val;
    else if (key === 'name' || key === 'description') meta[key] = val;
  }
  const body = lines.slice(end + 1).join('\n').trimStart();
  return { meta, body };
}

function generateSkills() {
  const skillsDir = join(ROOT, 'skills');
  const skills: any[] = [];
  for (const dir of readdirSync(skillsDir)) {
    const skillMdPath = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;
    const text = readFileSync(skillMdPath, 'utf-8');
    const { meta, body } = splitFrontmatter(text);
    skills.push({
      name: meta.name || dir,
      description: (meta.description || '').trim(),
      version: (meta.version || '').trim(),
      body,
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA_DIR, 'skills.json'), JSON.stringify(skills, null, 2));
  console.log(`Generated ${skills.length} skills`);
}

// --- Providers ---
function generateProviders() {
  const provDir = join(ROOT, 'providers');
  if (!existsSync(provDir)) { writeFileSync(join(DATA_DIR, 'providers.json'), '[]'); return; }
  const providers: any[] = [];
  for (const f of readdirSync(provDir).filter(f => f.endsWith('.yaml'))) {
    const raw = parse(readFileSync(join(provDir, f), 'utf-8'));
    const block = raw?.provider;
    if (!block) continue;
    providers.push({
      name: asStr(block.name),
      title: asStr(block.title),
      description: asStr(block.description),
      baseUrl: asStr(block.base_url),
      model: asStr(block.model),
      apiKeyEnv: asStr(block.api_key_env),
      capabilities: block.capabilities || {},
      currency: asStr(block.currency) || 'CNY',
      website: asStr(block.website),
    });
  }
  providers.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA_DIR, 'providers.json'), JSON.stringify(providers, null, 2));
  console.log(`Generated ${providers.length} providers`);
}

ensureDir(DATA_DIR);
generateRoles();
generateSkills();
generateProviders();
