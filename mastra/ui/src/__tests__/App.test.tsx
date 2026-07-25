import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

vi.mock('../lib/api', () => ({
  fetchAgents: vi.fn().mockResolvedValue([
    { id: 'director', name: 'GTM Director', description: 'Orchestrator' },
  ]),
  sendMessageStream: vi.fn(),
  fetchConnectivityStatus: vi.fn().mockResolvedValue(null),
}));

describe('App conversation threads', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
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

    // Wait for agents and threads to load
    await waitFor(() => {
      expect(screen.getByText('Q3 Growth Strategy')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Q3 Growth Strategy'));

    // Verify chat history rendered
    await waitFor(() => {
      expect(screen.getByText('What is our Q3 growth plan?')).toBeInTheDocument();
      expect(screen.getByText('Our Q3 growth plan focuses on paid search and SEO.')).toBeInTheDocument();
    });
  });
});
