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

  it('renders partial failed responses with a retry button', async () => {
    const onRetry = vi.fn();
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Retry this request', createdAt: '' },
      {
        id: '2',
        role: 'assistant',
        content: 'Partial answer',
        partialContent: 'Partial answer',
        isError: true,
        error: 'Stream interrupted',
        createdAt: '',
      },
    ];

    render(<ChatView {...defaultProps} messages={messages} onRetry={onRetry} />);
    expect(screen.getByText('Partial answer')).toBeInTheDocument();
    expect(screen.getByText('Stream interrupted')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: /retry response/i }));
    expect(onRetry).toHaveBeenCalledWith('2', expect.objectContaining({ model: 'openrouter' }));
  });

  it('shows typing indicator when sending and no streaming text', () => {
    render(<ChatView {...defaultProps} sending={true} isReasoning={false} />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('shows pulse dots when sending', () => {
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

  // ── Textarea auto-resize contract (regression: chat textarea was collapsing) ──
  // BUG: the chat textarea set `flex: 1` + an inline `maxHeight: 150` + a JS
  // cap of 140px. The flex shorthand `1 1 0%` let the flexbox *shrink* the
  // textarea below its content once the inline height was set, producing a
  // ~31px crushed input. WelcomeView (the home screen) does it right:
  // default flex (0 1 auto), `minHeight/maxHeight` 64/200, height driven by
  // `scrollHeight`. These tests lock that contract for ChatView too.
  describe('textarea auto-resize', () => {
    it('does not set flex:1 on the textarea (flex would let it collapse)', () => {
      render(<ChatView {...defaultProps} />);
      const ta = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement;
      const flex = getComputedStyle(ta).flex;
      // `0 1 auto` (default) is fine; `1 1 0%` / `1 1 auto` / `1` is the bug.
      expect(flex.startsWith('1'), `flex="${flex}" shrinks the textarea under content`).toBe(false);
    });

    it('does not hard-cap maxHeight below content height (inline maxHeight ≤ 140 caused collapse)', () => {
      render(<ChatView {...defaultProps} />);
      const ta = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement;
      const maxH = getComputedStyle(ta).maxHeight;
      // The home textarea caps at 200px. Anything ≤ 150px is the buggy config.
      const px = parseInt(maxH, 10);
      expect(Number.isNaN(px) || px >= 200, `maxHeight="${maxH}" is too small — chat textarea collapses`).toBe(true);
    });

    it('caps inline height at 200px (matches WelcomeView), not 140', async () => {
      render(<ChatView {...defaultProps} />);
      const ta = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement;
      // jsdom has no layout, so scrollHeight is always 0. Stub it to a tall
      // value so the component's autoResize handler computes a capped height.
      // Stub must live on the actual DOM node the handler reads from (the same
      // node React passes to onChange), so define it AFTER render resolves it.
      Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 600 });
      // userEvent drives React's onChange → component's handleInput → autoResize.
      await userEvent.setup().type(ta, 'x');
      // After resize, inline height must be capped at 200 (WelcomeView parity),
      // never the buggy 140.
      expect(ta.style.height).toBe('200px');
    });

    it('resets inline height on send (no stale tall height left over)', async () => {
      const onSend = vi.fn();
      render(<ChatView {...defaultProps} onSend={onSend} />);
      const user = userEvent.setup();
      const ta = screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement;
      await user.type(ta, 'first message with enough text to grow\nand more\nand more');
      // sanity: typing set an inline height
      expect(ta.style.height).not.toBe('');
      await user.keyboard('{Enter}');
      // After send, the textarea is cleared and its height reset to auto.
      expect(onSend).toHaveBeenCalled();
      expect(ta.value).toBe('');
      expect(ta.style.height).toBe('auto');
    });
  });

  it('defaults model dropdown to the pinned OpenRouter free model (Nemotron Ultra)', () => {
    render(<ChatView {...defaultProps} />);
    // The model Dropdown trigger shows the pinned free model label (was
    // "OpenRouter" with the old native <select>; now it names the concrete
    // free model so users know what they're getting).
    const modelTrigger = screen.getByRole('button', { name: /^model$/i });
    expect(modelTrigger).toHaveTextContent('Nemotron Ultra');
  });

  it('model dropdown opens and shows hover detail with free tag + capabilities', async () => {
    const user = userEvent.setup();
    render(<ChatView {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^model$/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Free tag chip is visible for the free option.
    expect(screen.getByText('free')).toBeInTheDocument();
    // Hover the Nemotron option → capability detail card appears.
    await user.hover(screen.getByRole('option', { name: /Nemotron/i }));
    expect(screen.getByText(/1M ctx/)).toBeInTheDocument();
  });

  it('Tab key moves focus through the controls in DOM order (textarea → selectors → send)', async () => {
    const user = userEvent.setup();
    render(<ChatView {...defaultProps} />);
    // Type first so the Send button is enabled and becomes a Tab stop
    // (when the textarea is empty, Send is disabled and Tab skips it).
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, 'hello');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    // First Tab → the first selector trigger (Agent dropdown button).
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Agent');
    // Continue forward through Model, Thinking, then Send.
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Model');
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Thinking mode');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /send/i }));
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

  // ── Markdown rendering ──────────────────────────────────────────────────

  describe('FormattedMessage – numbered lists', () => {
    it('renders each numbered item as a separate list entry (not one blob)', () => {
      const content = [
        '1. **Optimize Title Tags:** Ensure keyword-rich titles.',
        '2. **Improve Internal Linking:** Add relevant links.',
        '3. **Enhance Image Alt Text:** Descriptive alt text.',
      ].join('\n');

      const messages: Message[] = [
        { id: '1', role: 'assistant', content, createdAt: '' },
      ];
      render(<ChatView {...defaultProps} messages={messages} />);

      // Each item's bold label should be independently findable as a <strong>
      expect(screen.getByText('Optimize Title Tags:')).toBeInTheDocument();
      expect(screen.getByText('Improve Internal Linking:')).toBeInTheDocument();
      expect(screen.getByText('Enhance Image Alt Text:')).toBeInTheDocument();
    });

    it('renders numbered item labels (1. 2. 3.) in the DOM', () => {
      const content = '1. First item\n2. Second item\n3. Third item';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });

    it('does NOT concatenate numbered items into one paragraph', () => {
      const content = '1. Alpha content here\n2. Beta content here\n3. Gamma content here';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      // None of the raw "1. Alpha...2. Beta" joined string should appear in DOM
      expect(screen.queryByText(/Alpha content here.*Beta content here/s)).not.toBeInTheDocument();
    });
  });

  describe('FormattedMessage – bullet lists', () => {
    it('renders bullet items as separate <li> elements', () => {
      const content = '* **Product:** Notion\n* **Target Audience:** Teams\n* **Market:** SaaS';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      expect(screen.getByText('Product:')).toBeInTheDocument();
      expect(screen.getByText('Target Audience:')).toBeInTheDocument();
      expect(screen.getByText('Market:')).toBeInTheDocument();
    });

    it('renders bullet markers (•) for each item', () => {
      const content = '- First bullet\n- Second bullet\n- Third bullet';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      const bullets = screen.getAllByText('•');
      expect(bullets.length).toBe(3);
    });
  });

  describe('FormattedMessage – inline formatting', () => {
    it('renders **bold** as <strong>', () => {
      const messages: Message[] = [
        { id: '1', role: 'assistant', content: 'This is **important** text.', createdAt: '' },
      ];
      render(<ChatView {...defaultProps} messages={messages} />);
      const strong = document.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('important');
    });

    it('renders _italic_ as <em>', () => {
      const messages: Message[] = [
        { id: '1', role: 'assistant', content: 'This is _emphasized_ text.', createdAt: '' },
      ];
      render(<ChatView {...defaultProps} messages={messages} />);
      const em = document.querySelector('em');
      expect(em).toBeInTheDocument();
      expect(em?.textContent).toBe('emphasized');
    });

    it('renders `inline code` as <code>', () => {
      const messages: Message[] = [
        { id: '1', role: 'assistant', content: 'Use `npm install` to install.', createdAt: '' },
      ];
      render(<ChatView {...defaultProps} messages={messages} />);
      const code = document.querySelector('code');
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toBe('npm install');
    });

    it('does NOT show raw ** markers in the output', () => {
      const messages: Message[] = [
        { id: '1', role: 'assistant', content: '**High Impact** result', createdAt: '' },
      ];
      render(<ChatView {...defaultProps} messages={messages} />);
      expect(screen.queryByText('**High Impact**')).not.toBeInTheDocument();
    });
  });

  describe('FormattedMessage – code blocks', () => {
    it('renders a fenced code block with language label', () => {
      const content = '```typescript\nconst x = 1;\n```';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('shows a "Copy code" button for fenced code blocks', () => {
      const content = '```python\nprint("hello")\n```';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      expect(screen.getByText('Copy code')).toBeInTheDocument();
    });

    it('does not render triple-backtick fence markers in the output', () => {
      const content = '```js\nconsole.log("test");\n```';
      const messages: Message[] = [{ id: '1', role: 'assistant', content, createdAt: '' }];
      render(<ChatView {...defaultProps} messages={messages} />);

      expect(screen.queryByText('```js')).not.toBeInTheDocument();
      expect(screen.queryByText('```')).not.toBeInTheDocument();
    });
  });

  describe('Streaming text – markdown rendering', () => {
    it('renders bold in streaming text (not raw **)', () => {
      render(<ChatView {...defaultProps} streamingText="**High Impact / Low Effort:**" />);
      const strong = document.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('High Impact / Low Effort:');
      expect(screen.queryByText('**High Impact / Low Effort:**')).not.toBeInTheDocument();
    });

    it('renders numbered list items in streaming text as separate entries', () => {
      const streamingText = '1. First item\n2. Second item\n3. Third item';
      render(<ChatView {...defaultProps} streamingText={streamingText} />);

      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });

    it('renders bullet list in streaming text as separate bullet items', () => {
      const streamingText = '* Alpha\n* Beta\n* Gamma';
      render(<ChatView {...defaultProps} streamingText={streamingText} />);

      const bullets = screen.getAllByText('•');
      expect(bullets.length).toBe(3);
    });

    it('renders the Notion onboarding response with all 5 bullet items visible', () => {
      const streamingText = [
        "Hi there! I'm ready to help. Could you provide:",
        '* **Product:** (You\'ve already mentioned Notion)',
        '* **Target Audience:** Who is Notion primarily trying to reach?',
        '* **Market:** What specific market does Notion operate in?',
        '* **Budget:** What is the hypothetical budget for this analysis?',
        '* **Timeline:** Do you have a specific timeline in mind?',
      ].join('\n');

      render(<ChatView {...defaultProps} streamingText={streamingText} />);

      expect(screen.getByText('Product:')).toBeInTheDocument();
      expect(screen.getByText('Target Audience:')).toBeInTheDocument();
      expect(screen.getByText('Market:')).toBeInTheDocument();
      expect(screen.getByText('Budget:')).toBeInTheDocument();
      expect(screen.getByText('Timeline:')).toBeInTheDocument();

      // All 5 bullets should be present
      const bullets = screen.getAllByText('•');
      expect(bullets.length).toBe(5);
    });
  });
});
