import type { DropdownOption } from './Dropdown';

/**
 * Rich metadata for the three chat-bar selectors (model / agent / thinking).
 * Powers the hover detail cards in the Dropdown component so users see
 * context length, capabilities, and intent — like mainstream chat apps
 * (Doubao / Kimi) — instead of bare labels.
 *
 * IMPORTANT: the "openrouter" entries reflect the OpenRouter FREE-tier models
 * pinned in `mastra/src/mastra/model.ts` (OPENROUTER_FREE_MODELS). The
 * `:free` slugs here are display-only; the backend resolves the real model.
 */

export interface ModelMeta {
  /** The ModelChoice value sent to the backend (modelChoice). */
  value: string;
  label: string;
  detail: string;
  tag: 'free' | 'paid';
}

export const MODELS: ModelMeta[] = [
  {
    value: 'openrouter',
    label: 'Nemotron Ultra',
    detail: 'NVIDIA · 1M ctx · tools ✓ · 免费 · 稳定首选（OpenRouter free 默认）',
    tag: 'free',
  },
  {
    value: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    detail: 'Vertex AI · 快速、经济（需 Service Account，消耗 GCP trial credits）',
    tag: 'paid',
  },
  {
    value: 'gemini-pro',
    label: 'Gemini 2.5 Pro',
    detail: 'Vertex AI · 推理更强、较慢（需 Service Account，消耗 GCP trial credits）',
    tag: 'paid',
  },
  {
    value: 'glm',
    label: 'GLM-5.2',
    detail: '智谱 · 国产 Coding Plan，需 ZHIPU_API_KEY',
    tag: 'paid',
  },
];

export const MODEL_OPTIONS: DropdownOption[] = MODELS.map((m) => ({
  value: m.value,
  label: m.label,
  detail: { tag: m.tag, description: m.detail },
}));

export interface ThinkingMeta {
  value: string;
  label: string;
  detail: string;
}

export const THINKING_MODES: ThinkingMeta[] = [
  { value: 'none', label: 'No Think', detail: '不展示思维链，最快响应' },
  { value: 'easy', label: 'Easy', detail: '轻量思考，平衡速度与质量' },
  { value: 'medium', label: 'Medium', detail: '中等推理深度，适合复杂问题' },
  { value: 'hard', label: 'Hard', detail: '深度推理，最慢但最全面' },
];

export const THINKING_OPTIONS: DropdownOption[] = THINKING_MODES.map((t) => ({
  value: t.value,
  label: t.label,
  detail: { description: t.detail },
}));

/** Short agent name map (kept here so both views share it). */
export const SHORT_AGENT: Record<string, string> = {
  director: 'Director',
  'paid-search': 'Paid Search',
  'social-ads': 'Social Ads',
  seo: 'SEO',
  'b2b-linkedin': 'B2B LinkedIn',
  'lifecycle-retention': 'Lifecycle',
};

/** One-line intent blurb per agent id (used as the hover detail). */
export const AGENT_INTENT: Record<string, string> = {
  director: '编排总指挥：自动拆解任务，委派给合适的专家，并整合产出。',
  'paid-search': 'Google/付费搜索：关键词、出价、广告文案、落地页。',
  'social-ads': '社交广告：Meta/TikTok 等信息流投放与素材策略。',
  seo: 'SEO：关键词、内容、技术 SEO、外链与增长。',
  'b2b-linkedin': 'B2B / LinkedIn：冷邮、ABM、领英获客与销售外联。',
  'lifecycle-retention': '生命周期 / 留存：邮件滴灌、激活、留存与召回。',
};

export function shortAgentName(name: string, id: string): string {
  return SHORT_AGENT[id] || name;
}

export function agentDetail(id: string, description?: string): string {
  return AGENT_INTENT[id] || description || '';
}
