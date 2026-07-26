/**
 * agents.test.ts — regression suite for agent configuration bugs
 *
 * Three classes of bugs caught here:
 *
 *  1. HALLUCINATED TOOL NAMES — the director LLM invented tool names like
 *     `agent_coldEmailAgent` or `agent_competitors` that don't exist. We
 *     verify that:
 *     - every sub-agent tool ID follows the `agent-<key>` pattern (matching
 *       how Mastra derives tool IDs from ALL_SPECIALIST_AGENTS' object keys)
 *     - the director prompt explicitly lists every valid tool name
 *     - the director prompt explicitly blocks every known hallucinated name
 *
 *  2. DEPRECATED MODEL NAMES — `gemini-2.5-flash-lite-preview-06-17` was shut
 *     down by Google, causing every specialist sub-agent call to fail with a
 *     model-not-found error. We verify no agent uses a known-deprecated string.
 *
 *  3. DELEGATION BOUNDARY — competitive teardowns and research were being
 *     delegated to non-existent agents. We verify the director prompt marks
 *     those tasks as "do it yourself".
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { directorAgent } from '../mastra/agents/director.js';
import {
  paidSearchAgent,
  socialAdsAgent,
  seoAgent,
  b2bLinkedinAgent,
  lifecycleAgent,
  ALL_SPECIALIST_AGENTS,
} from '../mastra/agents/specialists.js';
import type { Agent } from '@mastra/core/agent';

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Mastra generates agent sub-tools as `agent-<objectKey>` where objectKey is
 * the property name used when registering the agent (e.g. in ALL_SPECIALIST_AGENTS).
 * These are the ONLY valid tool names the director LLM may call.
 */
const VALID_AGENT_TOOL_IDS = [
  'agent-paidSearchAgent',
  'agent-socialAdsAgent',
  'agent-seoAgent',
  'agent-b2bLinkedinAgent',
  'agent-lifecycleAgent',
] as const;

/**
 * Tool names the director model has hallucinated in production. Each one must
 * be explicitly banned in the system prompt.
 */
const KNOWN_HALLUCINATED_TOOL_NAMES = [
  'agent_competitors',
  'agent-competitors',
  'agent-research',
  'agent-analysis',
  'agent_coldEmailAgent',
  'agent-email',
  'agent-outreach',
  'agent-marketing',
  'agent-growth',
  'agent-content',
  'agent-copywriter',
  'agent-strategy',
  'agent-teardown',
  'agent-memo',
  // underscore-variant of a valid tool (wrong separator)
  'agent_b2bLinkedinAgent',
  'agent_paidSearchAgent',
  'agent_socialAdsAgent',
  'agent_seoAgent',
  'agent_lifecycleAgent',
];

/**
 * Model strings that are shut down / deprecated on Vertex AI.
 * Any occurrence in agent config causes every call to fail immediately.
 */
