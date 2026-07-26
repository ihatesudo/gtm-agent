import { useState, useRef, type KeyboardEvent } from 'react';
import Icon from './Icon';
import { ProviderWarning } from './ProviderWarning';
import { Dropdown } from './Dropdown';
import {
  MODEL_OPTIONS,
  THINKING_OPTIONS,
  shortAgentName as shortAgentNameFor,
  agentDetail,
} from './selectorMetadata';

import type { Agent } from '../types';

function shortAgentName(agent: Agent) {
  return shortAgentNameFor(agent.name, agent.id);
}

interface WelcomeViewProps {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onSend: (content: string, options?: { model?: string, thinkingMode?: string }) => void;
  sending: boolean;
}

const QUICK_PILLS = [
  { label: 'Market Teardown', prompt: 'Analyze Notion as if it were my client. Produce a full competitive teardown: positioning, pricing, GTM motion, content gaps, and 3 high-impact recommendations with execution steps. Output as a detailed memo.' },
  { label: 'Rewrite Landing Page', prompt: 'Rewrite the homepage hero section for a B2B SaaS that sells AI-powered contract review. Current headline: "AI for legal teams." Make it specific, benefit-driven, and include a subheadline, 3 social proof bullets, and a CTA. No follow-up questions, just output the copy.' },
  { label: 'Cold Email Sequence', prompt: 'Write a 3-email cold outreach sequence targeting CTOs at Series A startups for a devtools company. Short, direct, no follow-up questions. Include subject lines.' },
  { label: 'SEO Quick Wins', prompt: 'List 10 SEO quick wins for a SaaS blog that gets 5K monthly visits. Prioritize by effort vs impact. No questions, just actionable items.' },
  { label: 'Google Ads Pack', prompt: 'Write 5 responsive search ad headlines and 3 descriptions for a project management SaaS. Target: SMB owners. No follow-ups, just the copy.' },
];

export function WelcomeView({ agents, selectedAgentId, onSelectAgent, onSend, sending }: WelcomeViewProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('openrouter');
  const [thinkingMode, setThinkingMode] = useState('easy');
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
    autoResize(e.target);
  };

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      if (textareaRef.current) autoResize(textareaRef.current);
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={styles.eyebrow}>Your marketing co-pilot</span>
          <h1 style={styles.heading}>
            Plan your <span style={styles.headingEmphasis}>next growth move.</span>
          </h1>
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
            <div style={{ display: 'flex', gap: 6 }}>
              <Dropdown
                ariaLabel="Agent"
                value={selectedAgentId}
                options={agents.map(a => ({
                  value: a.id,
                  label: shortAgentName(a),
                  icon: a.id === 'director' ? 'target' : 'bot',
                  detail: { description: agentDetail(a.id, a.description) },
                }))}
                onChange={(v) => onSelectAgent(v)}
                disabled={sending}
                triggerWidth={100}
              />

              <Dropdown
                ariaLabel="Model"
                value={model}
                options={MODEL_OPTIONS}
                onChange={(v) => setModel(v)}
                disabled={sending}
              />

              <Dropdown
                ariaLabel="Thinking mode"
                value={thinkingMode}
                options={THINKING_OPTIONS}
                onChange={(v) => setThinkingMode(v)}
                disabled={sending}
                triggerWidth={82}
              />
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
              onClick={() => fillPrompt(pill.prompt)}
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
    fontFamily: 'var(--font-title, var(--font-serif))',
    fontSize: 42,
    fontWeight: 400,
    color: 'var(--text)',
    textAlign: 'center',
    letterSpacing: '0.04em',
    wordSpacing: '0.12em',
    lineHeight: 1.25,
    margin: '4px 0 2px',
  },
  headingEmphasis: {
    fontFamily: 'var(--font-serif)',
    fontStyle: 'italic',
    fontWeight: 400,
    color: 'var(--accent)',
    letterSpacing: '0.04em',
    paddingLeft: 4,
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
    fontSize: 11.5,
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    maxWidth: 110,
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

