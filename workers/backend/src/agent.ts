import type { Env, Role, AgentEvent } from './types';
import { findRole, renderRoleBlock } from './roles';
import { findSkill, loadSkillBody } from './skills';
import { ALL_TOOL_DEFS, executeTool } from './tools';

const SYSTEM_ZH = `你是这家公司的增长负责人（Marketing Director / Head of Growth），手下带一支六人专家小队：搜索投放（Paid Search/SEM）、社交效果广告（Social Ads）、技术与内容 SEO、B2B 与 LinkedIn、生命周期与留存（Email/CRM），外加你这个统筹全局的指挥官。你不亲自下场做完每一件事——你的价值在判断与调度。

## 你的团队（可按需切换 --role 深度执行）

- **paid-search（搜索投放）**：Google Ads/SEM、关键词与否定词、出价、ROAS/CPA、落地页转化。#GoogleAds #PPC #SEM #ROAS #CRO
- **social-ads（社交效果广告）**：Meta/TikTok 付费获客、人群与 lookalike、再营销、素材 brief。#PaidSocial #MetaAds #TikTokAds #CAC #LookalikeAudiences
- **seo（技术与内容 SEO）**：技术审计、关键词意图、内容缺口、内链/外链、schema、Core Web Vitals、AI 搜索/AEO。#TechnicalSEO #SearchIntent #Ahrefs #SearchConsole
- **b2b-linkedin（B2B/LinkedIn）**：ABM、目标账户、Lead Gen Forms、思想领导力、销售赋能、冷邮件。#AccountBasedMarketing #LinkedInCampaignManager #ThoughtLeadership
- **lifecycle-retention（生命周期/留存）**：邮件/SMS 序列、欢迎流、分群、流失预防、LTV。#CRM #EmailMarketing #MarketingAutomation #CustomerLifetimeValue
- **growth-lead（你自己）**：整体策略、预算分配、归因、KPI 对齐、增长闭环。#MarketingStrategy #BudgetAllocation #MultiTouchAttribution

## 工作方式

1. **先判断任务归属**：属于哪个渠道/职能？需要深度执行时，建议切换到对应 --role，或激活相关 skill playbook。
2. **能答就直接答**：作为统筹者，你可以直接以对应专家的口吻给出专业、具体、可执行的回答。
3. **跨渠道问题自己拍板**：预算分配、渠道优先级、定位/产品营销、定价/offer、新品上市、增长闭环——这些是你的主场。

通用原则：
- 涉及实时信息（价格、新闻、竞品动态、热度）**一律先 web_search**，不要凭空编造数据。
- 长篇/最终交付物用 save_asset 落盘，文件名用语义化的 kebab-case + .md。
- 需要平台 how-to（如 google-ads、klaviyo）时用 read_tool_guide 按需拉取集成指南。
- 用中文回答，保持专业、具体、可执行；避免空话套话。给建议永远落到"下一步做什么"。`;

const SYSTEM_EN = `You are this company's Marketing Director / Head of Growth. You lead a six-person specialist team: Paid Search/SEM, Social Ads, Technical & Content SEO, B2B & LinkedIn, Lifecycle & Retention, plus you as the cross-functional leader. You do not need to personally execute every task: your value is judgment, prioritisation, and routing work to the right expert.

## Your team (switch with --role for deep execution)

- **paid-search**: Google Ads/SEM, keywords and negatives, bidding, ROAS/CPA, and landing-page conversion.
- **social-ads**: Meta/TikTok paid acquisition, audiences and lookalikes, retargeting, and creative briefs.
- **seo**: Technical SEO, search intent, content gaps, internal/external links, schema, Core Web Vitals, and AI search/AEO.
- **b2b-linkedin**: ABM, target accounts, Lead Gen Forms, thought leadership, sales enablement, and cold email.
- **lifecycle-retention**: Email/SMS sequences, onboarding, segmentation, churn prevention, and LTV.
- **growth-lead**: Full-funnel strategy, budget allocation, attribution, KPI alignment, and growth loops.

## How to work

1. First identify the owning channel or function. For deep execution, recommend the relevant --role or a skill playbook.
2. Answer directly whenever possible, in the voice and depth of the relevant specialist.
3. Make cross-channel decisions yourself: budgets, channel priorities, positioning, product marketing, pricing, offers, launches, and growth loops are your home turf.

General principles:
- For time-sensitive facts—prices, news, competitor moves, popularity—use web_search first. Do not invent data.
- Save long-form or final deliverables using save_asset; use descriptive kebab-case .md filenames.
- When platform setup detail is required, use read_tool_guide to load the relevant integration guide.
- Reply in clear, professional, actionable English only. Avoid filler. Every recommendation should end with a concrete next step.`;

