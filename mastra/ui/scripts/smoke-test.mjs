/**
 * SSE smoke test — runs against a live Mastra server or with mock data.
 *
 * Usage:
 *   node scripts/smoke-test.mjs              # mock data only
 *   MASTRA_URL=http://localhost:4111 node scripts/smoke-test.mjs   # live server
 */

// ── SSE parser (exact same logic as lib/api.ts, no React deps) ──────────

function parseSSEStream(chunks, callbacks = {}) {
  return new Promise((resolve) => {
    let accumulated = '';
    let accumulatedReasoning = '';
    let resolved = false;
    let buffer = '';

    function processLines() {
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (!resolved) { resolved = true; callbacks.onFinish?.(accumulated, accumulatedReasoning); resolve({ threadId: 'test' }); }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const type = parsed.type || '';
            if (type === 'text-delta' || type === 'text') {
              const delta = parsed.payload?.text || parsed.text || parsed.content || '';
              if (delta) { accumulated += delta; callbacks.onText?.(accumulated); }
            } else if (type === 'reasoning-delta' || type === 'reasoning') {
              const rDelta = parsed.payload?.text || parsed.payload?.reasoning || parsed.text || parsed.reasoning || '';
              if (rDelta) { accumulatedReasoning += rDelta; callbacks.onReasoning?.(accumulatedReasoning); }
            } else if (type === 'step-finish' || type === 'tool-call' || type === 'tool_call' || type === 'tool-result' || type === 'tool_result') {
              const rawToolCalls =
                parsed.payload?.stepResult?.output?.toolCalls ||
                parsed.payload?.stepResult?.toolCalls ||
                parsed.payload?.toolCalls ||
                parsed.stepResult?.output?.toolCalls ||
                parsed.stepResult?.toolCalls ||
                parsed.toolCalls ||
                (parsed.payload?.toolName || parsed.toolName || parsed.payload?.tool || parsed.tool ? [parsed.payload || parsed] : null);

              if (rawToolCalls && Array.isArray(rawToolCalls)) {
                for (const tc of rawToolCalls) {
                  callbacks.onToolCall?.({
                    tool: tc.toolName || tc.tool || tc.name || 'unknown',
                    input: typeof (tc.arguments || tc.args || tc.input) === 'string' ? (tc.arguments || tc.args || tc.input) : JSON.stringify(tc.arguments || tc.args || tc.input || {}),
                    output: tc.result || tc.output ? String(tc.result || tc.output) : undefined,
                  });
                }
              }
            } else if (type === 'finish' || type === 'complete' || type === 'done' || type === 'text-end') {
              if (!resolved) { resolved = true; callbacks.onFinish?.(accumulated, accumulatedReasoning); resolve({ threadId: 'test' }); }
              return;
            } else if (type === 'error') {
              callbacks.onError?.(parsed.error?.message || parsed.error || 'Stream error');
            }
          } catch { /* skip non-JSON */ }
        }
      }
    }

    for (const chunk of chunks) {
      buffer += chunk;
      processLines();
    }
    // flush
    processLines();
    if (!resolved) { resolved = true; callbacks.onFinish?.(accumulated); resolve({ threadId: 'test' }); }
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; } else { failed++; console.error('  FAIL:', msg); }
}

// Test 1: text-delta (type in JSON payload, no event: lines)
console.log('\n[Test 1] text-delta');
{
  const events = [];
  await parseSSEStream([
    'data: {"type":"text-delta","payload":{"text":"Hello"}}\n\ndata: {"type":"text-delta","payload":{"text":" world"}}\n\ndata: {"type":"finish"}\n\n',
  ], {
    onText: (t) => events.push(t),
    onFinish: (t) => { events.push('__finish__:' + t); },
  });
  assert(events[0] === 'Hello', 'first delta: ' + JSON.stringify(events[0]));
  assert(events[1] === 'Hello world', 'accumulated: ' + JSON.stringify(events[1]));
  assert(events[2] === '__finish__:Hello world', 'finish: ' + JSON.stringify(events[2]));
}

// Test 2: reasoning-delta triggers callback
console.log('\n[Test 2] reasoning-delta triggers onReasoning');
{
  let reasoned = false;
  let text = '';
  await parseSSEStream([
    'data: {"type":"reasoning-delta","payload":{"text":"thinking"}}\n\ndata: {"type":"text-delta","payload":{"text":"Answer"}}\n\ndata: {"type":"finish"}\n\n',
  ], {
    onReasoning: () => { reasoned = true; },
    onText: (t) => { text = t; },
  });
  assert(reasoned, 'onReasoning was called');
  assert(text === 'Answer', 'text after reasoning: ' + text);
}

// Test 3: [DONE] with a finish event first
console.log('\n[Test 3] [DONE] marker');
{
  let finished = false;
  await parseSSEStream([
    'data: {"type":"finish"}\n\ndata: [DONE]\n\n',
  ], {
    onFinish: () => { finished = true; },
  });
  assert(finished, 'finish called on finish event');
}

