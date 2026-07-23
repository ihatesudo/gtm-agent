import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onNewChat: () => void;
  isNewChat: boolean;
}

export default function Sidebar({ agents, selectedAgentId, onSelectAgent, onNewChat, isNewChat }: Props) {
  return (
    <div style={{
      width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>GTM Agent</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Marketing team on tap</span>
      </div>

      <div style={{ padding: '12px 12px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        Agents
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {agents.map(agent => (
          <div key={agent.id} onClick={() => onSelectAgent(agent.id)}
            style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 13, marginBottom: 2, transition: 'background 0.15s',
              background: agent.id === selectedAgentId ? 'var(--surface-hover)' : 'transparent',
              color: agent.id === selectedAgentId ? 'var(--text)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (agent.id !== selectedAgentId) e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={e => { if (agent.id !== selectedAgentId) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {agent.id === 'director' ? '🎯' : agent.id === 'paid-search' ? '🔍' : agent.id === 'social-ads' ? '📱' : agent.id === 'seo' ? '🌐' : agent.id === 'b2b-linkedin' ? '💼' : agent.id === 'lifecycle-retention' ? '🔄' : '🧑‍💼'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: agent.id === selectedAgentId ? 500 : 400 }}>
                {agent.name}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onNewChat}
        style={{
          margin: '8px 12px', padding: '8px', background: 'transparent',
          border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        + New conversation
      </button>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>GTM Agent v0.2</span>
        <span>{agents.length} agents</span>
      </div>
    </div>
  );
}
