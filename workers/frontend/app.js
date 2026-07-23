// WebSocket URL Config
const WS_PROTO = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTO}//${location.host}/ws`;

// UI Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebarExpandBtn = document.getElementById('sidebar-expand-btn');
const newTaskBtn = document.getElementById('new-task-btn');
const tasksListEl = document.getElementById('tasks-list');
const connectionStatus = document.getElementById('connection-status');
const modelSelectBtn = document.getElementById('model-select-btn');
const modelDropdownMenu = document.getElementById('model-dropdown-menu');
const creditsCountEl = document.getElementById('credits-count');

// Welcome View Elements
const welcomeView = document.getElementById('welcome-view');
const promptInput = document.getElementById('prompt-input');
const submitPromptBtn = document.getElementById('submit-prompt-btn');
const desktopToggleBtn = document.getElementById('desktop-toggle-btn');
const quickActionPills = document.querySelectorAll('.quick-action-pill');

// Execution View Elements
const executionView = document.getElementById('execution-view');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatTextarea = document.getElementById('chat-textarea');
const chatSubmitBtn = document.getElementById('chat-submit-btn');
const chatDesktopToggle = document.getElementById('chat-desktop-toggle');
const chatUploadBtn = document.getElementById('chat-upload-btn');

// Resizer Elements
const splitResizer = document.getElementById('split-resizer');
const chatPanel = document.getElementById('chat-panel');
const desktopPanel = document.getElementById('desktop-panel');

// Browser Elements
const browserAddress = document.getElementById('browser-address');
const browserBackBtn = document.getElementById('browser-back-btn');
const browserForwardBtn = document.getElementById('browser-forward-btn');
const browserReloadBtn = document.getElementById('browser-reload-btn');
const browserOpenTabBtn = document.getElementById('browser-open-tab');
const closeDesktopBtn = document.getElementById('close-desktop-btn');
const maximizeDesktopBtn = document.getElementById('maximize-desktop-btn');

// Viewport screens
const desktopIdleScreen = document.getElementById('desktop-idle-screen');
const desktopSearchScreen = document.getElementById('desktop-search-screen');
const desktopAssetScreen = document.getElementById('desktop-asset-screen');
const ddgSearchTermDisplay = document.getElementById('ddg-search-term-display');
const ddgStatusText = document.getElementById('ddg-status-text');
const ddgResultsList = document.getElementById('ddg-results-list');
const assetIframe = document.getElementById('asset-iframe');
const assetMarkdownRenderer = document.getElementById('asset-markdown-renderer');

// Configuration Selectors (mapped backend options)
const roleSelect = document.getElementById('role-select');
const skillSelect = document.getElementById('skill-select');
const langSelect = document.getElementById('lang-select');

// App State
let ws = null;
let reconnectTimer = null;
let currentSessionId = null;
let sessions = [];
let credits = 300;
let isDesktopEnabled = true;
let isExecutionActive = false;
let currentThinkingBlock = null;
let activeToolTag = null;
let lastSearchQuery = '';

