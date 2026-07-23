import { useState, useEffect, useCallback } from 'react';
import type { Agent, Message } from './types';
import { fetchAgents, sendMessageStream } from './lib/api';
import Sidebar from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import ChatView from './components/ChatView';

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

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [isReasoning, setIsReasoning] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>(loadThreads);

  useEffect(() => {
    fetchAgents().then(list => {
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) setSelectedAgentId(list[0].id);
    });
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setStreamingReasoning('');
    setIsReasoning(false);
    setThreadId(null);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAgentId || sending) return;
      setSending(true);
      setIsReasoning(false);

      const userMsg: Message = { id: 't-' + Date.now(), role: 'user', content, createdAt: new Date().toISOString() };
      setMessages(prev => [...prev, userMsg]);

      try {
        const result = await sendMessageStream(selectedAgentId, content, threadId || undefined, {
          onText: (text) => { setIsReasoning(false); setStreamingText(text); },
          onReasoning: (reasoning) => { setIsReasoning(true); setStreamingReasoning(reasoning); },
          onFinish: (fullText, reasoning) => {
            const assistantMsg: Message = {
              id: 'a-' + Date.now(),
              role: 'assistant',
              content: fullText,
              reasoning,
              createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, assistantMsg]);
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
        if (result.threadId) {
          setThreadId(result.threadId);
          setThreads(prev => {
            const existing = prev.find(t => t.id === result.threadId);
            if (existing) return prev;
            const updated = [{ id: result.threadId!, title: summarize(content), agentId: selectedAgentId }, ...prev];
            saveThreads(updated);
            return updated;
          });
        }
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

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onNewChat={handleNewChat}
        threads={threads}
      />
      {isEmpty ? (
        <WelcomeView onSend={handleSend} sending={sending} />
      ) : (
        <ChatView
          agent={selectedAgent}
          messages={messages}
            streamingText={streamingText}
            streamingReasoning={streamingReasoning}
            sending={sending}
            isReasoning={isReasoning}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
