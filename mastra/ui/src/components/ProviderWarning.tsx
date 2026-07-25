import React, { useState, useEffect } from 'react';
import { fetchProviderStatus, type ProviderStatus } from '../lib/api';

interface Props {
  model: string;
}

export function ProviderWarning({ model }: Props) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    fetchProviderStatus().then(setStatus);
  }, []);

  let missingKeys: string[] = [];

  if (model.includes('claude')) {
    if (!status || !status.anthropic) {
      missingKeys = ['ANTHROPIC_API_KEY'];
    }
  } else if (model.includes('gpt')) {
    if (!status || !status.openai) {
      missingKeys = ['OPENAI_API_KEY'];
    }
  }

  if (missingKeys.length === 0) return null;

  return (
    <div style={{ 
      color: '#B45309',
      background: 'var(--accent-amber-bg)',
      border: '1px solid #FDE68A',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      fontSize: 12, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8, 
      marginBottom: 10,
      marginTop: 4,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--accent-amber)' }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span>
        Set{' '}
        {missingKeys.map((key, i) => (
          <React.Fragment key={key}>
            <span style={{ 
              background: '#FEF3C7', 
              color: '#92400E',
              padding: '2px 8px', 
              borderRadius: 'var(--radius-sm)', 
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600
            }}>
              {key}
            </span>
            {i < missingKeys.length - 1 ? ', ' : ' '}
          </React.Fragment>
        ))}
        to use this provider
      </span>
    </div>
  );
}