// Load data from localStorage
function initLocalData() {
  const savedSessions = localStorage.getItem('gtmagent_sessions');
  if (savedSessions) {
    try {
      sessions = JSON.parse(savedSessions);
    } catch (e) {
      sessions = [];
    }
  }
  
  const savedCredits = localStorage.getItem('gtmagent_credits');
  if (savedCredits !== null) {
    credits = parseInt(savedCredits, 10);
    creditsCountEl.textContent = credits;
  }
  
  // If no sessions, seed some mock past items to make the sidebar look authentic as in the screenshot
  if (sessions.length === 0) {
    sessions = [
      {
        id: 'mock-1',
        title: '如何获取类似PitchBook的数据源？',
        role: '',
        skill: '',
        messages: [
          { role: 'user', content: '如何获取类似PitchBook的数据源？' },
          { role: 'assistant', content: '要获取类似于 PitchBook 的私募股权、风险投资和并购数据源，你可以考虑以下几种替代方案：\n\n1. **商业数据库（高成本、高精度）**\n   - **Crunchbase Enterprise**: 最接近的替代品，提供API和批量数据导出。\n   - **S&P Capital IQ / PitchBook**: 原版服务。\n   - **Dealroom.co**: 欧洲及全球初创公司数据的极佳来源。\n\n2. **替代性与低成本方案**\n   - **Alternative.me**: 用于寻找替代SaaS数据。\n   - **爬虫与公开API**: 聚合行业新闻、LinkedIn招聘和Crunchbase免费数据接口。' }
        ]
      },
      {
        id: 'mock-2',
        title: '如何高效研发Unusual Whale功能并进行冷启动',
        role: '',
        skill: '',
        messages: []
      },
      {
        id: 'mock-3',
        title: '期权波动率策略与套利及实盘分析',
        role: '',
        skill: '',
        messages: []
      },
      {
        id: 'mock-4',
        title: 'Stripe 悉尼面试流程',
        role: '',
        skill: '',
        badgeCount: 2,
        messages: [
          { role: 'user', content: 'Stripe 悉尼面试流程是什么样的？' },
          { role: 'assistant', content: 'Stripe 悉尼分公司的面试流程通常包含以下几个阶段：\n\n1. **HR 沟通轮 (Initial Call)**：了解背景与动机。\n2. **技术评估 (Technical Screen)**：通常是一道实际的编码设计问题（Stripe注重代码可读性与健壮性而非LeetCode硬套路）。\n3. **现场面试 (Onsite - 4-5轮)**：\n   - **Integration / Bug Hunt**: 模拟集成Stripe API或调试现有系统。\n   - **System Design**: 系统架构设计。\n   - **Culture / Manager Fit**: 行为面试，强调Stripe核心价值观（如：认真、严谨、对开发体验的狂热追求）。' }
        ]
      }
    ];
    saveSessions();
  }
  
  renderTasksList();
}

function saveSessions() {
  localStorage.setItem('gtmagent_sessions', JSON.stringify(sessions));
}

function deductCredits(amount) {
  credits = Math.max(0, credits - amount);
  localStorage.setItem('gtmagent_credits', credits);
  creditsCountEl.textContent = credits;
}

