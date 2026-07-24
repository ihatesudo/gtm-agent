import { createClient } from '@libsql/client';
import { z } from 'zod';

export const ProjectSchema = z.object({
  projectId: z.string(),
  productName: z.string(),
  icpDescription: z.string(),
  brandVoice: z.string(),
  targetMarket: z.string(),
  pastCampaigns: z.array(z.object({
    name: z.string(),
    date: z.string(),
    channels: z.array(z.string()),
    results: z.string(),
  })),
  keyDecisions: z.array(z.object({
    date: z.string(),
    decision: z.string(),
    rationale: z.string(),
  })),
  goals: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectMemory = z.infer<typeof ProjectSchema>;

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function ensureTable() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function getProject(projectId: string): Promise<ProjectMemory | null> {
  await ensureTable();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT data FROM projects WHERE project_id = ?',
    args: [projectId],
  });
  if (result.rows.length === 0) return null;
  return JSON.parse(result.rows[0].data as string) as ProjectMemory;
}

export async function listProjects(): Promise<ProjectMemory[]> {
  await ensureTable();
  const db = getDb();
  const result = await db.execute('SELECT data FROM projects ORDER BY updated_at DESC');
  return result.rows.map(r => JSON.parse(r.data as string) as ProjectMemory);
}

export async function saveProject(project: ProjectMemory): Promise<void> {
  await ensureTable();
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await getProject(project.projectId);
  const toSave: ProjectMemory = {
    ...project,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.execute({
    sql: `INSERT INTO projects (project_id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [toSave.projectId, JSON.stringify(toSave), toSave.createdAt, toSave.updatedAt],
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await ensureTable();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM projects WHERE project_id = ?', args: [projectId] });
}

export async function updateProjectContext(
  projectId: string,
  updates: Partial<ProjectMemory>,
): Promise<ProjectMemory | null> {
  const existing = await getProject(projectId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await saveProject(updated);
  return updated;
}

export async function addCampaignToProject(
  projectId: string,
  campaign: { name: string; channels: string[]; results: string },
): Promise<ProjectMemory | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const updated: ProjectMemory = {
    ...project,
    pastCampaigns: [...project.pastCampaigns, { ...campaign, date: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
  await saveProject(updated);
  return updated;
}

export async function addDecisionToProject(
  projectId: string,
  decision: { decision: string; rationale: string },
): Promise<ProjectMemory | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const updated: ProjectMemory = {
    ...project,
    keyDecisions: [...project.keyDecisions, { ...decision, date: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
  await saveProject(updated);
  return updated;
}

export async function findProjectByProduct(productName: string): Promise<ProjectMemory | null> {
  const all = await listProjects();
  return all.find(p => p.productName.toLowerCase() === productName.toLowerCase()) ?? null;
}

export function formatProjectContext(project: ProjectMemory): string {
  return `## Project: ${project.productName}

### Product
${project.productName} — ${project.icpDescription}

### Market
${project.targetMarket}

### Brand Voice
${project.brandVoice}

### Active Goals
${project.goals.map(g => `- ${g}`).join('\n')}

### Past Campaigns
${project.pastCampaigns.length > 0
    ? project.pastCampaigns.map(c => `- **${c.name}** (${c.date}): ${c.channels.join(', ')} — ${c.results}`).join('\n')
    : '(none yet)'}

### Key Decisions
${project.keyDecisions.length > 0
    ? project.keyDecisions.map(d => `- ${d.date}: ${d.decision} (${d.rationale})`).join('\n')
    : '(none yet)'}`;
}
