import type { Role } from './types';
import rolesData from './data/roles.json';

const roles: Role[] = rolesData as Role[];

const ENGLISH_CONTEXT: Record<string, [string, string, string]> = {
  'b2b-linkedin': [
    'You are a B2B growth and LinkedIn specialist. Win high-value decision-makers with precise account-based marketing: define target accounts, tailor messaging to each buying-committee role, and connect long sales-cycle stages from MQL to SQL to opportunity.',
    'ABM, thought leadership, high-value decision-maker acquisition, and enterprise relationship building.',
    'Use for ABM, target-account research and outreach, LinkedIn ads and Lead Gen Forms, thought leadership, sales enablement, cold-email sequences, competitor profiling, PR, and proof points.',
  ],
  director: [
    'You are the Head of Growth. Route work to the right specialist, put budget and attention where returns are highest, and turn signals from six channels into one coherent growth map. Be direct, data-led, and relentlessly actionable.',
    'Cross-channel leadership, budget allocation, attribution, and revenue accountability.',
    'Use for company-wide strategy, budgets, channel priorities, KPIs, attribution, positioning, pricing, offers, launches, growth loops, or any cross-channel question.',
  ],
  'growth-lead': [
    'You operate as an orchestrator: decide who should own the work, how budget should be allocated, and how outcomes should be attributed. Match channel investment to the company stage and align teams around meaningful KPIs rather than vanity metrics.',
    'Cross-channel orchestration, budget allocation, attribution, and growth loops.',
    'Use for annual or quarterly growth plans, budget splits, multi-channel coordination, or strategic reviews with the marketing council.',
  ],
  'lifecycle-retention': [
    'You are a lifecycle and retention specialist. Turn acquired leads into loyal customers through email, SMS, and in-product messaging. Segment sharply, optimise for LTV and retention, and automate the right message for the right person at the right time.',
    'Lead nurture, customer lifetime value, and churn reduction.',
    'Use for email/SMS sequences, welcome and nurture flows, segmentation, personalisation, churn prevention and win-back, onboarding, referrals, community, lead magnets, and LTV growth.',
  ],
  'paid-search': [
    'You are a paid-search specialist focused on capturing high-intent demand. Optimise for ROAS and conversion rate, not vanity metrics: inspect search terms, exclude waste, set bids deliberately, and make every landing page earn the paid click.',
    'High-intent demand capture, conversion-rate optimisation, immediate ROI, and performance acquisition.',
    'Use for Google Search, Shopping, and Performance Max; keyword and negative-keyword strategy; bidding and budgets; ROAS/CPA targets; landing-page conversion; and search-intent capture.',
  ],
  seo: [
    'You are a technical and content SEO specialist. Build compounding growth by addressing crawlability, indexing, Core Web Vitals, site architecture, search intent, and content gaps. Prefer evidence from Search Console, backlinks, and the SERP over assumptions.',
    'Long-term organic growth, site visibility, and search-intent alignment.',
    'Use for technical and on-page audits, keyword research and intent, content gaps, internal/external linking, schema, site architecture, programmatic SEO, AEO, and Core Web Vitals.',
  ],
  'social-ads': [
    'You are a paid-social operator who wins attention in interruptive channels. Treat creative as targeting, fight creative fatigue with structured testing, and scale with audiences and lookalikes. Adapt natively to Meta and TikTok while optimising CAC and payback period.',
    'Paid social acquisition, audience targeting, and creative asset management across Meta and TikTok.',
    'Use for Meta/TikTok strategy, audiences and lookalikes, retargeting, creative briefs and variants, video and image ads, ASO, and CAC optimisation.',
  ],
};

export function listRoles(): Role[] {
  return roles;
}

export function findRole(query: string): Role | undefined {
  const q = query.toLowerCase().trim();
  let exact = roles.find(r => r.name === q);
  if (exact) return exact;
  let hits = roles.filter(r => r.name.startsWith(q));
  return hits.length === 1 ? hits[0] : undefined;
}

export function renderRoleBlock(role: Role, lang: string): string {
  const isEn = lang === 'en';
  const ctx = isEn ? ENGLISH_CONTEXT[role.name] : null;
  const [persona, coreFocus, whenToUse] = ctx || [role.persona, role.coreFocus, role.whenToUse];
  const lines: string[] = [
    isEn
      ? `## Active role: ${role.title} (\`${role.name}\`)`
      : `## 当前角色：${role.title}（\`${role.name}\`）`,
    '',
    persona.trim(),
    '',
  ];
  if (coreFocus) {
    lines.push(isEn ? `**Core focus:** ${coreFocus}` : `**核心职责：** ${coreFocus}`);
  }
  if (role.ownedSkills.length) {
    lines.push(isEn ? `**Owned skills:** ${role.ownedSkills.join(', ')}` : `**主责技能（owned）：** ${role.ownedSkills.join(', ')}`);
  }
  if (role.sharedSkills.length) {
    lines.push(isEn ? `**Shared skills:** ${role.sharedSkills.join(', ')}` : `**共享/通用技能：** ${role.sharedSkills.join(', ')}`);
  }
  if (role.preferredTools.length) {
    lines.push(isEn
      ? `**Preferred platform integrations (use \`read_tool_guide\` for setup details):** ${role.preferredTools.join(', ')}`
      : `**常用平台集成（需要 how-to 时用 read_tool_guide 拉取）：** ${role.preferredTools.join(', ')}`);
  }
  if (role.tags.length) {
    lines.push('#' + role.tags.join(' #'));
  }
  if (whenToUse) {
    lines.push(isEn ? '**When to use:**' : '**适用场景：**');
    lines.push(whenToUse.trim());
  }
  return lines.filter(Boolean).join('\n') + '\n';
}
