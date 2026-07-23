const WS_PROTO = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTO}//${location.host}/ws`;

let ws = null;
let reconnectTimer = null;
let currentMsgEl = null;
let isStreaming = false;
let thinkingBody = null;

const input = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const messagesEl = document.getElementById('messages');
const statusEl = document.getElementById('connection-status');
const roleSelect = document.getElementById('role-select');
const skillSelect = document.getElementById('skill-select');
const langSelect = document.getElementById('lang-select');

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status-connected';
    sendBtn.disabled = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    ws.send(JSON.stringify({ type: 'session', role: roleSelect.value || undefined, skill: skillSelect.value || undefined, language: langSelect.value }));
    loadOptions();
  };

  ws.onclose = () => {
    statusEl.textContent = 'Disconnected (reconnecting...)';
    statusEl.className = 'status-disconnected';
    sendBtn.disabled = true;
    scheduleReconnect();
  };

  ws.onerror = () => { ws.close(); };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleEvent(data);
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 2000);
}

function handleEvent(data) {
  switch (data.type) {
    case 'thought':
      if (!currentMsgEl) break;
      if (!thinkingBody) {
        const block = document.createElement('div');
        block.className = 'thinking-block';
        block.innerHTML = `<div class="thinking-header"><span class="arrow">▶</span> Thinking...</div><div class="thinking-body"></div>`;
        currentMsgEl.querySelector('.bubble').prepend(block);
        thinkingBody = block.querySelector('.thinking-body');
        block.querySelector('.thinking-header').addEventListener('click', () => {
          thinkingBody.classList.toggle('open');
          block.querySelector('.arrow').classList.toggle('open');
        });
      }
      thinkingBody.textContent += data.content;
      if (!thinkingBody.classList.contains('open')) {
        thinkingBody.classList.add('open');
        thinkingBody.parentElement.querySelector('.arrow').classList.add('open');
      }
      scrollToBottom();
      break;

    case 'tool_call':
      addToolCall(data.tool, data.input);
      break;

    case 'tool_result':
      addToolResult(data.result);
      scrollToBottom();
      break;

    case 'answer':
      showAnswer(data.content);
      scrollToBottom();
      break;

    case 'error':
      showError(data.content);
      break;

    case 'done':
      finalizeMessage();
      break;

    case 'roles':
      populateRoles(data.roles);
      break;

    case 'skills':
      populateSkills(data.categories);
      break;

    case 'role_set':
      updateInputHint();
      break;

    case 'skill_set':
      updateInputHint();
      break;
  }
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addAssistantMessage() {
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = '<div class="bubble"></div>';
  messagesEl.appendChild(div);
  currentMsgEl = div;
  thinkingBody = null;
  return div;
}

function showAnswer(content) {
  if (!currentMsgEl) addAssistantMessage();
  const bubble = currentMsgEl.querySelector('.bubble');
  removeTypingIndicator();
  if (!content) return;
  const existingText = bubble.innerHTML.replace(/<p>.*<\/p>/, '');
  bubble.innerHTML = renderMarkdown(content);
}

function addToolCall(tool, input) {
  if (!currentMsgEl) addAssistantMessage();
  removeTypingIndicator();
  const bubble = currentMsgEl.querySelector('.bubble');
  const el = document.createElement('div');
  el.className = 'tool-call';
  let displayInput = input;
  try { const parsed = JSON.parse(input); displayInput = JSON.stringify(parsed).slice(0, 100); } catch {}
  el.innerHTML = `<span class="tool-icon">🔧</span><span class="tool-name">${tool}</span><span class="tool-input">${escapeHtml(displayInput)}</span>`;
  bubble.appendChild(el);
}

function addToolResult(result) {
  const bubble = currentMsgEl?.querySelector('.bubble');
  if (!bubble) return;
  const el = document.createElement('div');
  el.className = 'tool-result';
  el.textContent = result.length > 200 ? result.slice(0, 200) + '…' : result;
  bubble.appendChild(el);
}

function showError(content) {
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = `<div class="bubble" style="border-color: var(--danger); color: var(--danger);">${escapeHtml(content)}</div>`;
  messagesEl.appendChild(div);
  finalizeMessage();
}

function finalizeMessage() {
  isStreaming = false;
  currentMsgEl = null;
  thinkingBody = null;
  removeTypingIndicator();
  sendBtn.disabled = false;
  input.disabled = false;
  input.focus();
}

function removeTypingIndicator() {
  const el = messagesEl.querySelector('.typing-indicator');
  if (el) el.remove();
}

function addTypingIndicator() {
  removeTypingIndicator();
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  messagesEl.appendChild(div);
  scrollToBottom();
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/### (.+)/g, '<h3>$1</h3>');
  html = html.replace(/## (.+)/g, '<h2>$1</h2>');
  html = html.replace(/# (.+)/g, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.+)/gm, '<li>$1</li>');
  const olMatch = html.match(/(<li>.*<\/li>\n?)+/g);
  if (olMatch && !html.includes('<ul>')) {
    html = html.replace(/(?:<li>.*<\/li>\n?)+/g, '<ol>$&</ol>');
  }
  const paragraphs = html.split(/\n\n+/);
  return paragraphs.map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '').join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming || !ws || ws.readyState !== WebSocket.OPEN) return;

  addUserMessage(text);
  addAssistantMessage();
  addTypingIndicator();

  isStreaming = true;
  sendBtn.disabled = true;
  input.disabled = true;
  input.value = '';

  ws.send(JSON.stringify({ type: 'message', content: text }));
}

function loadOptions() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'list_roles' }));
    ws.send(JSON.stringify({ type: 'list_skills' }));
  }
}

function populateRoles(roles) {
  roleSelect.innerHTML = '<option value="">Director (default)</option>';
  for (const r of roles) {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.title || r.name;
    roleSelect.appendChild(opt);
  }
}

function populateSkills(categories) {
  skillSelect.innerHTML = '<option value="">None (general)</option>';
  for (const cat of categories) {
    const group = document.createElement('optgroup');
    group.label = cat.category;
    for (const name of cat.skills) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    }
    skillSelect.appendChild(group);
  }
}

function updateInputHint() {
  const parts = [];
  if (roleSelect.value) parts.push(`role:${roleSelect.value}`);
  if (skillSelect.value) parts.push(`skill:${skillSelect.value}`);
  input.placeholder = parts.length
    ? `[${parts.join(' · ')}] What should we work on?`
    : 'What should we work on today?';
}

roleSelect.addEventListener('change', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'set_role', role: roleSelect.value || undefined }));
  }
  updateInputHint();
});

skillSelect.addEventListener('change', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'set_skill', skill: skillSelect.value || undefined }));
  }
  updateInputHint();
});

langSelect.addEventListener('change', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'session', language: langSelect.value }));
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

sendBtn.addEventListener('click', sendMessage);

connect();