function composePrompt(role?: string, skill?: string, lang = 'zh'): string {
  const isEn = lang === 'en';
  let prompt = isEn ? SYSTEM_EN : SYSTEM_ZH;
  if (role) {
    const found = findRole(role);
    if (found) {
      prompt += (isEn
        ? '\n\nFor this session, adopt the following specialist role and let its persona and expertise drive the answer (while still following the general principles above):\n\n'
        : '\n\n本次会话你切换为下面的专家角色，以其人设与专长驱动回答（仍遵守上面的通用原则）：\n\n')
        + renderRoleBlock(found, lang);
    }
  }
  if (skill) {
    const body = loadSkillBody(skill);
    if (body) {
      prompt += `\n\n## Active skill playbook: ${skill}\n\nFollow this playbook for the current task. Stay within this playbook's expertise.\n\n${body}`;
    }
  }
  return prompt;
}

interface LLMResponse {
  type: 'answer' | 'tool_call';
  content: string | null;
  toolCalls?: { id: string; type: string; function: { name: string; arguments: string } }[];
}

async function callLLM(
  messages: { role: string; content: string; tool_calls?: any[] }[],
  env: Env,
): Promise<LLMResponse> {
  const apiKey = env.OPENROUTER_API_KEY;
  const model = env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-exp:free';

  if (!apiKey) {
    return { type: 'answer', content: 'OPENROUTER_API_KEY is not configured. Set it with `wrangler secret put OPENROUTER_API_KEY`.' };
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    tools: ALL_TOOL_DEFS.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    stream: false,
    max_tokens: 16384,
  };

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://gtm-agent.pages.dev',
      'X-Title': 'GTM Agent',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { type: 'answer', content: `[LLM API error ${res.status}: ${errText}]` };
  }

  const data = await res.json() as any;
  const choice = data.choices?.[0];
  if (!choice) return { type: 'answer', content: '[No response from LLM]' };

  const toolCalls = choice.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    return { type: 'tool_call', content: choice.message?.content || null, toolCalls };
  }

  return { type: 'answer', content: choice.message?.content || '' };
}

export async function* runAgent(
  message: string,
  params: { role?: string; skill?: string; language?: string; includeThoughts?: boolean },
  env: Env,
): AsyncGenerator<AgentEvent> {
  const lang = params.language || 'zh';
  const systemPrompt = composePrompt(params.role, params.skill, lang);
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 15;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await callLLM(messages, env);

    if (response.type === 'tool_call' && response.toolCalls && response.toolCalls.length > 0) {
      if (response.content) {
        yield { type: 'thought', content: response.content };
      }
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const tc of response.toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        yield { type: 'tool_call', tool: tc.function.name, input: tc.function.arguments };
        const result = await executeTool(tc.function.name, args, env);
        yield { type: 'tool_result', tool: tc.function.name, result };
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        } as any);
      }
    } else {
      yield { type: 'answer', content: response.content || '' };
      return;
    }
  }

  yield { type: 'answer', content: '[Reached maximum iterations. Please refine your request.]' };
}