// Test 4: finish event without text-delta (e.g. empty response)
console.log('\n[Test 4] finish with no text-delta');
{
  let text = '__none__';
  await parseSSEStream([
    'data: {"type":"finish"}\n\n',
  ], {
    onFinish: (t) => { text = t; },
  });
  assert(text === '', 'empty string on finish: ' + JSON.stringify(text));
}

// Test 5: non-JSON data line (should be skipped)
console.log('\n[Test 5] non-JSON data line');
{
  let text = '';
  await parseSSEStream([
    'data: some-random-text\n\ndata: {"type":"text-delta","payload":{"text":"ok"}}\n\ndata: {"type":"finish"}\n\n',
  ], {
    onText: (t) => { text = t; },
  });
  assert(text === 'ok', 'skipped non-JSON: ' + text);
}

// Test 6: error event
console.log('\n[Test 6] error event');
{
  let errMsg = '';
  await parseSSEStream([
    'data: {"type":"error","error":"API quota exceeded"}\n\n',
  ], {
    onError: (e) => { errMsg = e; },
    onFinish: () => {},
  });
  assert(errMsg === 'API quota exceeded', 'error message: ' + errMsg);
}

// Test 7: tool-call event parsing
console.log('\n[Test 7] tool-call parsing');
{
  const toolCalls = [];
  await parseSSEStream([
    'data: {"type":"step-finish","payload":{"stepResult":{"output":{"toolCalls":[{"toolName":"web_search","args":{"query":"Notion teardown"}}]}}}}\n\ndata: {"type":"finish"}\n\n',
  ], {
    onToolCall: (tc) => { toolCalls.push(tc); },
  });
  assert(toolCalls.length === 1, 'tool call captured');
  assert(toolCalls[0]?.tool === 'web_search', 'tool name: ' + toolCalls[0]?.tool);
}

// Test 8: empty assistant message filtering helper
console.log('\n[Test 8] filtering empty assistant messages');
{
  const rawMsgs = [
    { id: '1', role: 'user', content: 'Hello' },
    { id: '2', role: 'assistant', content: '', reasoning: '', toolCalls: [] },
    { id: '3', role: 'assistant', content: '    ' },
    { id: '4', role: 'assistant', content: 'Actual response' },
  ];
  const filtered = rawMsgs.filter(m => {
    if (m.role === 'user') return true;
    const hasContent = Boolean(m.content && m.content.trim().length > 0);
    const hasReasoning = Boolean(m.reasoning && m.reasoning.trim().length > 0);
    const hasToolCalls = Boolean(m.toolCalls && m.toolCalls.length > 0);
    return hasContent || hasReasoning || hasToolCalls;
  });
  assert(filtered.length === 2, 'only valid messages retained, count=' + filtered.length);
  assert(filtered[1].content === 'Actual response', 'valid response kept');
}

// ── Live server test (optional) ──────────────────────────────────────────

const MASTRA_URL = process.env.MASTRA_URL;
if (MASTRA_URL) {
  console.log(`\n[Live] Testing against ${MASTRA_URL}...`);
  try {
    // Check server is alive
    const agentsRes = await fetch(`${MASTRA_URL}/api/agents`);
    assert(agentsRes.ok, `GET /api/agents -> ${agentsRes.status}`);
    const agents = await agentsRes.json();
    const agentIds = Object.keys(agents);
    console.log('  Agents:', agentIds.join(', '));

    if (agentIds.length > 0) {
      // Stream test
      const tid = crypto.randomUUID();
      const streamRes = await fetch(`${MASTRA_URL}/api/agents/${agentIds[0]}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          memory: { thread: tid, resource: 'smoke-test' },
        }),
      });
      assert(streamRes.ok, `POST /api/agents/${agentIds[0]}/stream -> ${streamRes.status}`);

      const ct = streamRes.headers.get('content-type') || '';
      console.log('  Content-Type:', ct);

      if (ct.includes('text/event-stream')) {
        let liveText = '';
        let liveFinished = false;
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const ln of lines) {
            if (ln.startsWith('data: ')) {
              const d = ln.slice(6);
              if (d === '[DONE]') { liveFinished = true; break; }
              try {
                const p = JSON.parse(d);
                if (p.type === 'text-delta') liveText += p.payload?.text || p.text || '';
                if (p.type === 'finish') liveFinished = true;
              } catch {}
            }
          }
          if (liveFinished) break;
        }

        assert(liveFinished, 'live stream finished');
        assert(liveText.length > 0, 'live stream produced text, length=' + liveText.length);
        console.log('  Received text length:', liveText.length);
      } else {
        // Non-streaming fallback
        const body = await streamRes.json();
        console.log('  Response (non-streaming):', JSON.stringify(body).slice(0, 200));
      }
    }
  } catch (err) {
    failed++;
    console.error('  Live test ERROR:', err.message);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);
process.exit(failed > 0 ? 1 : 0);
