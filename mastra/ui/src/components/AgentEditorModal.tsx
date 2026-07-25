import { useState, useEffect } from 'react';
import type { Agent } from '../types';
import Icon from './Icon';
import { fetchAgentOverrides, saveAgentOverride, type StoredAgentOverride } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  selectedAgentId: string;
}

export function AgentEditorModal({ isOpen, onClose, agents, selectedAgentId }: Props) {
  const [activeAgentId, setActiveAgentId] = useState(selectedAgentId || (agents[0]?.id ?? 'director'));
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [overrides, setOverrides] = useState<StoredAgentOverride[]>([]);

  useEffect(() => {
    if (selectedAgentId) setActiveAgentId(selectedAgentId);
  }, [selectedAgentId]);

  const loadOverrides = async () => {
    const list = await fetchAgentOverrides();
    setOverrides(list);
    const currentOverride = list.find(o => o.id === activeAgentId);
    if (currentOverride && currentOverride.instructions) {
      setInstructions(currentOverride.instructions);
    } else {
      const activeAgent = agents.find(a => a.id === activeAgentId);
      setInstructions(activeAgent?.description ? `You are ${activeAgent.name}. ${activeAgent.description}` : '');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOverrides();
    }
  }, [isOpen, activeAgentId]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    const success = await saveAgentOverride(activeAgentId, instructions);
    setSaving(false);
    if (success) {
      setStatusMsg({ type: 'success', text: 'Stored agent instructions updated via @mastra/editor!' });
      loadOverrides();
    } else {
      setStatusMsg({ type: 'error', text: 'Failed to update agent override.' });
    }
  };

  if (!isOpen) return null;

  const currentAgent = agents.find(a => a.id === activeAgentId);
  const activeOverride = overrides.find(o => o.id === activeAgentId);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        width: '100%',
        maxWidth: 680,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--main-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent-light, #eff6ff)',
              color: 'var(--accent, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon name="edit" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sidebar-text)' }}>
                Mastra Agent Editor
              </div>
              <div style={{ fontSize: 12, color: 'var(--sidebar-text-dim)' }}>
                Tune prompts & instructions dynamically with @mastra/editor
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--sidebar-text-dim)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Agent Selector Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}>
          {agents.map(agent => {
            const isSelected = agent.id === activeAgentId;
            const hasOverride = overrides.some(o => o.id === agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgentId(agent.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent-light, #eff6ff)' : 'var(--main-bg)',
                  color: isSelected ? 'var(--accent)' : 'var(--sidebar-text)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {agent.name}
                {hasOverride && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Instructions Form */}
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sidebar-text)' }}>
              System Prompt & Instructions for {currentAgent?.name || activeAgentId}
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: activeOverride ? '#dcfce7' : 'var(--main-bg)', color: activeOverride ? '#15803d' : 'var(--sidebar-text-dim)', border: '1px solid var(--border)' }}>
              {activeOverride ? 'Stored DB Override' : 'Code Baseline'}
            </span>
          </div>

          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Enter custom prompt instructions for this agent..."
            style={{
              width: '100%',
              minHeight: 220,
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--main-bg)',
              color: 'var(--sidebar-text)',
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          {statusMsg && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: statusMsg.type === 'success' ? '#15803d' : '#b91c1c',
            }}>
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--main-bg)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--sidebar-text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent, #2563eb)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save & Publish Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