// Render task list in sidebar
function renderTasksList() {
  tasksListEl.innerHTML = '';
  sessions.forEach(sess => {
    const item = document.createElement('button');
    item.className = `task-history-item ${sess.id === currentSessionId ? 'active' : ''}`;
    item.onclick = () => loadSession(sess.id);
    
    // Icon based on content
    let iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    if (sess.title.includes('Design') || sess.title.includes('设计')) {
      iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    } else if (sess.title.includes('Build') || sess.title.includes('网页')) {
      iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`;
    }
    
    let badgeHtml = '';
    if (sess.badgeCount) {
      badgeHtml = `<span class="task-badge-count">${sess.badgeCount}</span>`;
    }
    
    item.innerHTML = `
      <div class="task-title-content">
        ${iconSvg}
        <span class="task-title-text">${escapeHtml(sess.title)}</span>
      </div>
      ${badgeHtml}
    `;
    tasksListEl.appendChild(item);
  });
}

// Create new task / Reset welcome
function createNewTask() {
  currentSessionId = null;
  isExecutionActive = false;
  
  // Reset input UI
  promptInput.value = '';
  submitPromptBtn.disabled = true;
  welcomeView.classList.add('active');
  executionView.classList.remove('active');
  
  // Highlight New Task btn
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  newTaskBtn.classList.add('active');
  
  // Reset active task highlighting
  document.querySelectorAll('.task-history-item').forEach(el => el.classList.remove('active'));
  
  // Reset preview panel
  showDesktopScreen('idle');
  browserAddress.value = 'about:blank';
}

// Load existing chat session
function loadSession(id) {
  const sess = sessions.find(s => s.id === id);
  if (!sess) return;
  
  currentSessionId = id;
  isExecutionActive = true;
  
  // Switch visual buttons
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  renderTasksList(); // Re-render to highlight active item
  
  welcomeView.classList.remove('active');
  executionView.classList.add('active');
  
  // Populate chat history
  chatMessagesContainer.innerHTML = '';
  
  if (sess.messages && sess.messages.length > 0) {
    sess.messages.forEach(msg => {
      if (msg.role === 'user') {
        addUserMsgUI(msg.content);
      } else if (msg.role === 'assistant') {
        const assistantEl = createAssistantMsgUI();
        const contentEl = assistantEl.querySelector('.msg-content');
        
        // If there were thinking logs or tools executed
        if (msg.thinking) {
          const thinkBlock = createThinkingBlockUI(assistantEl);
          const body = thinkBlock.querySelector('.thinking-body');
          body.innerHTML = msg.thinking;
          thinkBlock.querySelector('.thinking-icon').className = 'thinking-icon done';
          thinkBlock.querySelector('.thinking-title-left span').textContent = 'Thinking Process';
        }
        
        contentEl.innerHTML = renderMarkdown(msg.content);
      }
    });
    scrollToBottom(chatMessagesContainer);
  }
  
  // Check if any assets were generated in this session and load in preview pane
  const savedAsset = sess.messages.find(m => m.savedAsset);
  if (savedAsset) {
    loadAssetInDesktop(savedAsset.savedAsset);
  } else {
    showDesktopScreen('idle');
  }
}

// Save active session message logs to localStorage
function saveMessageToCurrentSession(role, content, extra = {}) {
  if (!currentSessionId) return;
  const sess = sessions.find(s => s.id === currentSessionId);
  if (!sess) return;
  
  const msg = { role, content, ...extra };
  sess.messages.push(msg);
  saveSessions();
}

// WebSocket Connection Setup
function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'status-connected';
    
    // Send session init
    ws.send(JSON.stringify({ 
      type: 'session', 
      role: roleSelect.value || undefined, 
      skill: skillSelect.value || undefined, 
      language: langSelect.value 
    }));
    
    // Load lists from backend
    ws.send(JSON.stringify({ type: 'list_roles' }));
    ws.send(JSON.stringify({ type: 'list_skills' }));
  };

  ws.onclose = () => {
    connectionStatus.textContent = 'Offline (connecting...)';
    connectionStatus.className = 'status-disconnected';
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWSEvent(data);
    } catch (e) {
      console.error('Error parsing WS message', e);
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectWS, 3000);
}

// Handle streamed WebSocket payloads from Cloudflare worker
function handleWSEvent(data) {
  switch (data.type) {
    case 'thought':
      if (!currentThinkingBlock) {
        // Find latest assistant message or create one
        let lastMsg = chatMessagesContainer.lastElementChild;
        if (!lastMsg || !lastMsg.classList.contains('assistant')) {
          lastMsg = createAssistantMsgUI();
        }
        currentThinkingBlock = createThinkingBlockUI(lastMsg);
      }
      const body = currentThinkingBlock.querySelector('.thinking-body');
      body.textContent += data.content;
      
      // Auto open thinking
      if (!body.classList.contains('open')) {
        body.classList.add('open');
        currentThinkingBlock.querySelector('.arrow').classList.add('open');
      }
      scrollToBottom(chatMessagesContainer);
      break;

    case 'tool_call':
      logToolCall(data.tool, data.input);
      break;

    case 'tool_result':
      logToolResult(data.tool, data.result);
      break;

    case 'answer':
      removeTypingIndicator();
      let lastMsg = chatMessagesContainer.lastElementChild;
      if (!lastMsg || !lastMsg.classList.contains('assistant')) {
        lastMsg = createAssistantMsgUI();
      }
      const contentEl = lastMsg.querySelector('.msg-content');
      contentEl.innerHTML = renderMarkdown(data.content);
      scrollToBottom(chatMessagesContainer);
      break;

    case 'error':
      removeTypingIndicator();
      showErrorUI(data.content);
      break;

    case 'done':
      finalizeAgentRun();
      break;

    case 'roles':
      populateRoles(data.roles);
      break;

    case 'skills':
      populateSkills(data.categories);
      break;

    case 'role_set':
    case 'skill_set':
      // Updated options
      break;
  }
}

// Start executing a user request
function triggerPrompt(text) {
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  deductCredits(10);
  
  // Set execution active
  isExecutionActive = true;
  welcomeView.classList.remove('active');
  executionView.classList.add('active');
  
  // 1. Create a new session if not loaded
  if (!currentSessionId) {
    currentSessionId = 'sess-' + Date.now();
    const newSess = {
      id: currentSessionId,
      title: text.length > 30 ? text.slice(0, 30) + '...' : text,
      role: roleSelect.value,
      skill: skillSelect.value,
      messages: []
    };
    sessions.unshift(newSess); // Put at top
    saveSessions();
    renderTasksList();
  }
  
  // 2. Add User message to UI and save
  addUserMsgUI(text);
  saveMessageToCurrentSession('user', text);
  
  // 3. Create Assistant container and show Typing Indicator
  createAssistantMsgUI();
  showTypingIndicator();
  
  // 4. Send request via WS
  ws.send(JSON.stringify({ type: 'message', content: text }));
  
  // Toggle desktop view based on user selection or defaults
  if (isDesktopEnabled) {
    desktopPanel.classList.remove('hidden');
    chatDesktopToggle.classList.add('active');
    showDesktopScreen('idle');
  } else {
    desktopPanel.classList.add('hidden');
    chatDesktopToggle.classList.remove('active');
  }
  
  // Disable inputs while running
  promptInput.value = '';
  promptInput.disabled = true;
  chatTextarea.value = '';
  chatTextarea.disabled = true;
  submitPromptBtn.disabled = true;
  chatSubmitBtn.disabled = true;
}

// Clean up execution states when run finishes
function finalizeAgentRun() {
  // Turn off thinking loader
  if (currentThinkingBlock) {
    currentThinkingBlock.querySelector('.thinking-icon').className = 'thinking-icon done';
    currentThinkingBlock.querySelector('.thinking-title-left span').textContent = 'Thinking Process';
    currentThinkingBlock = null;
  }
  
  removeTypingIndicator();
  
  // Save assistant message to current session logs
  const lastMsg = chatMessagesContainer.lastElementChild;
  if (lastMsg && lastMsg.classList.contains('assistant')) {
    const text = lastMsg.querySelector('.msg-content').textContent || '';
    const thinkingHtml = lastMsg.querySelector('.thinking-body')?.innerHTML || '';
    
    // Check if R2 asset was generated
    const address = browserAddress.value;
    let savedAssetName = '';
    if (address.includes('/api/assets/')) {
      savedAssetName = address.slice(address.indexOf('/api/assets/') + '/api/assets/'.length);
    }
    
    saveMessageToCurrentSession('assistant', text, {
      thinking: thinkingHtml,
      savedAsset: savedAssetName || undefined
    });
  }
  
  // Re-enable inputs
  promptInput.disabled = false;
  chatTextarea.disabled = false;
  chatTextarea.focus();
  
  // Reset buttons
  checkInputState(promptInput, submitPromptBtn);
  checkInputState(chatTextarea, chatSubmitBtn);
}

// Manage desktop browser screens
function showDesktopScreen(type) {
  desktopIdleScreen.classList.remove('active');
  desktopSearchScreen.classList.remove('active');
  desktopAssetScreen.classList.remove('active');
  
  if (type === 'idle') {
    desktopIdleScreen.classList.add('active');
    browserAddress.value = 'about:blank';
    browserBackBtn.disabled = true;
    browserForwardBtn.disabled = true;
  } else if (type === 'search') {
    desktopSearchScreen.classList.add('active');
    browserAddress.value = 'https://duckduckgo.com';
  } else if (type === 'asset') {
    desktopAssetScreen.classList.add('active');
  }
}

// Load asset in IFrame or Markdown Renderer
function loadAssetInDesktop(filename) {
  showDesktopScreen('asset');
  const assetUrl = `${location.origin}/api/assets/${encodeURIComponent(filename)}`;
  browserAddress.value = assetUrl;
  
  if (filename.endsWith('.html')) {
    assetIframe.classList.remove('hidden');
    assetMarkdownRenderer.classList.add('hidden');
    assetIframe.src = assetUrl;
  } else {
    // Render text/markdown directly in custom view
    assetIframe.classList.add('hidden');
    assetMarkdownRenderer.classList.remove('hidden');
    assetMarkdownRenderer.innerHTML = '<h4>Loading asset content...</h4>';
    
    fetch(assetUrl)
      .then(res => res.text())
      .then(text => {
        assetMarkdownRenderer.innerHTML = filename.endsWith('.md') 
          ? renderMarkdown(text) 
          : `<pre><code>${escapeHtml(text)}</code></pre>`;
      })
      .catch(err => {
        assetMarkdownRenderer.innerHTML = `<h4 style="color: var(--danger)">Error loading asset: ${escapeHtml(err)}</h4>`;
      });
  }
  
  // Enable back/forward if applicable
  browserBackBtn.disabled = false;
}

// Simulated typewriter search execution for the virtual browser screen
function logToolCall(tool, input) {
  if (currentThinkingBlock) {
    const body = currentThinkingBlock.querySelector('.thinking-body');
    let parsedInput = input;
    try {
      const obj = JSON.parse(input);
      parsedInput = JSON.stringify(obj, null, 2);
    } catch (e) {}
    
    // Append a log entry
    const logItem = document.createElement('div');
    logItem.className = 'thought-log-item';
    logItem.innerHTML = `
      <div class="agent-tool-tag" id="tool-run-${tool}">
        <span class="tool-indicator"></span>
        <span>Running <strong>${tool}</strong></span>
      </div>
      <pre style="margin-top: 4px; background: #fafafb; color: #52525b; border: 1px solid #e4e4e7; font-size: 11px; padding: 6px 10px;"><code>${escapeHtml(parsedInput)}</code></pre>
    `;
    body.appendChild(logItem);
    scrollToBottom(chatMessagesContainer);
  }
  
  // Visual actions in the virtual browser
  if (tool === 'web_search') {
    let query = '';
    try {
      query = JSON.parse(input).query;
    } catch(e) {
      query = input;
    }
    lastSearchQuery = query;
    showDesktopScreen('search');
    ddgSearchTermDisplay.textContent = 'Searching...';
    ddgStatusText.textContent = `DuckDuckGo: Submitting search query "${query}"...`;
    ddgResultsList.innerHTML = '';
    
    // Typewriter simulated animation in virtual browser address
    browserAddress.value = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  } else if (tool === 'save_asset') {
    let filename = '';
    try {
      filename = JSON.parse(input).filename;
    } catch (e) {
      filename = 'asset.md';
    }
    browserAddress.value = `https://gtm-agent.local/saving/${filename}`;
  }
}

// Tool output logs and updates to the virtual browser
function logToolResult(tool, result) {
  // Update tool tag indicator in thinking block
  const toolTag = document.getElementById(`tool-run-${tool}`);
  if (toolTag) {
    toolTag.className = 'agent-tool-tag done';
    toolTag.id = ''; // clear ID so next call works
  }
  
  if (tool === 'web_search') {
    ddgSearchTermDisplay.textContent = lastSearchQuery;
    ddgStatusText.textContent = 'DuckDuckGo search completed. Parsing top results...';
    
    // Generate beautiful list of search results to display in the virtual browser viewport
    ddgResultsList.innerHTML = '';
    const results = [];
    const lines = result.split('\n');
    let currentResult = null;
    
    lines.forEach(line => {
      const match = line.match(/^\d+\.\s+(.+?)\s+—\s+(https?:\/\/\S+)/);
      if (match) {
        if (currentResult) results.push(currentResult);
        currentResult = { title: match[1], url: match[2], snippet: '' };
      } else if (line.trim().startsWith('   ') && currentResult) {
        currentResult.snippet += line.trim() + ' ';
      }
    });
    if (currentResult) results.push(currentResult);
    
    if (results.length > 0) {
      results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'ddg-result-card';
        card.innerHTML = `
          <a class="ddg-result-title" href="#" onclick="event.preventDefault(); loadSimulatedWebpage('${res.title}', '${res.url}')">${escapeHtml(res.title)}</a>
          <div class="ddg-result-url">${escapeHtml(res.url)}</div>
          <div class="ddg-result-snippet">${escapeHtml(res.snippet || 'Click to view matching page context.')}</div>
        `;
        ddgResultsList.appendChild(card);
      });
    } else {
      ddgResultsList.innerHTML = `<div style="color: var(--text-dim); font-size: 13px; font-style: italic;">${escapeHtml(result.slice(0, 300))}</div>`;
    }
  } else if (tool === 'save_asset') {
    // Extract filename and load it inside the browser view
    const match = result.match(/Saved to assets\/(\S+)/);
    if (match && match[1]) {
      loadAssetInDesktop(match[1]);
    }
  }
}

