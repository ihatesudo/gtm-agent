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
      color: '#d97706', // amber-600
      fontSize: 12, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 6, 
      marginBottom: 10,
      marginTop: 2
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      </svg>
      <span>
        Set{' '}
        {missingKeys.map((key, i) => (
          <React.Fragment key={key}>
            <span style={{ 
              background: 'rgba(217, 119, 6, 0.1)', 
              color: '#b45309',
              padding: '2px 6px', 
              borderRadius: 4, 
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 11,
              fontWeight: 500
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
