// snap.mjs — debugging helper for the GTM Agent UI.
//
// Captures screenshots of the running UI and mirrors browser console + page
// errors to stdout so the agent can self-correct. Servers must already be
// running (`npm run dev` in mastra/ and `npm run dev` in mastra/ui/).
//
// Requires the `playwright` package (installed in mastra/.debug). Run:
//   node mastra/scripts/snap.mjs --label "home"
//   node mastra/scripts/snap.mjs --out shots/chat.png --type "long..." --send
//   node mastra/scripts/snap.mjs --goto chat --type "text" --measure
//
// `--goto chat` opens the chat view by typing + Enter on the home textarea.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Use the headless shell that ships with the project's playwright install so we
// don't require a fresh `playwright install`.
const EXEC =
  process.env.PW_HEADLESS_SHELL ||
  '/Users/miczhuang/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const url = arg('url', 'http://localhost:5173');
const out = arg('out', 'shots/snap.png');
const label = arg('label', '');
const width = Number(arg('width', 1180));
const height = Number(arg('height', 820));
const wait = Number(arg('wait', 1200));
const goto = arg('goto', '');
const typeText = arg('type', '');
const send = flag('send');
const measure = flag('measure');

mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const ctx = await browser.newContext({ viewport: { width, height } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));

await page.goto(url);
await page.waitForLoadState('networkidle', { timeout: 15000 });

if (goto === 'chat') {
  const ta = page.locator('textarea').first();
  await ta.waitFor();
  await ta.fill('hello');
  await ta.press('Enter');
  await page.waitForTimeout(1500);
}

const ta = page.locator('textarea').first();
if (typeText) {
  await ta.waitFor();
  await ta.fill(typeText);
  await page.waitForTimeout(250);
}
if (send && typeText) {
  await ta.press('Enter');
}
await page.waitForTimeout(wait);

if (measure) {
  const m = await ta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      renderedH: Math.round(r.height),
      inlineHeight: el.style.height || '(none)',
      scrollHeight: el.scrollHeight,
      maxHeight: cs.maxHeight,
      minHeight: cs.minHeight,
      flex: cs.flex,
    };
  });
  console.log('TEXTAREA:', JSON.stringify(m));
}

await page.screenshot({ path: out, fullPage: true });
await browser.close();

if (label) console.log(`### ${label}`);
console.log(`SCREENSHOT: ${out}`);
if (logs.length) {
  console.log('--- browser console ---');
  for (const l of logs) console.log(l);
} else {
  console.log('(no console messages)');
}