// Simulated page viewing within the virtual desktop
window.loadSimulatedWebpage = function(title, url) {
  browserAddress.value = url;
  showDesktopScreen('asset');
  assetIframe.classList.add('hidden');
  assetMarkdownRenderer.classList.remove('hidden');
  
  assetMarkdownRenderer.innerHTML = `
    <div style="border-bottom: 1px solid var(--border-light); padding-bottom: 12px; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #1e3a8a;">${escapeHtml(title)}</h2>
      <a href="${url}" target="_blank" style="font-size: 12px; color: #059669; text-decoration: none;">Open actual tab: ${escapeHtml(url)}</a>
    </div>
    <p><em>Simulating connection and sandbox sandbox rendering for page: ${escapeHtml(url)}...</em></p>
    <p>The GTM Agent has read and extracted the text contents of this website to execute the marketing tasks. Top takeaways have been saved in the thinking logs on the left.</p>
  `;
};

// UI Creators
function addUserMsgUI(text) {
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `
    <div class="msg-avatar">U</div>
    <div class="msg-body">
      <div class="msg-content">${escapeHtml(text)}</div>
    </div>
  `;
  chatMessagesContainer.appendChild(div);
  scrollToBottom(chatMessagesContainer);
}

function createAssistantMsgUI() {
  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  div.innerHTML = `
    <div class="msg-avatar">M</div>
    <div class="msg-body">
      <div class="msg-content"></div>
    </div>
  `;
  chatMessagesContainer.appendChild(div);
  scrollToBottom(chatMessagesContainer);
  return div;
}

