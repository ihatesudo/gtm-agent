import { useState, useRef, type KeyboardEvent } from 'react';
import Icon from './Icon';
import { ProviderWarning } from './ProviderWarning';

interface WelcomeViewProps {
  onSend: (content: string, options?: { model?: string, thinkingMode?: string }) => void;
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
  const [model, setModel] = useState('openrouter/auto');
  const [thinkingMode, setThinkingMode] = useState('medium');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed, { model, thinkingMode });
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={styles.eyebrow}>Your marketing co-pilot</span>
          <h1 style={styles.heading}>Plan your next growth move.</h1>
          <p style={styles.subheading}>Start with a campaign goal, audience, or channel challenge. Your team will turn it into an actionable plan.</p>
        </div>

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
          <div style={{ padding: '0 14px' }}>
            <ProviderWarning model={model} />
          </div>
          <div style={styles.toolbar}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                disabled={sending}
                style={styles.select}
              >
                <option value="openrouter/auto">OpenRouter (Auto - Default)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Vertex AI)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Vertex AI)</option>
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gpt-4o">GPT-4o</option>
              </select>

              <select 
                value={thinkingMode} 
                onChange={(e) => setThinkingMode(e.target.value)}
                disabled={sending}
                style={styles.select}
              >
                <option value="none">No Thinking</option>
                <option value="easy">Thinking: Easy</option>
                <option value="medium">Thinking: Medium</option>
                <option value="hard">Thinking: Hard</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={styles.hint}>Enter to send</span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  ...styles.sendBtn,
                  opacity: !input.trim() || sending ? 0.45 : 1,
                  boxShadow: input.trim() && !sending ? '0 2px 8px rgba(217, 97, 78, 0.3)' : 'none',
                }}
                aria-label="Send message"
              >
                <Icon name="arrow-up" size={18} />
              </button>
            </div>
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
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-light)';
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.transform = 'none';
              }}
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
    padding: '32px 24px',
  },
  card: {
    width: '100%',
    maxWidth: 680,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
  },
  heading: {
    fontFamily: 'var(--font-serif)',
    fontSize: 38,
    fontWeight: 400,
    color: 'var(--text)',
    textAlign: 'center',
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  promptBox: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
    transition: 'all 0.2s ease',
  },
  textarea: {
    width: '100%',
    minHeight: 64,
    maxHeight: 200,
    padding: '18px 20px 12px',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.55,
    fontFamily: 'inherit',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px 12px',
    borderTop: '1px solid var(--border-light)',
    background: 'var(--surface)',
  },
  select: {
    background: 'var(--surface-hover)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: 'var(--accent-light)',
    padding: '4px 12px',
    borderRadius: 'var(--radius-full)',
  },
  subheading: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
    textAlign: 'center',
    maxWidth: 520,
  },
  hint: { color: 'var(--text-tertiary)', fontSize: 12, paddingLeft: 4, fontWeight: 500 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: 'none',
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  pillsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    maxWidth: 620,
  },
  pill: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.15s ease',
  },
};

