import { useState, useEffect } from 'react';
import Icon from './Icon';
import { fetchTelemetryData, type TelemetryData } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ObservabilityModal({ isOpen, onClose }: Props) {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'traces' | 'logs'>('traces');

  const refreshData = async () => {
    setLoading(true);
    const telemetry = await fetchTelemetryData();
    setData(telemetry);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        maxWidth: 720,
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
              <Icon name="chart" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sidebar-text)' }}>
                Mastra Observability
              </div>
              <div style={{ fontSize: 12, color: 'var(--sidebar-text-dim)' }}>
                Powered by @mastra/observability telemetry & storage
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={refreshData}
              disabled={loading}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--sidebar-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
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
        </div>

        {/* Overview Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--main-bg)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--sidebar-text-dim)', fontWeight: 600 }}>TELEMETRY STATUS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Active
            </div>
          </div>
          <div style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--main-bg)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--sidebar-text-dim)', fontWeight: 600 }}>RECORDED SPANS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sidebar-text)', marginTop: 4 }}>
              {data?.tracesCount ?? 0}
            </div>
          </div>
          <div style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--main-bg)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--sidebar-text-dim)', fontWeight: 600 }}>RECORDED LOGS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sidebar-text)', marginTop: 4 }}>
              {data?.logsCount ?? 0}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
          background: 'var(--main-bg)',
        }}>
          <button
            onClick={() => setActiveTab('traces')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'traces' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'traces' ? 'var(--accent)' : 'var(--sidebar-text-dim)',
              fontWeight: activeTab === 'traces' ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Traces & Spans ({data?.recentTraces?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'logs' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'logs' ? 'var(--accent)' : 'var(--sidebar-text-dim)',
              fontWeight: activeTab === 'logs' ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Structured Logs ({data?.recentLogs?.length ?? 0})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'traces' ? (
            <div>
              {!data?.recentTraces || data.recentTraces.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--sidebar-text-dim)', fontSize: 13 }}>
                  No execution traces captured yet. Run an agent task to record telemetry.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.recentTraces.map((trace, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--main-bg)',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--sidebar-text)' }}>
                          {trace.name || 'Span execution'}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          {trace.spanType || 'span'}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--sidebar-text-dim)', display: 'flex', gap: 16 }}>
                        <span>Trace: {trace.traceId ? trace.traceId.slice(0, 12) + '...' : 'local'}</span>
                        <span>Started: {trace.startedAt ? new Date(trace.startedAt).toLocaleTimeString() : 'now'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {!data?.recentLogs || data.recentLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--sidebar-text-dim)', fontSize: 13 }}>
                  No structured logs recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 12 }}>
                  {data.recentLogs.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'var(--main-bg)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        gap: 10,
                      }}
                    >
                      <span style={{
                        color: log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#f59e0b' : '#10b981',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        minWidth: 45,
                      }}>
                        {log.level || 'INFO'}
                      </span>
                      <span style={{ color: 'var(--sidebar-text)', flex: 1, wordBreak: 'break-word' }}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
