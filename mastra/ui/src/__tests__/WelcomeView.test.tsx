import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeView } from '../components/WelcomeView';

const mockAgents = [
  { id: 'director', name: 'GTM Director', description: 'Orchestrator' },
  { id: 'seo', name: 'SEO Specialist', description: 'SEO expert' },
];

describe('WelcomeView', () => {
  const defaultProps = {
    agents: mockAgents,
    selectedAgentId: 'director',
    onSelectAgent: vi.fn(),
    onSend: vi.fn(),
    sending: false,
  };

  it('renders the heading', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByText(/next growth move/i)).toBeInTheDocument();
  });

  it('renders quick-action pills', () => {
    render(<WelcomeView {...defaultProps} />);
    const pills = screen.getAllByRole('button').filter(b =>
      b.className.includes('pill')
    );
    expect(pills.length).toBeGreaterThanOrEqual(3);
  });

  it('fills textarea when a pill is clicked', async () => {
    render(<WelcomeView {...defaultProps} />);
    const user = userEvent.setup();

    const pill = screen.getByText('Cold Email Sequence');
    await user.click(pill);

    const textarea = screen.getByPlaceholderText(/ask me anything/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('cold outreach');
  });

  it('renders textarea for custom prompt', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByPlaceholderText(/ask me anything|type.*message|what.*want/i)).toBeInTheDocument();
  });

  it('renders agent dropdown (Dropdown trigger shows the selected agent)', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /agent/i })).toHaveTextContent('Director');
  });

  it('defaults model dropdown to the pinned OpenRouter free model (Nemotron Ultra)', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^model$/i })).toHaveTextContent('Nemotron Ultra');
  });

  it('sends custom prompt with default model "openrouter" on submit', async () => {
    const onSend = vi.fn();
    render(<WelcomeView {...defaultProps} onSend={onSend} />);
    const user = userEvent.setup();

    const textarea = screen.getByPlaceholderText(/ask me anything|type.*message|what.*want/i);
    await user.type(textarea, 'Write a blog post');

    const submitBtn = screen.getByRole('button', { name: /send|submit|→/i });
    await user.click(submitBtn);

    expect(onSend).toHaveBeenCalledWith('Write a blog post', expect.objectContaining({ model: 'openrouter', thinkingMode: expect.any(String) }));
  });

  it('sends custom prompt on Enter (without Shift)', async () => {
    const onSend = vi.fn();
    render(<WelcomeView {...defaultProps} onSend={onSend} />);
    const user = userEvent.setup();

    const textarea = screen.getByPlaceholderText(/ask me anything|type.*message|what.*want/i);
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello', expect.objectContaining({ model: expect.any(String), thinkingMode: expect.any(String) }));
  });

  it('does not send empty prompt', async () => {
    const onSend = vi.fn();
    render(<WelcomeView {...defaultProps} onSend={onSend} />);
    const user = userEvent.setup();

    const submitBtn = screen.getByRole('button', { name: /send|submit|→/i });
    await user.click(submitBtn);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables input while sending', () => {
    render(<WelcomeView {...defaultProps} sending={true} />);
    const textarea = screen.getByPlaceholderText(/ask me anything|type.*message|what.*want/i);
    expect(textarea).toBeDisabled();
  });

  it('renders toolbar with submit button', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /send|submit|→/i })).toBeInTheDocument();
  });
});