const DEPRECATED_MODEL_STRINGS = [
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro-preview',
  'gemini-1.5-flash-preview',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return the raw model field from an agent (Mastra stores it as agent.model). */
function modelField(agent: Agent): unknown {
  return (agent as any).model;
}

/** Stringify the model field for substring inspection. */
function modelStr(agent: Agent): string {
  return String(modelField(agent));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Agent tool name contract (prevents hallucinated tool calls)', () => {
  it('ALL_SPECIALIST_AGENTS keys exactly match the expected valid tool ID set', () => {
    // Mastra builds tool IDs as `agent-${key}` from the object keys.
    const registeredKeys = Object.keys(ALL_SPECIALIST_AGENTS);
    const expectedKeys = VALID_AGENT_TOOL_IDS.map((id) => id.replace('agent-', ''));
    expect(registeredKeys.sort()).toEqual(expectedKeys.sort());
  });

  it('each registered specialist key produces a known valid agent tool ID', () => {
    for (const key of Object.keys(ALL_SPECIALIST_AGENTS)) {
      const generatedToolId = `agent-${key}` as (typeof VALID_AGENT_TOOL_IDS)[number];
      expect(VALID_AGENT_TOOL_IDS).toContain(generatedToolId);
    }
  });

  it('no specialist key uses an underscore — underscores would break tool ID (agent_foo ≠ agent-foo)', () => {
    for (const key of Object.keys(ALL_SPECIALIST_AGENTS)) {
      expect(key, `key "${key}" uses underscore — Mastra generates "agent-${key}" but model may call "agent_${key}"`).not.toMatch(/_/);
    }
  });

  it('ALL_SPECIALIST_AGENTS has exactly 5 entries — no missing or extra agents', () => {
    expect(Object.keys(ALL_SPECIALIST_AGENTS)).toHaveLength(5);
  });

  it('specialist agent .id values match expected agent IDs', () => {
    const expected: Record<string, string> = {
      paidSearchAgent: 'paid-search',
      socialAdsAgent: 'social-ads',
      seoAgent: 'seo',
      b2bLinkedinAgent: 'b2b-linkedin',
      lifecycleAgent: 'lifecycle-retention',
    };
    for (const [key, agent] of Object.entries(ALL_SPECIALIST_AGENTS)) {
      expect((agent as any).id, `${key}.id mismatch`).toBe(expected[key]);
    }
  });
});

