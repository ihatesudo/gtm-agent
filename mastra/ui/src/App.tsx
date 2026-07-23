import { useState, useEffect, useCallback } from 'react';
import type { Agent, Message } from './types';
import { fetchAgents, sendMessage } from './lib/api';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents().then(list => {
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) setSelectedAgentId(list[0].id);
    });
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAgentId || sending) return;
      setSending(true);

      setMessages(prev => [...prev, { id: 't-' + Date.now(), role: 'user', content, createdAt: new Date().toISOString() }]);

      try {
        const result = await sendMessage(selectedAgentId, content, threadId || undefined);
        if (result.threadId) setThreadId(result.threadId);
        const assistantMsg = result.messages.find(m => m.role === 'assistant');
        if (assistantMsg) setMessages(prev => [...prev, assistantMsg]);
      } catch {
        setMessages(prev => [...prev, { id: 'e-' + Date.now(), role: 'assistant', content: 'Request failed. Check the Mastra server.', createdAt: new Date().toISOString() }]);
      }
      setSending(false);
    },
    [selectedAgentId, threadId, sending],
  );

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const isNewChat = messages.length === 0;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onNewChat={handleNewChat}
        isNewChat={isNewChat}
      />
      <ChatView
        agent={selectedAgent}
        messages={messages}
        sending={sending}
        onSend={handleSend}
        isNewChat={isNewChat}
      />
    </div>
  );
}
