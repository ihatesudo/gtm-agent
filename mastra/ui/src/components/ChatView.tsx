import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Agent, Message, ToolCall } from '../types';
import { ProviderWarning } from './ProviderWarning';
import Icon from './Icon';

interface Props {
  agent?: Agent;
  messages: Message[];
  streamingText: string;
  streamingReasoning?: string;
  streamingToolCalls?: ToolCall[];
  sending: boolean;
  isReasoning: boolean;
  onSend: (content: string, options?: { model?: string, thinkingMode?: string }) => void;
}

function ReasoningAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split('\n').filter(Boolean);
  const summary = lines.length <= 1 ? text.slice(0, 80) : lines[0].slice(0, 80);

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      border: '1px solid #FDE68A',
      background: 'var(--accent-amber-bg)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 12.5,
          color: '#92400E',
          fontWeight: 600,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s ease',
          fontSize: 10,
          display: 'inline-block',
        }}>▶</span>
        <Icon name="brain" size={14} style={{ color: '#B45309' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {open ? 'Thought process' : `Thought process · ${summary}${text.length > 80 ? '…' : ''}`}
        </span>
      </button>
      {open && (
        <div style={{
          padding: '10px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#78350F',
          whiteSpace: 'pre-wrap',
          borderTop: '1px solid #FDE68A',
          background: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'var(--font-mono)',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Search',
  save_asset: 'Save Asset',
  read_asset: 'Read Asset',
  list_assets: 'List Assets',
  list_skills: 'List Skills',
  read_skill_reference: 'Read Skill',
  get_project_context: 'Project Context',
  update_project_context: 'Update Project',
  record_project_campaign: 'Record Campaign',
  record_project_decision: 'Record Decision',
};

function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[call.tool] || call.tool;

  let inputSummary = '';
  try {
    const parsed = JSON.parse(call.input);
    const values = Object.values(parsed).filter(v => typeof v === 'string');
    inputSummary = values.slice(0, 2).join(' · ');
  } catch {
    inputSummary = call.input.slice(0, 80);
  }

  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      border: '1px solid #C4B5FD',
      background: '#F5F3FF',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 12.5,
          color: '#5B21B6',
          fontWeight: 600,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s ease',
          fontSize: 10,
          display: 'inline-block',
        }}>▶</span>
        <Icon name="tool" size={14} style={{ color: '#7C3AED' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {open ? label : `${label} · ${inputSummary || 'running…'}${inputSummary.length > 50 ? '…' : ''}`}
        </span>
        <span style={{
          fontSize: 10,
          padding: '1px 6px',
          borderRadius: 8,
          background: call.status === 'success' ? '#D1FAE5' : call.status === 'error' ? '#FEE2E2' : '#FEF3C7',
          color: call.status === 'success' ? '#065F46' : call.status === 'error' ? '#991B1B' : '#92400E',
        }}>
          {call.status === 'success' ? 'done' : call.status === 'error' ? 'error' : '…'}
        </span>
      </button>
      {open && (
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          lineHeight: 1.5,
          color: '#4C1D95',
          borderTop: '1px solid #C4B5FD',
          background: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'var(--font-mono)',
        }}>
          {call.output ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: '#6D28D9' }}>Output</div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto' }}>
                {call.output}
              </div>
            </div>
          ) : (
            <div style={{ fontStyle: 'italic', color: '#7C3AED' }}>Waiting for result…</div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy text"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'var(--surface-hover)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
        fontSize: 11.5,
        fontWeight: 500,
        color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      <span>{copied ? 'Copied!' : label}</span>
    </button>
  );
}

function FormattedInline({ text }: { text: string }) {
  // Parse bold **text** and inline `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} style={{ fontWeight: 600, color: 'var(--text)' }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={idx} style={{
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: '0.9em',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
            }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <div>{content}</div>;
  }

  // Split content by code blocks ```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', lang: match[1] || 'code', code: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <div key={i} style={{
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: '#1C1917',
              border: '1px solid #292524',
              boxShadow: 'var(--shadow-sm)',
              margin: '6px 0',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: '#292524',
                color: '#A8A29E',
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
              }}>
                <span>{block.lang}</span>
                <CopyButton text={block.code || ''} label="Copy code" />
              </div>
              <pre style={{
                padding: 14,
                margin: 0,
                color: '#F5F5F4',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.55,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        // Render text section line by line
        const lines = (block.content || '').split('\n');
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((line, lIdx) => {
              if (line.startsWith('# ')) {
                return <h3 key={lIdx} style={{ fontSize: 17, fontWeight: 700, marginTop: 8, marginBottom: 4, color: 'var(--text)' }}>{line.slice(2)}</h3>;
              }
              if (line.startsWith('## ')) {
                return <h4 key={lIdx} style={{ fontSize: 15, fontWeight: 700, marginTop: 6, marginBottom: 3, color: 'var(--text)' }}>{line.slice(3)}</h4>;
              }
              if (line.startsWith('### ')) {
                return <h5 key={lIdx} style={{ fontSize: 14, fontWeight: 600, marginTop: 4, marginBottom: 2, color: 'var(--text)' }}>{line.slice(4)}</h5>;
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={lIdx} style={{ display: 'flex', gap: 8, paddingLeft: 8 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                    <span><FormattedInline text={line.slice(2)} /></span>
                  </div>
                );
              }
              return (
                <p key={lIdx} style={{ margin: 0, minHeight: line === '' ? 8 : undefined }}>
                  <FormattedInline text={line} />
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatView({ agent, messages, streamingText, streamingReasoning, streamingToolCalls = [], sending, isReasoning, onSend }: Props) {

  const [input, setInput] = useState('');
  const [model, setModel] = useState('openrouter');
  const [thinkingMode, setThinkingMode] = useState('medium');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText, sending]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending || !agent) return;
    onSend(text, { model, thinkingMode });
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      height: '100%',
      background: 'var(--main-bg)',
    }}>
      {/* Agent Header Bar */}
      <div style={{
        padding: '14px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-light)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          <Icon name={agent?.id === 'director' ? 'target' : 'bot'} size={18} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{agent?.name || 'Select an agent'}</div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            maxWidth: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {agent?.description || 'Your dedicated marketing specialist'}
          </div>
        </div>
      </div>

      {/* Message List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 720, margin: '0 auto' }}>
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--radius-sm)',
                  background: isUser ? 'var(--accent-gradient)' : 'var(--surface)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                  color: isUser ? '#ffffff' : 'var(--text)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <Icon name={isUser ? 'user' : (agent?.id === 'director' ? 'target' : 'bot')} size={16} />
                </div>
                <div style={{ maxWidth: '85%', position: 'relative' }}>
                  {!isUser && msg.reasoning && (
                    <ReasoningAccordion text={msg.reasoning} />
                  )}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {msg.toolCalls.map(tc => (
                        <ToolCallCard key={tc.id} call={tc} />
                      ))}
                    </div>
                  )}
                  <div style={{
                    background: isUser ? 'var(--accent-gradient)' : 'var(--surface)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    borderTopRightRadius: isUser ? 4 : 'var(--radius)',
                    borderTopLeftRadius: isUser ? 'var(--radius)' : 4,
                    padding: '12px 18px',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    color: isUser ? '#ffffff' : 'var(--text)',
                    boxShadow: isUser ? '0 3px 12px rgba(217, 97, 78, 0.2)' : 'var(--shadow-sm)',
                  }}>
                    <FormattedMessage content={msg.content} isUser={isUser} />
                    {!isUser && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                        <CopyButton text={msg.content} label="Copy response" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking State */}
          {sending && !streamingText && !streamingReasoning && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
                marginTop: 2,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <Icon name={agent?.id === 'director' ? 'target' : 'bot'} size={16} />
              </div>
              <div style={{ maxWidth: '85%' }}>
                <div style={{
                  borderRadius: 'var(--radius)',
                  border: '1px solid #FDE68A',
                  background: 'var(--accent-amber-bg)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#92400E',
                  fontWeight: 500,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <span className="pulse-circle" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  <span>Thinking process started...</span>
                </div>
              </div>
            </div>
          )}

          {/* Streaming Text, Reasoning & Tool Calls */}
          {(streamingText || streamingReasoning || streamingToolCalls.length > 0) && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
                marginTop: 2,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <Icon name={agent?.id === 'director' ? 'target' : 'bot'} size={16} />
              </div>
              <div style={{ maxWidth: '85%' }}>
                {streamingReasoning && (
                  <ReasoningAccordion text={streamingReasoning} />
                )}
                {streamingToolCalls.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {streamingToolCalls.map(tc => (
                      <ToolCallCard key={tc.id} call={tc} />
                    ))}
                  </div>
                )}
                {streamingText && (
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    borderTopLeftRadius: 4,
                    padding: '12px 18px',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text)',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                    {streamingText}
                    <span style={{
                      display: 'inline-block',
                      width: 6,
                      height: 15,
                      background: 'var(--accent)',
                      marginLeft: 3,
                      borderRadius: 1,
                      verticalAlign: 'text-bottom',
                      animation: 'blink 0.8s step-end infinite',
                    }} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px 28px 22px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--main-bg)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 14,
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-md)',
        }}
          onFocusCapture={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--accent)';
            el.style.boxShadow = 'var(--shadow-focus)';
          }}
          onBlurCapture={e => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = 'var(--border)';
            el.style.boxShadow = 'var(--shadow-md)';
          }}
        >
          <textarea ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
            placeholder={agent ? `Message ${agent.name}…` : 'Select an agent…'}
            rows={1} disabled={!agent || sending}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 15,
              padding: '4px 6px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              maxHeight: 150,
              opacity: agent && !sending ? 1 : 0.4,
            }}
          />
          <ProviderWarning model={model} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                disabled={!agent || sending}
                style={{
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
                }}
              >
                <option value="gemini-flash">Gemini 2.5 Flash (Vertex)</option>
                <option value="gemini-pro">Gemini 2.5 Pro (Vertex)</option>
                <option value="openrouter">OpenRouter (Auto)</option>
                <option value="glm">GLM-5.2 (智谱 Coding Plan)</option>
              </select>

              <select 
                value={thinkingMode} 
                onChange={(e) => setThinkingMode(e.target.value)}
                disabled={!agent || sending}
                style={{
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
                }}
              >
                <option value="none">No Thinking</option>
                <option value="easy">Thinking: Easy</option>
                <option value="medium">Thinking: Medium</option>
                <option value="hard">Thinking: Hard</option>
              </select>
            </div>
            
            <button onClick={handleSend} disabled={!input.trim() || sending || !agent}
              style={{
                padding: '8px 18px',
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                cursor: input.trim() && !sending && agent ? 'pointer' : 'not-allowed',
                opacity: input.trim() && !sending && agent ? 1 : 0.45,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: input.trim() && !sending && agent ? '0 2px 8px rgba(217, 97, 78, 0.3)' : 'none',
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
              {sending ? '···' : (
                <>
                  Send
                  <Icon name="arrow-up" size={14} />
                </>
              )}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          {agent ? 'Enter to send · Shift+Enter for new line' : 'Select an agent from the sidebar'}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse-op {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .pulse-circle {
          animation: pulse-op 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

