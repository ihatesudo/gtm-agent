import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, Message, ToolCall } from './types';
import { fetchAgents, sendMessageStream } from './lib/api';
import Sidebar from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import ChatView from './components/ChatView';

import { SettingsModal, loadSettings, applyFontToDocument, type UserCustomization } from './components/SettingsModal';

interface ThreadMeta {
  id: string;
  title: string;
  agentId: string;
}

const STORAGE_KEY = 'gtmagent_threads';

function loadThreads(): ThreadMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: ThreadMeta[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch { /* storage full */ }
}

function summarize(content: string): string {
  return content.length > 60 ? content.slice(0, 60) + '…' : content;
}

function loadThreadMessages(threadId: string): Message[] {
  try {
    const raw = localStorage.getItem(`gtmagent_thread_msgs_${threadId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveThreadMessages(threadId: string, messages: Message[]) {
  try {
    localStorage.setItem(`gtmagent_thread_msgs_${threadId}`, JSON.stringify(messages));
  } catch { /* storage full */ }
}

function deleteThreadMessages(threadId: string) {
  try {
    localStorage.removeItem(`gtmagent_thread_msgs_${threadId}`);
  } catch { /* ignore */ }
}

import { ObservabilityModal } from './components/ObservabilityModal';
import { AgentEditorModal } from './components/AgentEditorModal';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [isReasoning, setIsReasoning] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>(loadThreads);

  const [settings, setSettings] = useState<UserCustomization>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isObservabilityOpen, setIsObservabilityOpen] = useState(false);
  const [isAgentEditorOpen, setIsAgentEditorOpen] = useState(false);
  const currentToolCallsRef = useRef<ToolCall[]>([]);

  useEffect(() => {
    applyFontToDocument(settings.fontStyle);
  }, [settings.fontStyle]);

  useEffect(() => {
    fetchAgents().then(list => {
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) setSelectedAgentId(list[0].id);
    });
  }, []);

  // Save active thread's messages to localStorage whenever messages update
  useEffect(() => {
    if (threadId && messages.length > 0) {
      saveThreadMessages(threadId, messages);
    }
  }, [threadId, messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setStreamingReasoning('');
    setIsReasoning(false);
    setStreamingToolCalls([]);
    currentToolCallsRef.current = [];
    setThreadId(null);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    const targetThread = threads.find(t => t.id === id);
    if (targetThread) {
      setThreadId(id);
      if (targetThread.agentId) {
        setSelectedAgentId(targetThread.agentId);
      }
      const savedMsgs = loadThreadMessages(id);
      setMessages(savedMsgs);
      setStreamingText('');
      setStreamingReasoning('');
      setIsReasoning(false);
      setStreamingToolCalls([]);
      currentToolCallsRef.current = [];
    }
  }, [threads]);

  const handleSend = useCallback(
    async (content: string, options?: { model?: string, thinkingMode?: string }) => {
      if (!selectedAgentId || sending) return;
      setSending(true);
      setIsReasoning(false);
      currentToolCallsRef.current = [];
      setStreamingToolCalls([]);

      const activeThreadId = threadId || ('t-' + Date.now());
      const userMsg: Message = { id: 't-' + Date.now(), role: 'user', content, createdAt: new Date().toISOString() };
      setMessages(prev => [...prev, userMsg]);

      try {
        const result = await sendMessageStream(selectedAgentId, content, activeThreadId, {
          ...options,
          onText: (text) => { setIsReasoning(false); setStreamingText(text); },
          onReasoning: (reasoning) => { setIsReasoning(true); setStreamingReasoning(reasoning); },
          onToolCall: (call) => {
            const tc: ToolCall = { id: 'tc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), ...call, status: 'success' as const };
            currentToolCallsRef.current = [...currentToolCallsRef.current, tc];
            setStreamingToolCalls(currentToolCallsRef.current);
          },
          onFinish: (fullText, reasoning, streamThreadId) => {
            const finalToolCalls = currentToolCallsRef.current;
            currentToolCallsRef.current = [];
            const assistantMsg: Message = {
              id: 'a-' + Date.now(),
              role: 'assistant',
              content: fullText,
              reasoning,
              toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
              createdAt: new Date().toISOString(),
            };
            const targetTid = streamThreadId || activeThreadId;
            setMessages(msgs => {
              const updated = [...msgs, assistantMsg];
              saveThreadMessages(targetTid, updated);
              return updated;
            });
            setStreamingToolCalls([]);
            setStreamingText('');
            setStreamingReasoning('');
            setIsReasoning(false);
          },
          onError: (err) => {
            setMessages(prev => [...prev, {
              id: 'e-' + Date.now(), role: 'assistant',
              content: 'Error: ' + err,
              createdAt: new Date().toISOString(),
            }]);
            setStreamingText('');
            setIsReasoning(false);
          },
        });
        const finalTid = result.threadId || activeThreadId;
        setThreadId(finalTid);
        setThreads(prev => {
          const existing = prev.find(t => t.id === finalTid);
          if (existing) return prev;
          const updated = [{ id: finalTid, title: summarize(content), agentId: selectedAgentId }, ...prev];
          saveThreads(updated);
          return updated;
        });
      } catch (err: any) {
        setMessages(prev => [...prev, {
          id: 'e-' + Date.now(), role: 'assistant',
          content: 'Request failed: ' + (err?.message || String(err)),
          createdAt: new Date().toISOString(),
        }]);
        setStreamingText('');
      }
      setSending(false);
    },
    [selectedAgentId, threadId, sending],
  );

  const handleDeleteThread = useCallback((id: string) => {
    deleteThreadMessages(id);
    setThreads(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveThreads(updated);
      return updated;
    });
    if (threadId === id) {
      handleNewChat();
    }
  }, [threadId, handleNewChat]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: 'var(--main-bg)' }}>
      <Sidebar
        onNewChat={handleNewChat}
        threads={threads}
        selectedThreadId={threadId}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenObservability={() => setIsObservabilityOpen(true)}
        onOpenAgentEditor={() => setIsAgentEditorOpen(true)}
      />
      {isEmpty ? (
        <WelcomeView
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onSend={handleSend}
          sending={sending}
        />
      ) : (
        <ChatView
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          agent={selectedAgent}
          messages={messages}
          streamingText={streamingText}
          streamingReasoning={streamingReasoning}
          streamingToolCalls={streamingToolCalls}
          sending={sending}
          isReasoning={isReasoning}
          onSend={handleSend}
        />
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />
      <ObservabilityModal
        isOpen={isObservabilityOpen}
        onClose={() => setIsObservabilityOpen(false)}
      />
      <AgentEditorModal
        isOpen={isAgentEditorOpen}
        onClose={() => setIsAgentEditorOpen(false)}
        agents={agents}
        selectedAgentId={selectedAgentId}
      />
    </div>
  );
}




