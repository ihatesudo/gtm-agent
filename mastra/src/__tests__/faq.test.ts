/**
 * faq.test.ts — FAQ knowledge base store + faq_search tool.
 *
 * Self-built `faq` table + keyword (LIKE) retrieval. No embeddings. The store
 * mirrors the project-memory.ts LibSQL pattern (getDb / ensureTable / upsert).
 * The scoring/formatting helpers are pure functions tested directly; the store
 * is exercised against a temp LibSQL file to keep it hermetic.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Faq } from '../mastra/memory/faq-store.js';

// Point the FAQ store at a throwaway DB for hermetic testing BEFORE importing
// the store module (it reads env at call time, but set it early to be safe).
const tmpDir = mkdtempSync(join(tmpdir(), 'faq-'));
process.env.TURSO_DATABASE_URL = `file:${join(tmpDir, 'faq.db')}`;
process.env.TURSO_AUTH_TOKEN = '';

// Dynamic import after env is set so the store's getDb() picks up the temp DB.
const { upsertFaq, searchFaqs, listFaqs, deleteFaq, scoreFaq, formatFaqResults } =
  await import('../mastra/memory/faq-store.js');

const sample = (overrides: Partial<Faq> = {}): Faq => ({
  id: `faq-${Math.random().toString(36).slice(2, 8)}`,
  question: 'How do I set up Google Ads conversion tracking?',
  answer: 'Create a conversion action in Google Ads, install the gtag snippet, and verify with the Tag Assistant.',
  tags: ['paid-search', 'tracking'],
  source: 'docs',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('scoreFaq (pure keyword scoring)', () => {
  it('scores a title match higher than an answer match', () => {
    const f = sample({ question: 'Google Ads setup', answer: 'install gtag', tags: ['paid-search'] });
    const titleScore = scoreFaq(f, 'google ads');
    const answerScore = scoreFaq(sample({ question: 'unrelated', answer: 'google ads here', tags: ['x'] }), 'google ads');
    expect(titleScore).toBeGreaterThan(answerScore);
    expect(titleScore).toBeGreaterThan(0);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreFaq(sample(), 'totally unrelated xyzzy')).toBe(0);
  });

  it('matches tags', () => {
    expect(scoreFaq(sample({ tags: ['retention'] }), 'retention')).toBeGreaterThan(0);
  });
});

describe('formatFaqResults (pure)', () => {
  it('formats hits with Q + A and source', () => {
    const out = formatFaqResults([sample({ question: 'Q1', answer: 'A1', source: 'docs' })], 'q');
    expect(out).toContain('Q1');
    expect(out).toContain('A1');
    expect(out.toLowerCase()).toContain('faq');
  });

  it('returns an explicit "no hits" message when empty', () => {
    const out = formatFaqResults([], 'obscure query');
    expect(out.toLowerCase()).toMatch(/no entries matched|no canned answer|no faq|nothing found/);
  });

  it('respects a max-results cap', () => {
    const faqs = Array.from({ length: 10 }, (_, i) => sample({ question: `Q${i}`, answer: `match query` }));
    const out = formatFaqResults(faqs, 'query', 3);
    // Only the capped number of Qs appear.
    expect(out.match(/Q\d/g)?.length).toBeLessThanOrEqual(3);
  });
});

describe('FAQ store (hermetic LibSQL file)', () => {
  it('upserts and retrieves a FAQ by id', async () => {
    const f = sample({ id: 'faq-upsert-1', question: 'What is ICP?' });
    await upsertFaq(f);
    const list = await listFaqs();
    expect(list.some((x) => x.id === 'faq-upsert-1')).toBe(true);
  });

  it('upsert updates an existing FAQ in place (same id)', async () => {
    await upsertFaq(sample({ id: 'faq-upsert-2', question: 'old question' }));
    await upsertFaq(sample({ id: 'faq-upsert-2', question: 'new question' }));
    const list = await listFaqs();
    const f = list.find((x) => x.id === 'faq-upsert-2');
    expect(f?.question).toBe('new question');
    expect(list.filter((x) => x.id === 'faq-upsert-2')).toHaveLength(1);
  });

  it('searchFaqs returns matching FAQs ranked by relevance, best first', async () => {
    await upsertFaq(sample({ id: 'faq-q-title', question: 'Google Ads budget strategy', answer: 'misc', tags: ['paid-search'] }));
    await upsertFaq(sample({ id: 'faq-q-answer', question: 'unrelated', answer: 'set a Google Ads daily budget', tags: ['x'] }));
    await upsertFaq(sample({ id: 'faq-q-nomatch', question: 'SEO tips', answer: 'keywords', tags: ['seo'] }));
    const hits = await searchFaqs('google ads');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    // Title match should rank above answer-only match.
    expect(hits[0].id).toBe('faq-q-title');
  });

  it('searchFaqs returns empty array (not error) when nothing matches', async () => {
    const hits = await searchFaqs('zzz-no-such-thing-xyz');
    expect(hits).toEqual([]);
  });

  it('deletes a FAQ by id', async () => {
    await upsertFaq(sample({ id: 'faq-del-1', question: 'temp' }));
    await deleteFaq('faq-del-1');
    const list = await listFaqs();
    expect(list.some((x) => x.id === 'faq-del-1')).toBe(false);
  });
});
