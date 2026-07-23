import type { Skill } from './types';
import skillsData from './data/skills.json';

const skills: Skill[] = skillsData as Skill[];
const CATEGORIES: [string, string][] = [
  ['seo', 'SEO'],
  ['ai-seo', 'AI / SEO'],
  ['schema', 'SEO'],
  ['site-architecture', 'SEO'],
  ['programmatic-seo', 'SEO'],
  ['ads', 'Paid Ads'],
  ['ad-creative', 'Paid Ads'],
  ['aso', 'Paid Ads'],
  ['copywriting', 'Copywriting'],
  ['copy-editing', 'Copywriting'],
  ['content-strategy', 'Content'],
  ['emails', 'Email / Lifecycle'],
  ['cold-email', 'Email / Lifecycle'],
  ['sms', 'Email / Lifecycle'],
  ['social', 'Social'],
  ['video', 'Content'],
  ['image', 'Content'],
  ['analytics', 'Analytics'],
  ['ab-testing', 'Experimentation'],
  ['cro', 'Experimentation'],
  ['popups', 'Experimentation'],
  ['pricing', 'Monetization'],
  ['paywalls', 'Monetization'],
  ['churn-prevention', 'Retention'],
  ['onboarding', 'Retention'],
  ['referrals', 'Retention'],
  ['community-marketing', 'Retention'],
  ['customer-research', 'Research'],
  ['competitor-profiling', 'Research'],
  ['competitors', 'Research'],
  ['prospecting', 'Sales / RevOps'],
  ['sales-enablement', 'Sales / RevOps'],
  ['revops', 'Sales / RevOps'],
  ['lead-magnets', 'Lead Gen'],
  ['free-tools', 'Lead Gen'],
  ['directory-submissions', 'Lead Gen'],
  ['launch', 'Growth'],
  ['marketing-plan', 'Growth'],
  ['marketing-ideas', 'Growth'],
  ['co-marketing', 'Growth'],
  ['product-marketing', 'Positioning'],
  ['marketing-psychology', 'Positioning'],
  ['signup', 'Growth'],
];

export function listSkills(): Skill[] {
  return skills;
}

export function findSkill(query: string): Skill | undefined {
  const q = query.toLowerCase().trim();
  let exact = skills.find(s => s.name === q);
  if (exact) return exact;
  let hits = skills.filter(s => s.name.startsWith(q));
  return hits.length === 1 ? hits[0] : undefined;
}

export function loadSkillBody(name: string): string | undefined {
  const skill = findSkill(name);
  return skill?.body;
}

export function categorize(): [string, Skill[]][] {
  const buckets = new Map<string, Skill[]>();
  for (const s of skills) {
    let cat = 'General';
    for (const [needle, label] of CATEGORIES) {
      if (s.name.includes(needle)) { cat = label; break; }
    }
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(s);
  }
  const order = [...new Set(CATEGORIES.map(([, l]) => l))].filter(c => buckets.has(c));
  if (buckets.has('General')) order.push('General');
  return order.filter(c => buckets.has(c)).map(c => [c, buckets.get(c)!]);
}

export function shortDescription(desc: string, width = 90): string {
  if (!desc) return '';
  let text = desc.trim();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '.' && i + 1 < text.length && (text[i + 1] === ' ' || text[i + 1] === '"') && i > 40) {
      text = text.slice(0, i + 1); break;
    }
  }
  return text.length > width ? text.slice(0, width - 1).replace(/\s+$/, '') + '…' : text;
}
