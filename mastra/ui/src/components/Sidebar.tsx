import { useState } from 'react';
import type { Agent } from '../types';
import { StatusLight } from './StatusLight';
import Icon, { type IconName } from './Icon';

interface Thread {
  id: string;
  title: string;
  agentId: string;
}

interface Props {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onNewChat: () => void;
  threads?: Thread[];
  onDeleteThread?: (id: string) => void;
}

const NAV_ITEMS: { id: string; label: string; icon: IconName }[] = [
  { id: 'new-task', label: 'New Task', icon: 'edit' },
  { id: 'agent', label: 'Agent', icon: 'brain' },
  { id: 'library', label: 'Library', icon: 'library' },
];

const EMOJI: Record<string, string> = {
  director: '🎯',
  'paid-search': '🔍',
  'social-ads': '📱',
  seo: '🌐',
  'b2b-linkedin': '💼',
  'lifecycle-retention': '🔄',
};

export default function Sidebar({ agents, selectedAgentId, onSelectAgent, onNewChat, threads, onDeleteThread }: Props) {
  const [activeNav, setActiveNav] = useState('new-task');

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* App Branding */}
      <div style={{ padding: '20px 18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(217, 97, 78, 0.3)',
          }}>
            <Icon name="target" size={18} />
          </div>
          <div>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--sidebar-text)',
              letterSpacing: '-0.01em',
              display: 'block',
              lineHeight: 1.2,
            }}>GTM Agent</span>
            <span style={{ fontSize: 11, color: 'var(--sidebar-text-dim)', fontWeight: 500 }}>Marketing team on tap</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ padding: '0 10px', marginBottom: 12 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activeNav === item.id;
          return (
            <div key={item.id} onClick={() => setActiveNav(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                marginBottom: 3,
                transition: 'all 0.15s ease',
                background: isActive ? 'var(--sidebar-active)' : 'transparent',
                color: isActive ? 'var(--sidebar-accent)' : 'var(--sidebar-text)',
                fontWeight: isActive ? 600 : 500,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name={item.icon} size={16} style={{ color: isActive ? 'var(--sidebar-accent)' : 'var(--sidebar-text-dim)' }} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Conversations Section Header */}
      <div style={{
        padding: '8px 16px 6px',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--sidebar-text-dim)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Conversations
      </div>

      {/* Conversation Thread History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
        {threads && threads.length > 0 ? (
          threads.map(t => (
            <div key={t.id}
              className="thread-item"
              style={{
                padding: '8px 10px 8px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 12.5,
                marginBottom: 2,
                transition: 'all 0.15s ease',
                color: 'var(--sidebar-text)',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--sidebar-hover)';
                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                if (btn) btn.style.opacity = '0';
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</div>
              {onDeleteThread && (
                <button
                  className="delete-btn"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(t.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--sidebar-text-dim)',
                    cursor: 'pointer',
                    padding: 2,
                    opacity: 0,
                    transition: 'opacity 0.15s ease, color 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-text-dim)'; }}
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          ))
        ) : (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--sidebar-text-dim)',
            background: 'rgba(0, 0, 0, 0.015)',
            borderRadius: 'var(--radius-sm)',
            margin: '4px 0',
          }}>
            No conversations yet
          </div>
        )}
      </div>

      {/* Agents Section */}
      <div style={{ padding: '0 10px', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{
          padding: '12px 6px 6px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--sidebar-text-dim)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Agents
        </div>
        {agents.map(agent => {
          const isSelected = agent.id === selectedAgentId;
          return (
            <div key={agent.id} onClick={() => onSelectAgent(agent.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                marginBottom: 3,
                transition: 'all 0.15s ease',
                background: isSelected ? 'var(--surface)' : 'transparent',
                color: isSelected ? 'var(--sidebar-text)' : 'var(--sidebar-text-dim)',
                boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>
                  {EMOJI[agent.id] || '🧑‍💼'}
                </span>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 600 : 400,
                }}>
                  {agent.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Conversation Button */}
      <button onClick={onNewChat}
        style={{
          margin: '10px 12px',
          padding: '9px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent)',
          fontWeight: 600,
          fontSize: 12.5,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--accent-light)';
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--surface)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <Icon name="plus" size={14} />
        New conversation
      </button>

      {/* Footer / Status */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--sidebar-border)',
        fontSize: 11,
        color: 'var(--sidebar-text-dim)',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <StatusLight />
          GTM Agent v0.3
        </span>
        <span style={{ fontWeight: 500 }}>{agents.length} agents</span>
      </div>
    </div>
  );
}

