/**
 * Chat Component Integration Test
 *
 * Runs end-to-end against a local Mastra instance:
 * 1. Loads environment variables from root .env or mastra/.env.
 * 2. Connects to or automatically spawns a local Mastra server on port 4111.
 * 3. Tests chat stream submission:
 *    - Model selection (modelChoice)
 *    - Disabled thinking mode (thinkingMode = "off")
 *    - Token-optimized short response prompt ("Reply with 'OK'")
 *    - Timeout verification (< 15 seconds)
 *    - Auth and upstream error detection (no 401/403/500/provider outage errors)
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mastraDir = resolve(__dirname, '../..');
const rootDir = resolve(mastraDir, '..');

// ── 1. Load .env variables into process.env ──────────────────────────────────
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(rootDir, '.env'));
loadEnvFile(resolve(mastraDir, '.env'));

const PORT = process.env.PORT || 4111;
const BASE_URL = process.env.MASTRA_URL || `http://localhost:${PORT}`;
const TIMEOUT_MS = 15000; // 15s timeout for chat completion

let passed = 0;
let failed = 0;
let serverProc = null;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function isServerAlive() {
  try {
    const res = await fetch(`${BASE_URL}/api/agents`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerRunning() {
  if (await isServerAlive()) {
    console.log(`[Setup] Existing server detected on ${BASE_URL}`);
    return;
  }

  console.log(`[Setup] Starting Mastra dev server on port ${PORT}...`);
  const binPath = resolve(mastraDir, 'node_modules/.bin/mastra');
  const useBin = existsSync(binPath);
  const cmd = useBin ? binPath : 'npx';
  const args = useBin ? ['dev'] : ['mastra', 'dev'];

  serverProc = spawn(cmd, args, {
    cwd: mastraDir,
    env: { ...process.env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stderr?.on('data', (d) => {
    const s = d.toString().trim();
    if (s && !s.includes('ExperimentalWarning')) {
      console.error(`  [Server] ${s}`);
    }
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 30000) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isServerAlive()) {
      console.log(`[Setup] Server started successfully on ${BASE_URL}`);
      return;
    }
  }

  throw new Error('Failed to start local Mastra server within 20s');
}

// ── 2. Integration Test Scenarios ────────────────────────────────────────────

async function runTests() {
  console.log('\n==================================================');
  console.log(' GTM Agent Chat Component Integration Test');
  console.log('==================================================\n');

  // Test 1: API Endpoint & Agent Discovery
  console.log('[Test 1] Verifying server health & available agents...');
  const agentsRes = await fetch(`${BASE_URL}/api/agents`, { signal: AbortSignal.timeout(5000) });
  assert(agentsRes.ok, `GET /api/agents returns HTTP ${agentsRes.status}`);
  const agentsData = await agentsRes.json();
  const agentIds = Object.keys(agentsData);
  const targetAgentId = agentIds.find((id) => id.includes('director')) || agentIds[0] || 'director';
  assert(agentIds.length > 0 && !!targetAgentId, `Director agent registered in Mastra (found: ${targetAgentId})`);
  console.log(`  Discovered agents: ${agentIds.join(', ')}`);

  // Test 2: Provider Status Probe
  console.log('\n[Test 2] Provider connectivity status check...');
  const statusRes = await fetch(`${BASE_URL}/api/providers/status`, { signal: AbortSignal.timeout(5000) });
  assert(statusRes.ok, `GET /api/providers/status returns HTTP ${statusRes.status}`);
  if (statusRes.ok) {
    const status = await statusRes.json();
    console.log(`  Active provider: ${status.active}`);
    console.log(`  Provider state: ${JSON.stringify(status.providers[status.active] || {})}`);
  }

  // Test 3: Chat Component Stream Submission (Auth, Timeout, Thinking=off, Short Prompt)
  console.log(`\n[Test 3] Submitting chat prompt to GTM Agent '${targetAgentId}' (thinkingMode: "off", token-optimized)...`);
  const threadId = `int-test-${Date.now()}`;
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const streamRes = await fetch(`${BASE_URL}/api/agents/${targetAgentId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Respond with the single word "OK" and nothing else.' }],
        memory: { thread: threadId, resource: 'integration-test' },
        thinkingMode: 'off',
        modelChoice: 'openrouter',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const duration = Date.now() - startTime;

    let errDetail = '';
    if (!streamRes.ok) {
      errDetail = await streamRes.text().catch(() => '');
      console.log(`  [Server 500 response]: ${errDetail}`);
    }

    assert(streamRes.status === 200, `POST /api/agents/${targetAgentId}/stream status is HTTP 200 (Got ${streamRes.status})`);
    assert(duration < TIMEOUT_MS, `Response received within ${TIMEOUT_MS}ms threshold (Took ${duration}ms)`);

    const contentType = streamRes.headers.get('content-type') || '';
    assert(contentType.includes('text/event-stream'), `Response header Content-Type is event-stream (${contentType})`);

    let accumulatedText = '';
    let isStreamFinished = false;
    let authOrServerError = null;

    if (contentType.includes('text/event-stream')) {
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              isStreamFinished = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text-delta') {
                accumulatedText += parsed.payload?.text || parsed.text || '';
              } else if (parsed.type === 'finish' || parsed.type === 'complete' || parsed.type === 'done') {
                isStreamFinished = true;
              } else if (parsed.type === 'error') {
                authOrServerError = parsed.error?.message || parsed.error || JSON.stringify(parsed);
              }
            } catch {
              // skip non-JSON frames
            }
          }
        }
        if (isStreamFinished || authOrServerError) break;
      }
    }

    assert(!authOrServerError, `No authentication or provider stream error reported: ${authOrServerError || 'None'}`);
    assert(isStreamFinished, 'SSE stream completed with finish/[DONE] frame');
    assert(accumulatedText.length > 0, `Agent returned valid response output (Received: "${accumulatedText.trim()}")`);
    assert(!accumulatedText.includes('Upstream Provider Outage') && !accumulatedText.includes('Authentication Error'), 'Response contains no authentication/5xx outage errors');

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      assert(false, `Chat submission timed out (> ${TIMEOUT_MS}ms)`);
    } else {
      assert(false, `Unexpected request error: ${err.message}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n==================================================');
  console.log(` Integration Test Results: ${passed} passed, ${failed} failed`);
  console.log('==================================================\n');

  if (serverProc) {
    console.log('[Cleanup] Terminating test server process...');
    serverProc.kill('SIGTERM');
  }

  process.exit(failed > 0 ? 1 : 0);
}

try {
  await ensureServerRunning();
  await runTests();
} catch (err) {
  console.error('[Error]', err.message);
  if (serverProc) serverProc.kill('SIGTERM');
  process.exit(1);
}
