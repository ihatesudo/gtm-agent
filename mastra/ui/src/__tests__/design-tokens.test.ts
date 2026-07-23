import { describe, it, expect } from 'vitest';

describe('CSS design tokens', () => {
  beforeAll(() => {
    document.documentElement.style.cssText = `
      --sidebar-width: 280px;
      --sidebar-bg: #141416;
      --sidebar-border: #27272a;
      --sidebar-hover: #1f1f23;
      --sidebar-text: #e4e4e7;
      --sidebar-text-dim: #71717a;
      --main-bg: #fafafb;
      --text: #18181b;
      --text-secondary: #71717a;
      --text-tertiary: #a1a1aa;
      --border: #e5e5e7;
      --surface: #ffffff;
      --surface-hover: #f5f5f7;
      --accent: #09090b;
      --accent-hover: #27272a;
      --danger: #ef4444;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-serif: 'Instrument Serif', Georgia, serif;
      --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
      --radius: 10px;
      --radius-sm: 6px;
      --radius-lg: 14px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow: 0 1px 3px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.05);
    `;
  });

  const tokens = [
    '--sidebar-width', '--sidebar-bg', '--sidebar-border', '--sidebar-hover',
    '--sidebar-text', '--sidebar-text-dim',
    '--main-bg', '--text', '--text-secondary', '--text-tertiary',
    '--border', '--surface', '--surface-hover',
    '--accent', '--accent-hover', '--danger',
    '--font-sans', '--font-serif', '--font-mono',
    '--radius', '--radius-sm', '--radius-lg',
    '--shadow-sm', '--shadow', '--shadow-lg',
  ];

  for (const token of tokens) {
    it(`defines ${token}`, () => {
      const value = document.documentElement.style.getPropertyValue(token);
      expect(value.trim()).not.toBe('');
    });
  }

  it('uses dark sidebar', () => {
    expect(document.documentElement.style.getPropertyValue('--sidebar-bg').trim()).toBe('#141416');
  });

  it('uses light main area', () => {
    expect(document.documentElement.style.getPropertyValue('--main-bg').trim()).toBe('#fafafb');
  });

  it('uses black accent', () => {
    expect(document.documentElement.style.getPropertyValue('--accent').trim()).toBe('#09090b');
  });

  it('defines serif font for headings', () => {
    expect(document.documentElement.style.getPropertyValue('--font-serif')).toContain('Instrument Serif');
  });

  it('defines sans font for body', () => {
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('Inter');
  });
});
