import React from 'react';

interface Props {
  model: string;
}

export function ProviderWarning({ model }: Props) {
  // For power users: In a real app, this would be wired to an API endpoint 
  // that checks if the env variables are present. For the test UI, we can
  // display the warnings conditionally or based on the selected model.
  
  let missingKeys: string[] = [];
  
  if (model.includes('gemini')) {
    missingKeys = ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
  } else if (model.includes('claude')) {
    missingKeys = ['ANTHROPIC_API_KEY'];
  } else if (model.includes('gpt')) {
    missingKeys = ['OPENAI_API_KEY'];
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
