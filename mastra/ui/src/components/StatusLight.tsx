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

  let color = '#9ca3af'; // gray-400 — checking / unknown
  let label = '正在检查连接…';

  if (status) {
    const active = status.providers[status.active];
    if (!active?.configured) {
      color = '#9ca3af';
      label = `${status.active}: 未配置 API key`;
    } else if (active.reachable) {
      color = '#22c55e'; // green-500
      label = `${status.active}: 连接正常`;
    } else {
      color = '#ef4444'; // red-500
      label = `${status.active}: ${active.error || '连接失败'}`;
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
        boxShadow: `0 0 0 2px ${color}22`,
      }}
    />
  );
}