function createThinkingBlockUI(assistantMsgEl) {
  const container = assistantMsgEl.querySelector('.msg-body');
  const div = document.createElement('div');
  div.className = 'thinking-block';
  div.innerHTML = `
    <div class="thinking-header">
      <div class="thinking-title-left">
        <span class="thinking-icon"></span>
        <span>Thinking...</span>
      </div>
      <span class="arrow">▶</span>
    </div>
    <div class="thinking-body"></div>
  `;
  
  // Toggle body click
  div.querySelector('.thinking-header').onclick = () => {
    const body = div.querySelector('.thinking-body');
    const arrow = div.querySelector('.arrow');
    body.classList.toggle('open');
    arrow.classList.toggle('open');
  };
  
  // Place before the final answer content if exists
  const contentEl = container.querySelector('.msg-content');
  container.insertBefore(div, contentEl);
  return div;
}

function showTypingIndicator() {
  removeTypingIndicator();
  const div = document.createElement('div');
  div.className = 'chat-msg assistant typing-indicator-container';
  div.innerHTML = `
    <div class="msg-avatar">M</div>
    <div class="msg-body">
      <div class="message-loader">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessagesContainer.appendChild(div);
  scrollToBottom(chatMessagesContainer);
}

function removeTypingIndicator() {
  const el = chatMessagesContainer.querySelector('.typing-indicator-container');
  if (el) el.remove();
}

function showErrorUI(content) {
  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  div.innerHTML = `
    <div class="msg-avatar" style="background: var(--danger)">!</div>
    <div class="msg-body">
      <div class="msg-content" style="color: var(--danger); font-weight: 500; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); border-radius: 8px; padding: 12px 16px;">
        ${escapeHtml(content)}
      </div>
    </div>
  `;
  chatMessagesContainer.appendChild(div);
  scrollToBottom(chatMessagesContainer);
}

// Populate config lists
function populateRoles(roles) {
  roleSelect.innerHTML = '<option value="">Director (default)</option>';
  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.title || r.name;
    roleSelect.appendChild(opt);
  });
}

function populateSkills(categories) {
  skillSelect.innerHTML = '<option value="">None (general)</option>';
  categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = cat.category;
    cat.skills.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    });
    skillSelect.appendChild(group);
  });
}

// Helpers
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

function checkInputState(inputEl, btnEl) {
  const text = inputEl.value.trim();
  btnEl.disabled = !text;
}

// Basic markdown parsing
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  
  // Pre blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Headers
  html = html.replace(/### (.+)/g, '<h3>$1</h3>');
  html = html.replace(/## (.+)/g, '<h2>$1</h2>');
  html = html.replace(/# (.+)/g, '<h1>$1</h1>');
  // Bold & Italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Lists
  html = html.replace(/^- (.+)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Paragraphs
  const paragraphs = html.split(/\n\n+/);
  return paragraphs.map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '').join('');
}

// Textarea auto growers
function autoGrowTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// Drag & Resize Split Panel Logic
let isDraggingResizer = false;

splitResizer.addEventListener('mousedown', (e) => {
  isDraggingResizer = true;
  document.body.style.cursor = 'col-resize';
  splitResizer.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDraggingResizer) return;
  
  const containerWidth = document.getElementById('workspace-container').clientWidth;
  const rawX = e.clientX - sidebar.clientWidth;
  const percentage = (rawX / containerWidth) * 100;
  
  // Constrain range 20% to 80%
  const constrained = Math.max(20, Math.min(80, percentage));
  
  chatPanel.style.flex = constrained;
  desktopPanel.style.flex = 100 - constrained;
});

document.addEventListener('mouseup', () => {
  if (isDraggingResizer) {
    isDraggingResizer = false;
    document.body.style.cursor = '';
    splitResizer.classList.remove('dragging');
  }
});


// Event listeners setup
function setupEventListeners() {
  // Sidebar Toggle
  toggleSidebarBtn.onclick = () => {
    sidebar.classList.add('collapsed');
    sidebarExpandBtn.classList.remove('hidden');
  };
  
  sidebarExpandBtn.onclick = () => {
    sidebar.classList.remove('collapsed');
    sidebarExpandBtn.classList.add('hidden');
  };
  
  // Close preview panel button
  closeDesktopBtn.onclick = () => {
    isDesktopEnabled = false;
    desktopPanel.classList.add('hidden');
    chatDesktopToggle.classList.remove('active');
    desktopToggleBtn.classList.remove('active-toggle');
    desktopToggleBtn.classList.add('disabled');
  };
  
  // Maximize desktop toggle fullscreen
  maximizeDesktopBtn.onclick = () => {
    desktopPanel.classList.toggle('fullscreen');
  };
  
  // Model selector dropdown toggles
  modelSelectBtn.onclick = (e) => {
    e.stopPropagation();
    modelDropdownMenu.classList.toggle('hidden');
  };
  
  document.addEventListener('click', () => {
    modelDropdownMenu.classList.add('hidden');
  });
  
  modelDropdownMenu.querySelectorAll('.dropdown-option').forEach(opt => {
    opt.onclick = () => {
      modelDropdownMenu.querySelectorAll('.dropdown-option').forEach(el => el.classList.remove('active'));
      opt.classList.add('active');
      modelSelectBtn.querySelector('span').textContent = opt.textContent.split(' (')[0];
    };
  });
  
  // New task button
  newTaskBtn.onclick = createNewTask;
  
  // Prompt triggers
  promptInput.oninput = () => {
    checkInputState(promptInput, submitPromptBtn);
    autoGrowTextarea(promptInput);
  };
  
  submitPromptBtn.onclick = () => {
    triggerPrompt(promptInput.value);
  };
  
  promptInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (promptInput.value.trim()) {
        triggerPrompt(promptInput.value);
      }
    }
  };
  
  // Chat textarea triggers
  chatTextarea.oninput = () => {
    checkInputState(chatTextarea, chatSubmitBtn);
    autoGrowTextarea(chatTextarea);
  };
  
  chatSubmitBtn.onclick = () => {
    triggerPrompt(chatTextarea.value);
  };
  
  chatTextarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatTextarea.value.trim()) {
        triggerPrompt(chatTextarea.value);
      }
    }
  };
  
  // Desktop mode triggers (Welcome prompt card)
  desktopToggleBtn.onclick = () => {
    isDesktopEnabled = !isDesktopEnabled;
    desktopToggleBtn.classList.toggle('active-toggle');
    if (isDesktopEnabled) {
      desktopToggleBtn.classList.remove('disabled');
    } else {
      desktopToggleBtn.classList.add('disabled');
    }
  };
  
  // Chat desktop toggle buttons
  chatDesktopToggle.onclick = () => {
    isDesktopEnabled = !isDesktopEnabled;
    chatDesktopToggle.classList.toggle('active');
    desktopPanel.classList.toggle('hidden');
  };
  
  // Quick Action pills
  quickActionPills.forEach(pill => {
    pill.onclick = () => {
      const pr = pill.getAttribute('data-prompt');
      promptInput.value = pr;
      autoGrowTextarea(promptInput);
      checkInputState(promptInput, submitPromptBtn);
      promptInput.focus();
      
      // Auto submit after short delay to look responsive
      setTimeout(() => {
        triggerPrompt(pr);
      }, 400);
    };
  });
  
  // Address bar controls
  browserReloadBtn.onclick = () => {
    const address = browserAddress.value;
    if (address.startsWith('http')) {
      if (assetIframe.src === address) {
        assetIframe.contentWindow.location.reload();
      } else {
        assetIframe.src = address;
      }
    }
  };
  
  browserOpenTabBtn.onclick = () => {
    const address = browserAddress.value;
    if (address.startsWith('http')) {
      window.open(address, '_blank');
    }
  };
  
  // Map configuration dropdown events directly to WS updates
  roleSelect.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_role', role: roleSelect.value || undefined }));
    }
  });

  skillSelect.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_skill', skill: skillSelect.value || undefined }));
    }
  });

  langSelect.addEventListener('change', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'session', language: langSelect.value }));
    }
  });
}

// Carousel slider auto rotation logic
function initCarousel() {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  let currentIdx = 0;
  let interval = null;
  
  // Define slide content to cycle through
  const slideData = [
    { title: 'Create Skills', desc: 'Automate your workflow with custom Skills for repetitive tasks.' },
    { title: 'Deep Research Agent', desc: 'Browse multiple websites, synthesize findings, and generate comprehensive intelligence briefs.' },
    { title: 'Real-time Canvas', desc: 'Connect tools, visually build workflow node maps, and orchestrate campaign deployments.' },
    { title: 'Cloud Execution Sandbox', desc: 'Write, debug, and preview interactive websites and micro-apps in a secure environment.' },
    { title: 'Multi-platform Integrations', desc: 'Directly deploy resources across Google Ads, Meta Ads, LinkedIn, Klaviyo, and more.' }
  ];
  
  function updateSlide(idx) {
    currentIdx = idx;
    
    // Update active dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
    });
    
    // Transition slides
    const activeSlide = document.querySelector('.carousel-slide');
    const info = activeSlide.querySelector('.slide-info');
    
    // Add fade out
    info.style.opacity = 0;
    setTimeout(() => {
      info.querySelector('h3').textContent = slideData[idx].title;
      info.querySelector('p').textContent = slideData[idx].desc;
      info.style.opacity = 1;
    }, 150);
  }
  
  dots.forEach((dot, i) => {
    dot.onclick = () => {
      updateSlide(i);
      resetTimer();
    };
  });
  
  function startTimer() {
    interval = setInterval(() => {
      let next = (currentIdx + 1) % slideData.length;
      updateSlide(next);
    }, 4500);
  }
  
  function resetTimer() {
    clearInterval(interval);
    startTimer();
  }
  
  startTimer();
}

// App Entry Point
window.addEventListener('DOMContentLoaded', () => {
  initLocalData();
  setupEventListeners();
  initCarousel();
  connectWS();
});
