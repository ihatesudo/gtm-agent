#!/usr/bin/env node
/** Create an ignored Wrangler `.dev.vars` file from the repository root `.env`. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootEnv = resolve(import.meta.dirname, '..', '..', '.env');
const outputDir = resolve(import.meta.dirname, '..', '.mastra', 'output');
const required = ['GEMINI_API_KEY', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
const source = await readFile(rootEnv, 'utf8');
const values = new Map();

for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || match[1].startsWith('#')) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values.set(match[1], value);
}

const missing = required.filter((key) => !values.get(key));
if (missing.length) {
  console.error(`Missing required root .env values: ${missing.join(', ')}`);
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, '.dev.vars'),
  required.map((key) => `${key}=${JSON.stringify(values.get(key))}`).join('\n') + '\n',
  { mode: 0o600 },
);
console.log('Local Worker secrets prepared.');
