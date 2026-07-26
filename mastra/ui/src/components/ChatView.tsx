import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Agent, Message, ToolCall } from '../types';
import { ProviderWarning } from './ProviderWarning';
import { Dropdown } from './Dropdown';
import {
  MODEL_OPTIONS,
  THINKING_OPTIONS,
  SHORT_AGENT,
  agentDetail,
  shortAgentName as shortAgentNameFor,
} from './selectorMetadata';
import Icon from './Icon';

interface Props {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  agent?: Agent;
  messages: Message[];
  streamingText: string;
  streamingReasoning?: string;
  streamingToolCalls?: ToolCall[];
  sending: boolean;
  isReasoning: boolean;
  onSend: (content: string, options?: { model?: string, thinkingMode?: string }) => void;
  onRetry?: (messageId: string, options?: { model?: string, thinkingMode?: string }) => void;
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
  web_fetch: 'Open Page',
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

function ToolCallBadge({ call }: { call: ToolCall }) {
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
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 500,
      background: call.status === 'success' ? '#EEF2FF' : call.status === 'error' ? '#FEF2F2' : '#FEFCE8',
      border: '1px solid',
      borderColor: call.status === 'success' ? '#C7D2FE' : call.status === 'error' ? '#FECACA' : '#FDE68A',
      color: call.status === 'success' ? '#4338CA' : call.status === 'error' ? '#991B1B' : '#92400E',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 200,
    }}
      title={`${label}${inputSummary ? ` · ${inputSummary}` : ''}`}
    >
      <Icon name="tool" size={11} />
      <span>{label}</span>
      {call.status === 'success' && <span style={{ opacity: 0.6 }}>✓</span>}
      {call.status === 'error' && <span style={{ opacity: 0.6 }}>✗</span>}
      {call.status === 'pending' && <span className="pulse-dot" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#92400E' }} />}
    </span>
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
  // Parse bold, italic, strikethrough, inline code, and [links](url) — in priority order
  const TOKEN = /(\*\*.*?\*\*|__.*?__|~~.*?~~|\*(?!\*).*?\*(?!\*)|_(?!_).*?_(?!_)|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];

    if (raw.startsWith('**') || raw.startsWith('__')) {
      parts.push(<strong key={last} style={{ fontWeight: 700 }}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith('~~')) {
      parts.push(<s key={last} style={{ opacity: 0.7 }}>{raw.slice(2, -2)}</s>);
    } else if (raw.startsWith('*') || raw.startsWith('_')) {
      parts.push(<em key={last}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith('`')) {
      parts.push(
        <code key={last} style={{
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: '0.88em',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          wordBreak: 'break-all',
        }}>{raw.slice(1, -1)}</code>
      );
    } else if (raw.startsWith('[')) {
      // [label](url)
      parts.push(
        <a key={last} href={m[3]} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {m[2]}
        </a>
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// Represent a parsed "block" of content: fenced code, or an array of rendered lines
type ParsedBlock =
  | { type: 'code'; lang: string; code: string }
  | { type: 'lines'; lines: string[] };

function parseBlocks(content: string): ParsedBlock[] {
  const result: ParsedBlock[] = [];
  // Match fenced code blocks (```lang\n...```) including blocks with no trailing newline before ```
  const codeRe = /```([\w+-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(content)) !== null) {
    if (m.index > last) {
      result.push({ type: 'lines', lines: content.slice(last, m.index).split('\n') });
    }
    result.push({ type: 'code', lang: m[1].trim() || 'code', code: m[2].trimEnd() });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    result.push({ type: 'lines', lines: content.slice(last).split('\n') });
  }
  return result;
}

// Render a single text line, aware of line type
function RenderLine({ line, idx }: { line: string; idx: number }) {
  // Headings
  if (/^#{1} /.test(line)) return <h2 key={idx} style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 4px', color: 'var(--text)', lineHeight: 1.3 }}><FormattedInline text={line.replace(/^# /, '')} /></h2>;
  if (/^#{2} /.test(line)) return <h3 key={idx} style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 3px', color: 'var(--text)', lineHeight: 1.3 }}><FormattedInline text={line.replace(/^## /, '')} /></h3>;
  if (/^#{3} /.test(line)) return <h4 key={idx} style={{ fontSize: 14.5, fontWeight: 600, margin: '6px 0 2px', color: 'var(--text)' }}><FormattedInline text={line.replace(/^### /, '')} /></h4>;
  if (/^#{4,} /.test(line)) return <h5 key={idx} style={{ fontSize: 13.5, fontWeight: 600, margin: '4px 0 2px', color: 'var(--text-secondary)' }}><FormattedInline text={line.replace(/^#+\s/, '')} /></h5>;

  // Horizontal rule
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
    return <hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />;
  }

  // Blockquote
  if (line.startsWith('> ')) {
    return (
      <div key={idx} style={{
        borderLeft: '3px solid var(--accent)',
        paddingLeft: 12,
        margin: '2px 0',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
        fontSize: '0.97em',
      }}>
        <FormattedInline text={line.slice(2)} />
      </div>
    );
  }

  // Blank line → small spacer
  if (line.trim() === '') {
    return <div key={idx} style={{ height: 6 }} />;
  }

  // Plain paragraph
  return (
    <p key={idx} style={{ margin: 0 }}>
      <FormattedInline text={line} />
    </p>
  );
}

// Group consecutive bullet lines into a single <ul> and consecutive numbered
// lines into a single <ol> for proper list UX
type RawLine = string;
type LineGroup =
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: Array<{ n: number; text: string }> }
  | { kind: 'other'; line: string };

function groupLines(lines: RawLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Unordered bullet: - or *
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      groups.push({ kind: 'ul', items });
      continue;
    }
    // Ordered list: 1. 2. etc.
    const olMatch = /^(\d+)\. (.*)$/.exec(line);
    if (olMatch) {
      const items: Array<{ n: number; text: string }> = [];
      while (i < lines.length) {
        const m = /^(\d+)\. (.*)$/.exec(lines[i]);
        if (!m) break;
        items.push({ n: parseInt(m[1], 10), text: m[2] });
        i++;
      }
      groups.push({ kind: 'ol', items });
      continue;
    }
    groups.push({ kind: 'other', line });
    i++;
  }
  return groups;
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  }

  const blocks = parseBlocks(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {blocks.map((block, bi) => {
        if (block.type === 'code') {
          return (
            <div key={bi} style={{
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
                userSelect: 'none',
              }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10.5 }}>{block.lang}</span>
                <CopyButton text={block.code} label="Copy code" />
              </div>
              <pre style={{
                padding: 16,
                margin: 0,
                color: '#F5F5F4',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                overflowX: 'auto',
                whiteSpace: 'pre',
                tabSize: 2,
              }}>
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        // Text block — group lines into lists/headings/paragraphs
        const groups = groupLines(block.lines);
        return (
          <div key={bi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups.map((g, gi) => {
              if (g.kind === 'ul') {
                return (
                  <ul key={gi} style={{
                    margin: '4px 0',
                    paddingLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    listStyle: 'none',
                  }}>
                    {g.items.map((item, ii) => (
                      <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          color: 'var(--accent)',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 1,
                          fontSize: '1.1em',
                          lineHeight: 1,
                        }}>•</span>
                        <span style={{ flex: 1, lineHeight: 1.6 }}><FormattedInline text={item} /></span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (g.kind === 'ol') {
                return (
                  <ol key={gi} style={{
                    margin: '4px 0',
                    paddingLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    listStyle: 'none',
                  }}>
                    {g.items.map((item, ii) => (
                      <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          color: 'var(--accent)',
                          fontWeight: 700,
                          flexShrink: 0,
                          minWidth: 20,
                          textAlign: 'right',
                          lineHeight: 1.6,
                          fontSize: '0.92em',
                        }}>{item.n}.</span>
                        <span style={{ flex: 1, lineHeight: 1.6 }}><FormattedInline text={item.text} /></span>
                      </li>
                    ))}
                  </ol>
                );
              }
              return <RenderLine key={gi} line={g.line} idx={gi} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

// shortAgentName / agentDetail live in selectorMetadata.ts (shared with
// WelcomeView). This wraps the agent-object call site used in this file.
function shortAgentName(agent: Agent) {
  return shortAgentNameFor(agent.name, agent.id);
}

export default function ChatView({ agents, selectedAgentId, onSelectAgent, agent, messages, streamingText, streamingReasoning, streamingToolCalls = [], sending, isReasoning, onSend, onRetry }: Props) {

  const [input, setInput] = useState('');
  const [model, setModel] = useState('openrouter');
  const [thinkingMode, setThinkingMode] = useState('easy');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText, sending]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending || !agent) return;
    onSend(text, { model, thinkingMode });
    setInput('');
    // Reset the textarea to its natural single-line height after sending.
    // We set 'auto' (not a recomputed px) so the element returns to its min
    // height regardless of what the content was — mirrors WelcomeView, and
    // avoids leaving a stale tall inline height that previously combined with
    // `flex:1` to collapse the input.
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Auto-resize the textarea to fit its content, capped at 200px. Must NOT set
  // `flex:1` on the textarea — flex shorthand `1 1 0%` lets the flex container
  // shrink the element below its content height once an inline height is set,
  // which is what collapsed the chat textarea to ~31px. (Parity with
  // WelcomeView: default flex `0 1 auto`, height driven by scrollHeight.)
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResize(e.target);
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
            const displayContent = msg.partialContent || msg.content;
            const hasContent = Boolean(displayContent && displayContent.trim().length > 0);
            const hasReasoning = Boolean(msg.reasoning && msg.reasoning.trim().length > 0);
            const hasToolCalls = Boolean(msg.toolCalls && msg.toolCalls.length > 0);
            const hasError = Boolean(!isUser && msg.isError && msg.error);

            if (!isUser && !hasContent && !hasReasoning && !hasToolCalls && !hasError) {
              return null;
            }

            const isToolOnly = !isUser && !hasContent && hasToolCalls && !hasError;

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
                <div style={{ maxWidth: '85%', position: 'relative', minWidth: 0 }}>
                  {!isUser && hasReasoning && (
                    <ReasoningAccordion text={msg.reasoning!} />
                  )}
                  {isToolOnly ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 0' }}>
                      {msg.toolCalls!.map(tc => (
                        <ToolCallBadge key={tc.id} call={tc} />
                      ))}
                    </div>
                  ) : (
                    (hasContent || hasError) && (
                      <div style={{
                        background: isUser ? 'var(--accent-gradient)' : 'var(--surface)',
                        border: isUser ? 'none' : `1px solid ${hasError ? '#FECACA' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        borderTopRightRadius: isUser ? 4 : 'var(--radius)',
                        borderTopLeftRadius: isUser ? 'var(--radius)' : 4,
                        padding: '12px 18px',
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: isUser ? '#ffffff' : 'var(--text)',
                        boxShadow: isUser ? '0 3px 12px rgba(217, 97, 78, 0.2)' : 'var(--shadow-sm)',
                      }}>
                        {!isUser && hasToolCalls && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
                            {msg.toolCalls!.map(tc => (
                              <ToolCallBadge key={tc.id} call={tc} />
                            ))}
                          </div>
                        )}
                        {hasContent && <FormattedMessage content={displayContent} isUser={isUser} />}
                        {hasError && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: hasContent ? 12 : 0,
                            paddingTop: hasContent ? 10 : 0,
                            borderTop: hasContent ? '1px solid #FECACA' : 'none',
                            color: '#991B1B',
                            fontSize: 12.5,
                          }}>
                            <span style={{ flex: 1 }}>{msg.error}</span>
                            {onRetry && (
                              <button
                                type="button"
                                onClick={() => onRetry(msg.id, { model, thinkingMode })}
                                disabled={sending}
                                aria-label="Retry response"
                                title="Retry response"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  flexShrink: 0,
                                  border: '1px solid #FCA5A5',
                                  borderRadius: 'var(--radius-sm)',
                                  background: '#FFF7F7',
                                  color: '#B91C1C',
                                  padding: '5px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: sending ? 'not-allowed' : 'pointer',
                                  opacity: sending ? 0.5 : 1,
                                }}
                              >
                                <Icon name="refresh" size={13} />
                                Retry
                              </button>
                            )}
                          </div>
                        )}
                        {!isUser && !hasError && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                            <CopyButton text={displayContent} label="Copy response" />
                          </div>
                        )}
                      </div>
                    )
                  )}
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
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}>
                  <span className="pulse-circle" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  <span>Thinking…</span>
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
              <div style={{ maxWidth: '85%', minWidth: 0 }}>
                {streamingReasoning && (
                  <ReasoningAccordion text={streamingReasoning} />
                )}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  borderTopLeftRadius: 4,
                  padding: '12px 18px',
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: 'var(--text)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {streamingToolCalls.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: streamingText ? 10 : 0, paddingBottom: streamingText ? 8 : 0, borderBottom: streamingText ? '1px solid var(--border-light)' : 'none' }}>
                      {streamingToolCalls.map(tc => (
                        <ToolCallBadge key={tc.id} call={tc} />
                      ))}
                    </div>
                  )}
                  {streamingText ? (
                    <div style={{ position: 'relative' }}>
                      <FormattedMessage content={streamingText} isUser={false} />
                      <span style={{
                        display: 'inline-block',
                        width: 6,
                        height: 14,
                        background: 'var(--accent)',
                        marginLeft: 2,
                        borderRadius: 1,
                        verticalAlign: 'text-bottom',
                        animation: 'blink 0.8s step-end infinite',
                      }} />
                    </div>
                  ) : streamingToolCalls.length > 0 ? (
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Using tools…
                    </span>
                  ) : null}
                </div>
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
              width: '100%',
              minHeight: 48,
              maxHeight: 200,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 15,
              padding: '6px 8px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              opacity: agent && !sending ? 1 : 0.4,
            }}
          />
          <ProviderWarning model={model} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
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
                triggerWidth={108}
              />

              <Dropdown
                ariaLabel="Model"
                value={model}
                options={MODEL_OPTIONS}
                onChange={(v) => setModel(v)}
                disabled={!agent || sending}
              />

              <Dropdown
                ariaLabel="Thinking mode"
                value={thinkingMode}
                options={THINKING_OPTIONS}
                onChange={(v) => setThinkingMode(v)}
                disabled={!agent || sending}
                triggerWidth={96}
              />
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
        .pulse-dot {
          animation: pulse-op 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
