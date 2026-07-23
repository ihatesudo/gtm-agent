import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Agent, Message } from '../types';

interface Props {
  agent?: Agent;
  messages: Message[];
  streamingText: string;
  streamingReasoning?: string;
  sending: boolean;
  isReasoning: boolean;
  onSend: (content: string) => void;
}

function ReasoningAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split('\n').filter(Boolean);
  const summary = lines.length <= 1 ? text.slice(0, 80) : lines[0].slice(0, 80);

  return (
    <div style={{
      marginBottom: 10, borderRadius: 8, overflow: 'hidden',
      border: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <button onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '6px 10px', border: 'none', background: 'var(--surface-hover)',
          cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: 10 }}>▶</span>
        <span style={{ opacity: 0.6 }}>🧠</span>
        {open ? 'Thought process' : `Thought process · ${summary}${text.length > 80 ? '…' : ''}`}
      </button>
      {open && (
        <div style={{
          padding: '8px 12px', fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
          borderTop: '1px solid var(--border)',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

export default function ChatView({ agent, messages, streamingText, streamingReasoning, sending, isReasoning, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending || !agent) return;
    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', background: 'var(--main-bg)' }}>
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--surface-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>
          {agent ? agent.id === 'director' ? '🎯' : '🧑‍💼' : '?'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{agent?.name || 'Select an agent'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent?.description?.slice(0, 100) || ''}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, margin: '0 auto' }}>
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: isUser ? 'var(--accent)' : 'var(--surface-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, flexShrink: 0, marginTop: 2,
                  color: isUser ? '#fff' : 'var(--text)',
                }}>
                  {isUser ? 'U' : agent?.id === 'director' ? '🎯' : '🤖'}
                </div>
                <div style={{ maxWidth: '88%' }}>
                  {!isUser && msg.reasoning && (
                    <ReasoningAccordion text={msg.reasoning} />
                  )}
                  <div style={{
                    background: isUser ? 'var(--accent)' : 'var(--surface)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    borderRadius: 10,
                    borderBottomRightRadius: isUser ? 4 : 10,
                    borderBottomLeftRadius: isUser ? 10 : 4,
                    padding: '10px 14px', fontSize: 14,
                    lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    color: isUser ? '#fff' : 'var(--text)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          {sending && !streamingText && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 5,
                background: 'var(--surface-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, flexShrink: 0,
              }}>
                {agent?.id === 'director' ? '🎯' : '🤖'}
              </div>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, borderBottomLeftRadius: 4,
                padding: '10px 16px', fontSize: 13, color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isReasoning ? (
                  <>Analyzing<span style={{ display:'inline-flex', gap:1 }}><span style={{ animation:'dotDot 1.5s infinite', animationDelay:'0s' }}>.</span><span style={{ animation:'dotDot 1.5s infinite', animationDelay:'0.3s' }}>.</span><span style={{ animation:'dotDot 1.5s infinite', animationDelay:'0.6s' }}>.</span></span></>
                ) : (
                  <><span className="pulse" /></>
                )}
              </div>
            </div>
          )}
          {streamingText && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 5,
                background: 'var(--surface-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, flexShrink: 0, marginTop: 2,
              }}>
                {agent?.id === 'director' ? '🎯' : '🤖'}
              </div>
              <div style={{ maxWidth: '88%' }}>
                {streamingReasoning && (
                  <ReasoningAccordion text={streamingReasoning} />
                )}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, borderBottomLeftRadius: 4,
                  padding: '10px 14px', fontSize: 14,
                  lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)',
                }}>
                  {streamingText}
                  <span style={{
                    display: 'inline-block', width: 6, height: 14,
                    background: 'var(--accent)', marginLeft: 2,
                    borderRadius: 1, verticalAlign: 'text-bottom',
                    animation: 'blink 0.8s step-end infinite',
                  }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--main-bg)' }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 680, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, transition: 'all 0.2s' }}
          onFocusCapture={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--accent)';
            el.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.08)';
          }}
          onBlurCapture={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--border)';
            el.style.boxShadow = 'none';
          }}
        >
          <textarea ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
            placeholder={agent ? `Message ${agent.name}…` : 'Select an agent…'}
            rows={1} disabled={!agent || sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--text)',
              fontSize: 14, padding: '8px 12px', resize: 'none', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120,
              opacity: agent && !sending ? 1 : 0.4,
            }}
          />
          <button onClick={handleSend} disabled={!input.trim() || sending || !agent}
            style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 500, alignSelf: 'flex-end',
              cursor: input.trim() && !sending && agent ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !sending && agent ? 1 : 0.4, transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (input.trim() && !sending && agent) {
                e.currentTarget.style.background = 'var(--accent-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {sending ? '···' : 'Send'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {agent ? 'Enter to send · Shift+Enter for new line' : 'Select an agent from the sidebar'}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .pulse {
          display: inline-flex; gap: 3px;
        }
        .pulse::before, .pulse::after {
          content: ''; width: 5px; height: 5px;
          border-radius: 50%; background: var(--text-tertiary);
          animation: dotPulse 1.4s infinite;
        }
        .pulse::before { animation-delay: 0.2s; }
        .pulse::after { animation-delay: 0.4s; }
        .pulse {
          animation: dotPulse 1.4s infinite;
          animation-delay: 0s;
        }
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
        @keyframes dotDot {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
