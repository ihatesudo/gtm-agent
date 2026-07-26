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
    if (!raw) return [];
    const msgs: Message[] = JSON.parse(raw);
    return msgs.filter(m => {
      if (m.role === 'user') return true;
      const hasContent = Boolean(m.content && m.content.trim().length > 0);
      const hasReasoning = Boolean(m.reasoning && m.reasoning.trim().length > 0);
      const hasToolCalls = Boolean(m.toolCalls && m.toolCalls.length > 0);
      return hasContent || hasReasoning || hasToolCalls || Boolean(m.isError && m.error);
    });
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
  const streamingTextRef = useRef('');
  const streamingReasoningRef = useRef('');

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
    streamingTextRef.current = '';
    streamingReasoningRef.current = '';
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
      streamingTextRef.current = '';
      streamingReasoningRef.current = '';
    }
  }, [threads]);

  const handleSend = useCallback(
    async (content: string, options?: { model?: string, thinkingMode?: string }) => {
      if (!selectedAgentId || sending) return;
      setSending(true);
      setIsReasoning(false);
      currentToolCallsRef.current = [];
      setStreamingToolCalls([]);
      streamingTextRef.current = '';
      streamingReasoningRef.current = '';

      const activeThreadId = threadId || ('t-' + Date.now());
      const userMsg: Message = { id: 't-' + Date.now(), role: 'user', content, createdAt: new Date().toISOString() };
      setMessages(prev => [...prev, userMsg]);

      try {
        const result = await sendMessageStream(selectedAgentId, content, activeThreadId, {
          ...options,
          onText: (text) => { streamingTextRef.current = text; setIsReasoning(false); setStreamingText(text); },
          onReasoning: (reasoning) => { streamingReasoningRef.current = reasoning; setIsReasoning(true); setStreamingReasoning(reasoning); },
          onToolCall: (call) => {
            const tc: ToolCall = { id: 'tc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), ...call, status: 'success' as const };
            currentToolCallsRef.current = [...currentToolCallsRef.current, tc];
            setStreamingToolCalls(currentToolCallsRef.current);
          },
          onFinish: (fullText, reasoning, streamThreadId) => {
            const finalToolCalls = currentToolCallsRef.current;
            currentToolCallsRef.current = [];

            const hasContent = Boolean(fullText && fullText.trim().length > 0);
            const hasReasoning = Boolean(reasoning && reasoning.trim().length > 0);
            const hasToolCalls = Boolean(finalToolCalls && finalToolCalls.length > 0);

            const targetTid = streamThreadId || activeThreadId;

            if (hasContent || hasReasoning || hasToolCalls) {
              const assistantMsg: Message = {
                id: 'a-' + Date.now(),
                role: 'assistant',
                content: fullText,
                reasoning,
                toolCalls: hasToolCalls ? finalToolCalls : undefined,
                createdAt: new Date().toISOString(),
              };
              setMessages(msgs => {
                const updated = [...msgs, assistantMsg];
                saveThreadMessages(targetTid, updated);
                return updated;
              });
            }
            setStreamingToolCalls([]);
            setStreamingText('');
            setStreamingReasoning('');
            streamingTextRef.current = '';
            streamingReasoningRef.current = '';
            setIsReasoning(false);
          },
          onError: (err, partialContent, reasoning, errorThreadId) => {
            const partial = partialContent || streamingTextRef.current;
            const errorReasoning = reasoning || streamingReasoningRef.current;
            const errorToolCalls = currentToolCallsRef.current;
            const targetTid = errorThreadId || activeThreadId;
            const errorMessage: Message = {
              id: 'e-' + Date.now(),
              role: 'assistant',
              content: partial,
              partialContent: partial || undefined,
              reasoning: errorReasoning || undefined,
              toolCalls: errorToolCalls.length > 0 ? errorToolCalls : undefined,
              isError: true,
              error: err,
              createdAt: new Date().toISOString(),
            };
            setMessages(prev => {
              const updated = [...prev, errorMessage];
              saveThreadMessages(targetTid, updated);
              return updated;
            });
            currentToolCallsRef.current = [];
            setStreamingToolCalls([]);
            setStreamingText('');
            setStreamingReasoning('');
            streamingTextRef.current = '';
            streamingReasoningRef.current = '';
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
        const error = 'Request failed: ' + (err?.message || String(err));
        const partial = streamingTextRef.current;
        const errorMessage: Message = {
          id: 'e-' + Date.now(),
          role: 'assistant',
          content: partial,
          partialContent: partial || undefined,
          isError: true,
          error,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => {
          const updated = [...prev, errorMessage];
          saveThreadMessages(activeThreadId, updated);
          return updated;
        });
        setStreamingText('');
        setStreamingReasoning('');
        streamingTextRef.current = '';
        streamingReasoningRef.current = '';
      }
      setSending(false);
    },
    [selectedAgentId, threadId, sending],
  );

  const handleRetry = useCallback((messageId: string, options?: { model?: string, thinkingMode?: string }) => {
    if (sending) return;
    const failedIndex = messages.findIndex(message => message.id === messageId);
    if (failedIndex < 0) return;
    const previousUserMessage = [...messages.slice(0, failedIndex)].reverse().find(message => message.role === 'user');
    if (!previousUserMessage) return;
    setMessages(prev => prev.filter(message => message.id !== messageId));
    void handleSend(previousUserMessage.content, options);
  }, [handleSend, messages, sending]);

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


