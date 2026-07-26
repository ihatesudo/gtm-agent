/**
 * intent.test.ts — explicit intent classifier + routing observability.
 *
 * The Director currently routes by LLM-emergent tool-calling (no explicit
 * classifier). These tests lock in a deterministic, keyword-based classifier
 * that runs BEFORE the LLM so routing is observable (and later overridable),
 * plus a structured logging hook that records every routing decision.
 *
 * Design: pure functions, no LLM calls, no I/O in the classifier itself —
 * fast and fully deterministic for TDD.
 */
import { describe, it, expect, vi } from 'vitest';
import { classifyIntent, type Intent } from '../mastra/intent/classifier.js';
import { logRoutingDecision } from '../mastra/intent/logging.js';

describe('classifyIntent — competitive / Director-owned', () => {
  it('classifies competitive teardown requests', () => {
    const tests = [
      'Analyze Notion as a competitive teardown',
      '帮我对竞品做个分析',
      '竞对调研',
      'how do we compare to Salesforce?',
    ];
    for (const t of tests) {
      const r = classifyIntent(t);
      expect(r.intent, `"${t}"`).toBe('competitive');
      // Competitive work is Director-owned (do-it-yourself), never delegated.
      expect(r.delegateTo).toBeUndefined();
    }
  });
});

describe('classifyIntent — delegation to specialists', () => {
  it('routes cold-email / outreach to b2b-linkedin', () => {
    expect(classifyIntent('Write a cold email sequence').intent).toBe('b2b-linkedin');
    expect(classifyIntent('cold outreach to CTOs').delegateTo).toBe('b2b-linkedin');
  });

  it('routes SEO keywords to seo', () => {
    expect(classifyIntent('SEO quick wins for my blog').delegateTo).toBe('seo');
    expect(classifyIntent('关键词排名优化').delegateTo).toBe('seo');
  });

  it('routes paid search / Google ads to paid-search', () => {
    expect(classifyIntent('Write Google Ads headlines').delegateTo).toBe('paid-search');
    expect(classifyIntent('我的 SEM 出价策略').delegateTo).toBe('paid-search');
  });

  it('routes social ads / Meta / TikTok to social-ads', () => {
    expect(classifyIntent('Facebook ad creative').delegateTo).toBe('social-ads');
    expect(classifyIntent('TikTok 信息流投放').delegateTo).toBe('social-ads');
  });

  it('routes retention / lifecycle / drip to lifecycle-retention', () => {
    expect(classifyIntent('email drip onboarding').intent).toBe('lifecycle');
    expect(classifyIntent('email drip onboarding').delegateTo).toBe('lifecycle-retention');
    expect(classifyIntent('用户留存召回策略').delegateTo).toBe('lifecycle-retention');
  });
});

describe('classifyIntent — creative & general', () => {
  it('classifies landing-page / copywriting as creative', () => {
    expect(classifyIntent('Rewrite my landing page hero').intent).toBe('creative');
    expect(classifyIntent('写一段广告文案').intent).toBe('creative');
  });

  it('falls back to general when no keyword matches', () => {
    const r = classifyIntent('hello, what can you do?');
    expect(r.intent).toBe('general');
    expect(r.delegateTo).toBeUndefined();
    expect(r.reason).toBeTruthy();
  });
});

describe('classifyIntent — contract shape', () => {
  it('always returns a valid intent label and a reason', () => {
    const r = classifyIntent('anything');
    expect(r.intent).toBeTruthy();
    expect(typeof r.reason).toBe('string');
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(classifyIntent('   SEO   ').intent).toBe('seo');
    expect(classifyIntent('COLD EMAIL').intent).toBe('b2b-linkedin');
  });

  it('respects keyword priority: competitive beats delegation when both present', () => {
    // "competitive analysis of Google Ads strategy" — competitive wins.
    const r = classifyIntent('competitive analysis of Google Ads strategy');
    expect(r.intent).toBe('competitive');
  });
});

describe('logRoutingDecision', () => {
  it('writes a structured decision record and returns it', async () => {
    const write = vi.fn();
    const logger = (input: any) => logRoutingDecision(input, { write });
    const decision: Intent = { intent: 'seo', delegateTo: 'seo', reason: 'keyword: seo', confidence: 0.9 };
    const rec = await logger({ threadId: 't1', userText: 'SEO tips', decision });
    expect(rec.threadId).toBe('t1');
    expect(rec.decision.intent).toBe('seo');
    expect(write).toHaveBeenCalledTimes(1);
    // The persisted record carries intent + delegateTo + a timestamp.
    const saved = write.mock.calls[0][0];
    expect(saved.intent).toBe('seo');
    expect(saved.delegateTo).toBe('seo');
    expect(saved.createdAt).toBeTruthy();
  });

  it('also mirrors the decision to console (so it shows in dev server logs)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await logRoutingDecision(
      { threadId: 't2', userText: 'hi', decision: { intent: 'general', reason: 'no match', confidence: 0.2 } },
      { write: vi.fn() },
    );
    expect(consoleSpy).toHaveBeenCalled();
    const line = JSON.stringify(consoleSpy.mock.calls.map((a) => String(a[0])).join(' '));
    expect(line).toMatch(/intent|routing/i);
    consoleSpy.mockRestore();
  });

  it('does not throw when the write callback rejects (logging is best-effort)', async () => {
    await expect(
      logRoutingDecision(
        { threadId: 't3', userText: 'x', decision: { intent: 'general', reason: 'r', confidence: 0.1 } },
        { write: async () => { throw new Error('db down'); } },
      ),
    ).resolves.not.toThrow();
  });
});
