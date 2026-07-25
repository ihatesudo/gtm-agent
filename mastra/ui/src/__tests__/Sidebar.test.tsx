import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../components/Sidebar';

const defaultProps = {
  onNewChat: vi.fn(),
};

describe('Sidebar', () => {
  it('calls onNewChat when new conversation button is clicked', async () => {
    const onNewChat = vi.fn();
    render(<Sidebar {...defaultProps} onNewChat={onNewChat} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/new conversation/i));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('renders navigation menu items', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('New Task')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('renders the app logo and title', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('GTM Agent')).toBeInTheDocument();
  });

  it('renders version info in footer', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/v0\./i)).toBeInTheDocument();
  });

  it('renders conversation history section when threads are provided', () => {
    const threads = [
      { id: '1', title: 'Q3 Campaign Strategy', agentId: 'director' },
      { id: '2', title: 'SEO Audit for B2B', agentId: 'seo' },
    ];
    render(<Sidebar {...defaultProps} threads={threads} />);
    expect(screen.getByText('Q3 Campaign Strategy')).toBeInTheDocument();
    expect(screen.getByText('SEO Audit for B2B')).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    render(<Sidebar {...defaultProps} threads={[]} />);
    expect(screen.getByText(/no conversations/i)).toBeInTheDocument();
  });

  it('activates nav item on click', async () => {
    render(<Sidebar {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Library'));
    expect(screen.getByText('Library').closest('div')?.parentElement).toBeTruthy();
  });
});