describe('Director system prompt — valid tool names (prevents hallucination)', () => {
  let instructions: string;

  beforeAll(async () => {
    // getInstructions may return a structured CoreSystemMessage; coerce to a
    // string for substring checks. We only ever do .toContain / regex here.
    const raw = await directorAgent.getInstructions({});
    instructions = typeof raw === 'string' ? raw : JSON.stringify(raw);
  });

  it('lists every valid agent tool ID in the system prompt', () => {
    for (const toolId of VALID_AGENT_TOOL_IDS) {
      expect(instructions, `prompt is missing tool ID "${toolId}"`).toContain(toolId);
    }
  });

  it('explicitly calls out known-hallucinated tool names so the model sees them as banned', () => {
    const mustBlock = [
      'agent_competitors',
      'agent-competitors',
      'agent_coldEmailAgent',
      'agent-research',
      'agent-analysis',
    ];
    for (const bad of mustBlock) {
      expect(instructions, `prompt should mention "${bad}" in its blocklist`).toContain(bad);
    }
  });

  it('maps "cold email / outreach" to agent-b2bLinkedinAgent', () => {
    expect(instructions.toLowerCase()).toMatch(/cold.email/);
    expect(instructions).toContain('agent-b2bLinkedinAgent');
  });

  it('maps "email drips / retention / lifecycle" to agent-lifecycleAgent', () => {
    expect(instructions.toLowerCase()).toMatch(/email drip|retention|lifecycle/);
    expect(instructions).toContain('agent-lifecycleAgent');
  });

  it('does NOT instruct the director to call any hallucinated tool name', () => {
    for (const bad of KNOWN_HALLUCINATED_TOOL_NAMES) {
      // The bad names may appear in the blocklist section (fine), but should
      // NOT appear after a "call" instruction. We check that no "call `<bad>`"
      // pattern exists.
      const callPattern = new RegExp(
        `call[^\\n]*\`?${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`?`,
        'i',
      );
      expect(instructions, `prompt should not instruct to call "${bad}"`).not.toMatch(callPattern);
    }
  });
});

describe('Director system prompt — delegation boundary (prevents research delegation to non-existent agents)', () => {
  let instructions: string;

  beforeAll(async () => {
    const raw = await directorAgent.getInstructions({});
    instructions = typeof raw === 'string' ? raw : JSON.stringify(raw);
  });

  it('marks competitive analysis as something the director does itself (not a delegation)', () => {
    const lower = instructions.toLowerCase();
    // Should mention competitive teardown/analysis
    expect(lower).toMatch(/competitive analysis|teardown/);
    // Should also say "yourself", "directly", or similar — meaning the director owns it
    expect(lower).toMatch(/yourself|directly/);
  });

  it('marks memos / strategy / research as director-owned work', () => {
    const lower = instructions.toLowerCase();
    expect(lower).toMatch(/memo|strategy|research/);
    // These should be in the "do it yourself" section, not the delegation table
    expect(lower).toMatch(/yourself|directly/);
  });
});

describe('Deprecated model detection (prevents model-not-found errors on sub-agent calls)', () => {
  const allAgents = [
    { name: 'directorAgent', agent: directorAgent as Agent },
    { name: 'paidSearchAgent', agent: paidSearchAgent as Agent },
    { name: 'socialAdsAgent', agent: socialAdsAgent as Agent },
    { name: 'seoAgent', agent: seoAgent as Agent },
    { name: 'b2bLinkedinAgent', agent: b2bLinkedinAgent as Agent },
    { name: 'lifecycleAgent', agent: lifecycleAgent as Agent },
  ];

  for (const { name, agent } of allAgents) {
    it(`${name} does not reference a deprecated model string`, () => {
      const s = modelStr(agent);
      for (const deprecated of DEPRECATED_MODEL_STRINGS) {
        expect(s, `${name} references deprecated model "${deprecated}" which is shut down on Vertex AI`).not.toContain(deprecated);
      }
    });
  }

  it('specialist agents all share the same default model (no accidental divergence)', () => {
    const models = [
      modelStr(paidSearchAgent),
      modelStr(socialAdsAgent),
      modelStr(seoAgent),
      modelStr(b2bLinkedinAgent),
      modelStr(lifecycleAgent),
    ];
    // All should stringify identically — same closure code
    expect(new Set(models).size, 'specialists have diverged model configurations').toBe(1);
  });
});

describe('Current model sanity (model field is an async function from modelFromChoice)', () => {
  it('director model field is a function (modelFromChoice returns async fn)', () => {
    expect(typeof modelField(directorAgent)).toBe('function');
  });

  it('specialist model fields are functions', () => {
    for (const [key, agent] of Object.entries(ALL_SPECIALIST_AGENTS)) {
      expect(typeof modelField(agent as Agent), `${key}.model should be a function`).toBe('function');
    }
  });

  it('director model function accepts requestContext and returns a promise', async () => {
    const modelFn = modelField(directorAgent) as (ctx: { requestContext?: unknown }) => Promise<unknown>;
    // Call with empty requestContext — should NOT throw (falls back to env-based provider)
    // We don't make a real API call; we just verify the function is callable.
    expect(modelFn).toBeTypeOf('function');
    // calling with no SA in test env should fall back to openrouter (which needs a key)
    // — we can't assert the resolved model here without live env vars, so we just
    //   verify it's an async function (Promise-returning).
    const result = modelFn({});
    expect(result).toBeInstanceOf(Promise);
    // Settle it so no hanging promises remain (result will be a model object or throw)
    await result.catch(() => {});
  });
});

describe('Director structural checks', () => {
  it('has a non-empty id', () => {
    expect((directorAgent as any).id).toBe('director');
  });

  it('has a name', () => {
    expect((directorAgent as any).name).toBeTruthy();
  });

  it('getInstructions() returns a non-empty string', async () => {
    const raw = await directorAgent.getInstructions({});
    const inst = typeof raw === 'string' ? raw : JSON.stringify(raw);
    expect(inst.length).toBeGreaterThan(100);
  });

  it('has ALL_SPECIALIST_AGENTS wired as sub-agents', async () => {
    // listAgents() is the public API to enumerate registered sub-agents
    const agents = await directorAgent.listAgents({});
    const agentIds = Object.values(agents).map((a: any) => a.id ?? a._id ?? String(a));
    expect(agentIds).toContain('paid-search');
    expect(agentIds).toContain('b2b-linkedin');
    expect(agentIds).toContain('lifecycle-retention');
  });

  it('listTools() includes webSearchTool (key) with id web_search', async () => {
    const tools = await directorAgent.listTools({});
    const keys = Object.keys(tools);
    // Mastra registers tools by object key (webSearchTool), the tool's .id is web_search.
    // Either form must be present — we accept both key and id.
    const hasWebSearch = keys.includes('webSearchTool') || keys.includes('web_search') ||
      Object.values(tools).some((t: any) => t?.id === 'web_search');
    expect(hasWebSearch, `director is missing web_search tool; found keys: ${keys.join(', ')}`).toBe(true);
  });

  it('listTools() includes webFetchTool (key) with id web_fetch', async () => {
    const tools = await directorAgent.listTools({});
    const keys = Object.keys(tools);
    const hasWebFetch = keys.includes('webFetchTool') || keys.includes('web_fetch') ||
      Object.values(tools).some((t: any) => t?.id === 'web_fetch');
    expect(hasWebFetch, `director is missing web_fetch tool; found keys: ${keys.join(', ')}`).toBe(true);
  });

  it('listTools() includes saveAssetTool (key) with id save_asset', async () => {
    const tools = await directorAgent.listTools({});
    const keys = Object.keys(tools);
    const hasSaveAsset = keys.includes('saveAssetTool') || keys.includes('save_asset') ||
      Object.values(tools).some((t: any) => t?.id === 'save_asset');
    expect(hasSaveAsset, `director is missing save_asset tool; found keys: ${keys.join(', ')}`).toBe(true);
  });

  it('listTools() includes faqSearchTool (key) with id faq_search', async () => {
    const tools = await directorAgent.listTools({});
    const keys = Object.keys(tools);
    const hasFaq = keys.includes('faqSearchTool') || keys.includes('faq_search') ||
      Object.values(tools).some((t: any) => t?.id === 'faq_search');
    expect(hasFaq, `director is missing faq_search tool; found keys: ${keys.join(', ')}`).toBe(true);
  });
});

describe('Specialist structural checks', () => {
  const agents = [
    { key: 'paidSearchAgent', agent: paidSearchAgent as Agent, id: 'paid-search' },
    { key: 'socialAdsAgent', agent: socialAdsAgent as Agent, id: 'social-ads' },
    { key: 'seoAgent', agent: seoAgent as Agent, id: 'seo' },
    { key: 'b2bLinkedinAgent', agent: b2bLinkedinAgent as Agent, id: 'b2b-linkedin' },
    { key: 'lifecycleAgent', agent: lifecycleAgent as Agent, id: 'lifecycle-retention' },
  ];

  for (const { key, agent, id } of agents) {
    it(`${key} has agent id "${id}"`, () => {
      expect((agent as any).id).toBe(id);
    });

    it(`${key} has web_search in its tools`, async () => {
      const tools = await agent.listTools({});
      const toolKeys = Object.keys(tools);
      // listTools returns object keys (webSearchTool), not tool ids (web_search)
      const hasWebSearch = toolKeys.includes('webSearchTool') || toolKeys.includes('web_search') ||
        Object.values(tools).some((t: any) => t?.id === 'web_search');
      expect(hasWebSearch, `${key} is missing web_search tool; found: ${toolKeys.join(', ')}`).toBe(true);
    });

    it(`${key} has web_fetch in its tools`, async () => {
      const tools = await agent.listTools({});
      const toolKeys = Object.keys(tools);
      const hasWebFetch = toolKeys.includes('webFetchTool') || toolKeys.includes('web_fetch') ||
        Object.values(tools).some((t: any) => t?.id === 'web_fetch');
      expect(hasWebFetch, `${key} is missing web_fetch tool; found: ${toolKeys.join(', ')}`).toBe(true);
    });
  }
});
