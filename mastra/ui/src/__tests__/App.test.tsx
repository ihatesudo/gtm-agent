import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchAgents: vi.fn().mockResolvedValue([
    { id: 'director', name: 'GTM Director', description: 'Orchestrator' },
    { id: 'seo', name: 'SEO Specialist', description: 'SEO expert' },
  ]),
  sendMessageStream: vi.fn(),
  fetchConnectivityStatus: vi.fn().mockResolvedValue(null),
}));

describe('App conversation threads regression suite', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
    vi.clearAllMocks();
  });

  it('renders threads from localStorage and loads message history when thread is clicked', async () => {
    const threadId = 'thread-123';
    const mockThreads = [
      { id: threadId, title: 'Q3 Growth Strategy', agentId: 'director' },
    ];
    const mockMessages = [
      { id: '1', role: 'user', content: 'What is our Q3 growth plan?', createdAt: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'Our Q3 growth plan focuses on paid search and SEO.', createdAt: new Date().toISOString() },
    ];

    localStorage.setItem('gtmagent_threads', JSON.stringify(mockThreads));
    localStorage.setItem(`gtmagent_thread_msgs_${threadId}`, JSON.stringify(mockMessages));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Q3 Growth Strategy')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Q3 Growth Strategy'));

    await waitFor(() => {
      expect(screen.getByText('What is our Q3 growth plan?')).toBeInTheDocument();
      expect(screen.getByText('Our Q3 growth plan focuses on paid search and SEO.')).toBeInTheDocument();
    });
  });

  it('saves streamed messages to localStorage and creates sidebar thread entry', async () => {
    const mockSend = vi.mocked(api.sendMessageStream).mockImplementation(
      async (_agentId, content, threadId, callbacks) => {
        const tid = threadId || 'thread-new-1';
        callbacks?.onText?.('Here is your strategy');
        callbacks?.onFinish?.('Here is your strategy', undefined, tid);
        return { threadId: tid };
      }
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('GTM Agent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText(/ask me anything about your marketing/i);
    await user.type(textarea, 'Create SEO campaign plan{enter}');

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('director', 'Create SEO campaign plan', expect.any(String), expect.any(Object));
    });

    await waitFor(() => {
      const threadsRaw = localStorage.getItem('gtmagent_threads');
      expect(threadsRaw).toBeTruthy();
      const threads = JSON.parse(threadsRaw!);
      expect(threads[0].title).toContain('Create SEO campaign plan');

      const msgsRaw = localStorage.getItem(`gtmagent_thread_msgs_${threads[0].id}`);
      expect(msgsRaw).toBeTruthy();
      const msgs = JSON.parse(msgsRaw!);
      expect(msgs).toHaveLength(2);
      expect(msgs[0].content).toBe('Create SEO campaign plan');
      expect(msgs[1].content).toBe('Here is your strategy');
    });
  });

  it('allows switching between multiple conversation threads', async () => {
    const thread1 = 't-1';
    const thread2 = 't-2';

    const mockThreads = [
      { id: thread1, title: 'First Conversation', agentId: 'director' },
      { id: thread2, title: 'Second Conversation', agentId: 'seo' },
    ];

    const msgs1 = [{ id: 'm1', role: 'user', content: 'Message from Topic 1', createdAt: new Date().toISOString() }];
    const msgs2 = [{ id: 'm2', role: 'user', content: 'Message from Topic 2', createdAt: new Date().toISOString() }];

    localStorage.setItem('gtmagent_threads', JSON.stringify(mockThreads));
    localStorage.setItem(`gtmagent_thread_msgs_${thread1}`, JSON.stringify(msgs1));
    localStorage.setItem(`gtmagent_thread_msgs_${thread2}`, JSON.stringify(msgs2));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('First Conversation')).toBeInTheDocument();
      expect(screen.getByText('Second Conversation')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Click first thread
    await user.click(screen.getByText('First Conversation'));
    await waitFor(() => {
      expect(screen.getByText('Message from Topic 1')).toBeInTheDocument();
      expect(screen.queryByText('Message from Topic 2')).not.toBeInTheDocument();
    });

    // Click second thread
    await user.click(screen.getByText('Second Conversation'));
    await waitFor(() => {
      expect(screen.getByText('Message from Topic 2')).toBeInTheDocument();
      expect(screen.queryByText('Message from Topic 1')).not.toBeInTheDocument();
    });
  });

  it('resets view when clicking New conversation', async () => {
    const threadId = 't-active';
    const mockThreads = [{ id: threadId, title: 'Active Chat', agentId: 'director' }];
    const mockMsgs = [{ id: 'm1', role: 'user', content: 'Existing message', createdAt: new Date().toISOString() }];

    localStorage.setItem('gtmagent_threads', JSON.stringify(mockThreads));
    localStorage.setItem(`gtmagent_thread_msgs_${threadId}`, JSON.stringify(mockMsgs));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Active Chat')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Active Chat'));

    await waitFor(() => {
      expect(screen.getByText('Existing message')).toBeInTheDocument();
    });

    // Click New conversation button
    await user.click(screen.getByText(/new conversation/i));

    await waitFor(() => {
      expect(screen.queryByText('Existing message')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/ask me anything about your marketing/i)).toBeInTheDocument();
    });
  });

  it('deletes thread and its stored messages when delete button is clicked', async () => {
    const threadId = 't-delete';
    const mockThreads = [{ id: threadId, title: 'Thread To Delete', agentId: 'director' }];
    const mockMsgs = [{ id: 'm1', role: 'user', content: 'To be deleted', createdAt: new Date().toISOString() }];

    localStorage.setItem('gtmagent_threads', JSON.stringify(mockThreads));
    localStorage.setItem(`gtmagent_thread_msgs_${threadId}`, JSON.stringify(mockMsgs));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Thread To Delete')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const threadItem = screen.getByText('Thread To Delete').closest('.thread-item')!;
    const deleteBtn = threadItem.querySelector('.delete-btn')!;

    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Thread To Delete')).not.toBeInTheDocument();
      expect(localStorage.getItem(`gtmagent_thread_msgs_${threadId}`)).toBeNull();
      const remainingThreads = JSON.parse(localStorage.getItem('gtmagent_threads') || '[]');
      expect(remainingThreads).toHaveLength(0);
    });
  });
});
