/**
 * Explicit intent classifier for the GTM Director.
 *
 * Runs BEFORE the LLM as a deterministic, keyword-based first pass so routing
 * is observable (logged) and can be overridden later. It does NOT replace the
 * Director's LLM routing — it augments it with a predictable, explainable
 * signal. Pure function: no I/O, no LLM calls, fully deterministic for TDD.
 *
 * Intent taxonomy maps to the existing specialist agents where applicable:
 *   competitive   → Director-owned (do-it-yourself, no delegation)
 *   paid-search   → paid-search specialist
 *   social-ads    → social-ads specialist
 *   seo           → seo specialist
 *   b2b-linkedin  → b2b-linkedin specialist (cold email / outreach / ABM)
 *   lifecycle     → lifecycle-retention specialist (drips / retention)
 *   creative      → Director-owned (copywriting / landing pages)
 *   faq           → knowledge-base lookup (faq_search tool)
 *   general       → Director handles directly
 */

export type IntentLabel =
  | 'competitive'
  | 'paid-search'
  | 'social-ads'
  | 'seo'
  | 'b2b-linkedin'
  | 'lifecycle'
  | 'creative'
  | 'faq'
  | 'general';

export interface Intent {
  intent: IntentLabel;
  /** The specialist agent id to delegate to, if any. Director-owned intents leave this undefined. */
  delegateTo?: string;
  /** Human-readable explanation of why this intent was chosen. */
  reason: string;
  /** 0-1 confidence (keyword match → higher). */
  confidence: number;
}

/**
 * Keyword groups, in priority order (first match wins per group, but groups
 * are evaluated in the order below so competitive beats delegation).
 * Each entry: [intent, delegateTo?, [keywords...]].
 *
 * Keywords are matched case-insensitively as whole-word/substring matches
 * against the lowercased input.
 */
const RULES: ReadonlyArray<{ intent: IntentLabel; delegateTo?: string; keywords: string[] }> = [
  // 1. Competitive — highest priority (Director-owned, never delegated).
  {
    intent: 'competitive',
    keywords: ['competitive', 'competitor', '竞品', '竞对', 'teardown', 'compare to', 'comparison', '对比'],
  },
  // 2. Specialist delegations.
  { intent: 'b2b-linkedin', delegateTo: 'b2b-linkedin', keywords: ['cold email', 'cold outreach', 'outreach', 'abm', 'linkedin', '冷邮', '外联', '销售外联'] },
  { intent: 'seo', delegateTo: 'seo', keywords: ['seo', 'serp', 'backlink', 'organic search', '关键词排名', '外链', '收录'] },
  { intent: 'paid-search', delegateTo: 'paid-search', keywords: ['google ads', 'sem', 'ppc', 'paid search', 'search ad', '竞价', '出价'] },
  { intent: 'social-ads', delegateTo: 'social-ads', keywords: ['facebook ad', 'meta ad', 'tiktok', 'instagram ad', 'social ad', '信息流', '社媒投放'] },
  { intent: 'lifecycle', delegateTo: 'lifecycle-retention', keywords: ['retention', 'lifecycle', 'drip', 'onboarding email', 're-engagement', '留存', '召回', '触达'] },
  // 3. Creative — Director-owned.
  { intent: 'creative', keywords: ['landing page', 'hero copy', 'copywriting', 'ad copy', 'headline', 'slogan', '文案', '落地页', '标语'] },
  // 4. FAQ — knowledge base lookup.
  { intent: 'faq', keywords: ['faq', '常见问题', 'help', 'how do i', 'what is'] },
];

const DELEGATE_MAP: Record<string, string | undefined> = {
  competitive: undefined,
  'paid-search': 'paid-search',
  'social-ads': 'social-ads',
  seo: 'seo',
  'b2b-linkedin': 'b2b-linkedin',
  lifecycle: 'lifecycle-retention',
  creative: undefined,
  faq: undefined,
  general: undefined,
};

/**
 * Classify a user message into an intent. Deterministic, pure, fast.
 * Returns the first matching rule (in RULES order); falls back to 'general'.
 */
export function classifyIntent(text: string): Intent {
  const lower = (text || '').toLowerCase().trim();
  if (!lower) {
    return { intent: 'general', reason: 'empty input', confidence: 0 };
  }

  for (const rule of RULES) {
    const hit = rule.keywords.find((kw) => lower.includes(kw));
    if (hit) {
      return {
        intent: rule.intent,
        delegateTo: DELEGATE_MAP[rule.intent],
        reason: `keyword "${hit}"`,
        confidence: 0.9,
      };
    }
  }

  return {
    intent: 'general',
    reason: 'no keyword matched',
    confidence: 0.2,
  };
}
