import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatView from '../components/ChatView';
import type { Message } from '../types';

const mockAgent = { id: 'director', name: 'GTM Director', description: 'Orchestrator' };
const defaultProps = {
  agents: [mockAgent, { id: 'seo', name: 'SEO Specialist', description: 'SEO expert' }],
  selectedAgentId: 'director',
  onSelectAgent: vi.fn(),
  agent: mockAgent,
  messages: [] as any[],
  streamingText: '',
  streamingReasoning: '',
  sending: false,
  isReasoning: false,
  onSend: vi.fn(),
};

describe('ChatView', () => {
  it('renders agent header', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getAllByText('GTM Director').length).toBeGreaterThanOrEqual(1);
  });

  it('renders user and assistant messages', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Write a blog post', createdAt: '' },
      { id: '2', role: 'assistant', content: 'Here is a draft...', createdAt: '' },
    ];
    render(<ChatView {...defaultProps} messages={messages} />);
    expect(screen.getByText('Write a blog post')).toBeInTheDocument();
    expect(screen.getByText('Here is a draft...')).toBeInTheDocument();
  });

  it('shows typing indicator when sending and no streaming text', () => {
    render(<ChatView {...defaultProps} sending={true} isReasoning={true} />);
    expect(screen.getByText(/thinking process/i)).toBeInTheDocument();
  });

  it('shows pulse dots when not reasoning', () => {
    render(<ChatView {...defaultProps} sending={true} isReasoning={false} />);
    expect(document.querySelector('.pulse-circle')).toBeInTheDocument();
  });

  it('shows streaming text with cursor', () => {
    render(<ChatView {...defaultProps} streamingText="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows reasoning accordion for assistant message with reasoning', () => {
    const messages: Message[] = [
      { id: '1', role: 'assistant', content: 'The answer', reasoning: 'I need to think about this...', createdAt: '' },
    ];
    render(<ChatView {...defaultProps} messages={messages} />);
    expect(screen.getByRole('button', { name: /thought process/i })).toBeInTheDocument();
    expect(screen.getByText('The answer')).toBeInTheDocument();
  });

  it('toggles reasoning accordion on click', async () => {
    const messages: Message[] = [
      { id: '1', role: 'assistant', content: 'Final answer', reasoning: 'Step by step reasoning here', createdAt: '' },
    ];
    render(<ChatView {...defaultProps} messages={messages} />);
    const user = userEvent.setup();

    const toggle = screen.getByRole('button', { name: /thought process/i });
    await user.click(toggle);

    expect(screen.getByText('Step by step reasoning here')).toBeInTheDocument();
  });

  it('renders the input bar with send button', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('defaults model dropdown to OpenRouter', () => {
    render(<ChatView {...defaultProps} />);
    const modelSelect = screen.getByDisplayValue('OpenRouter');
    expect(modelSelect).toBeInTheDocument();
    expect((modelSelect as HTMLSelectElement).value).toBe('openrouter');
  });

  it('calls onSend on submit with default model "openrouter"', async () => {
    const onSend = vi.fn();
    render(<ChatView {...defaultProps} onSend={onSend} />);
    const user = userEvent.setup();

    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello', expect.objectContaining({ model: 'openrouter', thinkingMode: expect.any(String) }));
  });
});
