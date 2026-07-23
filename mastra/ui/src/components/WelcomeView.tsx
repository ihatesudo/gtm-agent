import { useState, useRef, type KeyboardEvent } from 'react';

interface WelcomeViewProps {
  onSend: (content: string) => void;
  sending: boolean;
}

const QUICK_PILLS = [
  { label: 'Content Strategy', prompt: 'Create a 3-month content strategy for a SaaS product launching in Q3. Include topic clusters, distribution channels, and KPI targets.' },
  { label: 'SEO Audit', prompt: 'Run a technical SEO audit for a B2B website. List the top 10 issues to fix by priority.' },
  { label: 'Competitor Analysis', prompt: 'Analyze top 3 competitors for an AI writing assistant. Compare features, pricing, positioning, and GTM strategy.' },
  { label: 'Email Campaign', prompt: 'Design a 5-email welcome sequence for a new SaaS user. Include subject lines, body copy, and CTA for each email.' },
  { label: 'Ad Copy', prompt: 'Write 5 Google Ads headlines and 3 description variations for a project management tool. Target SMB owners.' },
];

export function WelcomeView({ onSend, sending }: WelcomeViewProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>What can I do for you?</h1>

        <div style={styles.promptBox}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your marketing..."
            rows={1}
            disabled={sending}
            style={styles.textarea}
          />
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <button style={styles.toolBtn} title="Attach files">📎</button>
              <button style={styles.toolBtn} title="Web Canvas">🔗</button>
              <button style={styles.toolBtn} title="GTM Desktop">🖥️</button>
              <button style={styles.toolBtn} title="Voice input">🎤</button>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                ...styles.sendBtn,
                opacity: !input.trim() || sending ? 0.5 : 1,
              }}
              aria-label="Send message"
            >
              →
            </button>
          </div>
        </div>

        <div style={styles.pillsContainer}>
          {QUICK_PILLS.map((pill) => (
            <button
              key={pill.label}
              onClick={() => onSend(pill.prompt)}
              disabled={sending}
              className="pill"
              style={styles.pill}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--main-bg)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: 680,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  heading: {
    fontFamily: 'var(--font-serif)',
    fontSize: 36,
    fontWeight: 400,
    color: 'var(--text)',
    textAlign: 'center',
    letterSpacing: '-0.02em',
  },
  promptBox: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  textarea: {
    width: '100%',
    minHeight: 56,
    maxHeight: 200,
    padding: '18px 20px 12px',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.5,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px 10px',
    borderTop: '1px solid var(--border)',
  },
  toolbarLeft: {
    display: 'flex',
    gap: 2,
  },
  toolBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 16,
    lineHeight: 1,
    opacity: 0.5,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  pillsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pill: {
    padding: '8px 18px',
    borderRadius: 9999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
};
