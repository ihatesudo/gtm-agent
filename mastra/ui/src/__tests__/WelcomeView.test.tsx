import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeView } from '../components/WelcomeView';

describe('WelcomeView', () => {
  const defaultProps = {
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

  it('sends predefined prompt when a pill is clicked', async () => {
    const onSend = vi.fn();
    render(<WelcomeView {...defaultProps} onSend={onSend} />);
    const user = userEvent.setup();

    const pill = screen.getByText('Content Strategy');
    await user.click(pill);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toContain('content strategy');
  });

  it('renders textarea for custom prompt', () => {
    render(<WelcomeView {...defaultProps} />);
    expect(screen.getByPlaceholderText(/ask me anything|type.*message|what.*want/i)).toBeInTheDocument();
  });

  it('defaults model dropdown to OpenRouter', () => {
    render(<WelcomeView {...defaultProps} />);
    const modelSelect = screen.getByDisplayValue('OpenRouter (Auto)');
    expect(modelSelect).toBeInTheDocument();
    expect((modelSelect as HTMLSelectElement).value).toBe('openrouter');
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
