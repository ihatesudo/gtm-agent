import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Agent, Message } from '../types';

interface Props {
  agent?: Agent;
  messages: Message[];
  streamingText: string;
  sending: boolean;
  isReasoning: boolean;
  onSend: (content: string) => void;
  isEmpty: boolean;
}

export default function ChatView({ agent, messages, streamingText, sending, isReasoning, onSend, isEmpty }: Props) {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--accent-subtle)',
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
        {isEmpty ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 12,
          }}>
            <div style={{ fontSize: 40, opacity: 0.6 }}>🎯</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {agent ? `Chat with ${agent.name}` : 'Select an agent'}
            </div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 360, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
              Describe your marketing goal — product, audience, budget, timeline.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, margin: '0 auto' }}>
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: isUser ? 'var(--accent-subtle)' : 'var(--surface-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0, marginTop: 2,
                  }}>
                    {isUser ? '👤' : agent?.id === 'director' ? '🎯' : '🤖'}
                  </div>
                  <div style={{
                    background: isUser ? 'var(--user-msg)' : 'var(--agent-msg)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    borderRadius: 10,
                    borderBottomRightRadius: isUser ? 4 : 10,
                    borderBottomLeftRadius: isUser ? 10 : 4,
                    padding: '10px 14px', maxWidth: '88%', fontSize: 14,
                    lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)',
                  }}>
                    {msg.content}
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
                  background: 'var(--agent-msg)', border: '1px solid var(--border)',
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
                <div style={{
                  background: 'var(--agent-msg)', border: '1px solid var(--border)',
                  borderRadius: 10, borderBottomLeftRadius: 4,
                  padding: '10px 14px', maxWidth: '88%', fontSize: 14,
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
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 680, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, transition: 'all 0.2s' }}
          onFocusCapture={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--accent)';
            el.style.boxShadow = '0 0 0 3px rgba(91,141,239,0.15)';
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
