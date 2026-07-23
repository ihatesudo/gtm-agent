import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onNewChat: () => void;
}

const EMOJI: Record<string, string> = {
  director: '🎯',
  'paid-search': '🔍',
  'social-ads': '📱',
  seo: '🌐',
  'b2b-linkedin': '💼',
  'lifecycle-retention': '🔄',
};

export default function Sidebar({ agents, selectedAgentId, onSelectAgent, onNewChat }: Props) {
  return (
    <div style={{
      width: 'var(--sidebar-width)', background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sidebar-text)', letterSpacing: '-0.01em' }}>GTM Agent</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--sidebar-text-dim)' }}>Marketing team on tap</span>
      </div>

      <div style={{ padding: '12px 12px 8px', fontSize: 11, fontWeight: 600, color: 'var(--sidebar-text-dim)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        Agents
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {agents.map(agent => (
          <div key={agent.id} onClick={() => onSelectAgent(agent.id)}
            style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 13, marginBottom: 2, transition: 'background 0.15s',
              background: agent.id === selectedAgentId ? 'var(--sidebar-hover)' : 'transparent',
              color: agent.id === selectedAgentId ? 'var(--sidebar-text)' : 'var(--sidebar-text-dim)',
            }}
            onMouseEnter={e => { if (agent.id !== selectedAgentId) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
            onMouseLeave={e => { if (agent.id !== selectedAgentId) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {EMOJI[agent.id] || '🧑‍💼'}
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
          border: '1px dashed var(--sidebar-border)', borderRadius: 'var(--radius-sm)',
          color: 'var(--sidebar-text-dim)', fontSize: 12, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sidebar-text)'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sidebar-border)'; e.currentTarget.style.color = 'var(--sidebar-text-dim)'; }}
      >
        + New conversation
      </button>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--sidebar-border)', fontSize: 11, color: 'var(--sidebar-text-dim)', display: 'flex', justifyContent: 'space-between' }}>
        <span>GTM Agent v0.2</span>
        <span>{agents.length} agents</span>
      </div>
    </div>
  );
}
