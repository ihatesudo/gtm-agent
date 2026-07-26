// seed-faqs.mjs — populate the FAQ knowledge base with curated GTM Q&A.
//
// Usage:
//   node scripts/seed-faqs.mjs              # upsert all seeds
//   TURSO_DATABASE_URL=file:mastra.db node scripts/seed-faqs.mjs
//
// Idempotent: upserts by id, safe to re-run. Backed by the same LibSQL/Turso
// DB the faq_search tool reads from. The store reads TURSO_* env vars directly,
// so we just need to load .env first (the @libsql/client is a dependency).

import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

// Load .env (simple parse — the project's .env is KEY=VALUE lines).
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // .env optional — fall back to defaults / runtime env.
}

const SEEDS = [
  {
    id: 'faq-icp-definition',
    question: 'What is an ICP (Ideal Customer Profile)?',
    answer:
      'An ICP is a description of the company that gets the most value from your product. It includes firmographics (size, industry, geography), the pain you solve, and the buying trigger. Build it by analyzing your best customers and looking for shared traits.',
    tags: ['positioning', 'icp', 'b2b'],
  },
  {
    id: 'faq-conversion-tracking',
    question: 'How do I set up Google Ads conversion tracking?',
    answer:
      '1) Create a conversion action in Google Ads (Tools → Conversions). 2) Install the gtag.js snippet on your site, or use Google Tag Manager. 3) Fire the conversion event on the thank-you/confirmation page. 4) Verify with the Tag Assistant browser extension.',
    tags: ['paid-search', 'tracking', 'google-ads'],
  },
  {
    id: 'faq-landing-page-cta',
    question: 'What makes a strong landing page CTA?',
    answer:
      'A strong CTA is action-oriented, specific, and low-friction. Lead with the outcome ("Start analyzing in 5 minutes") rather than generic verbs ("Submit"). Use contrast for the button, place it above the fold, and pair it with social proof.',
    tags: ['creative', 'landing-page', 'conversion'],
  },
  {
    id: 'faq-seo-quickwins',
    question: 'What are quick SEO wins for a SaaS blog?',
    answer:
      '1) Update and republish old posts (content decay). 2) Add internal links from high-authority pages. 3) Fix missing title tags and meta descriptions. 4) Target low-difficulty keywords with existing relevance. 5) Improve Core Web Vitals (LCP/CLS).',
    tags: ['seo', 'content', 'quick-wins'],
  },
  {
    id: 'faq-cold-email-subject',
    question: 'How long should a cold email subject line be?',
    answer:
      'Keep it 3-5 words / under 40 characters. Subject lines that read like internal notes ("quick thought on your SOC2") outperform marketing-y ones. Avoid spam triggers (FREE, ALL CAPS, exclamation marks). A/B test open rates on small batches first.',
    tags: ['b2b-linkedin', 'cold-email', 'outreach'],
  },
  {
    id: 'faq-roas-vs-cpa',
    question: 'Should I optimize for ROAS or CPA?',
    answer:
      'ROAS (Return on Ad Spend) suits e-commerce where each transaction has clear revenue. CPA (Cost Per Acquisition) suits lead-gen / SaaS where the value-per-conversion varies. Pick the metric that maps to revenue you can actually measure; optimize for both only if your attribution is trustworthy.',
    tags: ['paid-search', 'metrics', 'social-ads'],
  },
  {
    id: 'faq-retention-cohort',
    question: 'How do I measure user retention?',
    answer:
      'Build a cohort table: group users by signup week, then track what % return in week 1, 2, … N. Day-1 and day-7 retention are the leading indicators of product-market fit. Compare cohorts before/after changes to isolate impact.',
    tags: ['lifecycle', 'retention', 'metrics'],
  },
  {
    id: 'faq-ab-test-duration',
    question: 'How long should I run an A/B test?',
    answer:
      'Until you reach the sample size needed for your target power (usually 90%) and significance (95%), AND for at least one full business cycle (often 1-2 weeks) to capture day-of-week effects. Stopping early on "significance" inflates false positives.',
    tags: ['metrics', 'experimentation', 'conversion'],
  },
  {
    id: 'faq-brand-voice',
    question: 'How do I define a consistent brand voice?',
    answer:
      'Pick 3 voice attributes (e.g. "plain-spoken, confident, warm") and their opposites. Write 2-3 example sentences for each channel. Document dos/don\'ts and review every piece against the list. Consistency beats cleverness — reuse the same phrasings across touchpoints.',
    tags: ['positioning', 'creative', 'brand'],
  },
  {
    id: 'faq-linkedin-abm',
    question: 'What is ABM on LinkedIn?',
    answer:
      'Account-Based Marketing on LinkedIn targets specific companies (not broad audiences) with personalized creative. Upload a target account list, layer job-seniority filters, and serve tailored messaging to each buying-committee role. Measure pipeline influenced, not just clicks.',
    tags: ['b2b-linkedin', 'abm', 'social-ads'],
  },
];

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS faq (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const now = new Date().toISOString();
let count = 0;
for (const s of SEEDS) {
  const row = { ...s, source: 'seed', createdAt: now, updatedAt: now };
  await db.execute({
    sql: `INSERT INTO faq (id, question, answer, tags, source, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            question = excluded.question, answer = excluded.answer, tags = excluded.tags,
            source = excluded.source, data = excluded.data, updated_at = excluded.updated_at`,
    args: [row.id, row.question, row.answer, JSON.stringify(row.tags), row.source, JSON.stringify(row), row.createdAt, row.updatedAt],
  });
  count++;
}

console.log(`Seeded ${count} FAQs into ${process.env.TURSO_DATABASE_URL || 'file:mastra.db'}`);
