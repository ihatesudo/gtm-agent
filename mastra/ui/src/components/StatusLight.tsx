import { useState, useEffect } from 'react';
import { fetchConnectivityStatus, type ConnectivityStatus } from '../lib/api';

/**
 * Small bottom-left status dot reflecting the ACTIVE provider's reachability.
 * Green = connected, red = configured but failing, gray = not configured / unknown.
 */
export function StatusLight() {
  const [status, setStatus] = useState<ConnectivityStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetchConnectivityStatus().then((s) => { if (alive) setStatus(s); });
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  let color = 'var(--text-tertiary)';
  let label = 'Checking connection…';

  if (status) {
    const active = status.providers[status.active];
    if (!active?.configured) {
      color = 'var(--text-tertiary)';
      label = `${status.active}: API key not set`;
    } else if (active.reachable) {
      color = 'var(--accent-green)';
      label = `${status.active}: Connected`;
    } else {
      color = 'var(--danger)';
      label = `${status.active}: ${active.error || 'Connection failed'}`;
    }
  }

  return (
    <span
      title={label}
      aria-label={label}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
        cursor: 'help',
        boxShadow: `0 0 0 3px ${color === 'var(--accent-green)' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(168, 162, 158, 0.2)'}`,
      }}
    />
  );
}

