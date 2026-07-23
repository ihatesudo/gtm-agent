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

const projectStore = new Map<string, ProjectMemory>();

export function getProject(projectId: string): ProjectMemory | null {
  return projectStore.get(projectId) ?? null;
}

export function listProjects(): ProjectMemory[] {
  return Array.from(projectStore.values());
}

export function saveProject(project: ProjectMemory): void {
  const existing = projectStore.get(project.projectId);
  projectStore.set(project.projectId, {
    ...project,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function deleteProject(projectId: string): void {
  projectStore.delete(projectId);
}

export function updateProjectContext(
  projectId: string,
  updates: Partial<ProjectMemory>,
): ProjectMemory | null {
  const existing = projectStore.get(projectId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  projectStore.set(projectId, updated);
  return updated;
}

export function addCampaignToProject(
  projectId: string,
  campaign: { name: string; channels: string[]; results: string },
): ProjectMemory | null {
  const project = projectStore.get(projectId);
  if (!project) return null;
  project.pastCampaigns.push({
    ...campaign,
    date: new Date().toISOString(),
  });
  project.updatedAt = new Date().toISOString();
  return project;
}

export function addDecisionToProject(
  projectId: string,
  decision: { decision: string; rationale: string },
): ProjectMemory | null {
  const project = projectStore.get(projectId);
  if (!project) return null;
  project.keyDecisions.push({
    ...decision,
    date: new Date().toISOString(),
  });
  project.updatedAt = new Date().toISOString();
  return project;
}

export function findProjectByProduct(productName: string): ProjectMemory | null {
  for (const project of projectStore.values()) {
    if (project.productName.toLowerCase() === productName.toLowerCase()) {
      return project;
    }
  }
  return null;
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
