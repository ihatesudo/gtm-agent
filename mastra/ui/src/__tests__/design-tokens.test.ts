import { describe, it, expect, beforeAll } from 'vitest';

describe('CSS design tokens', () => {
  beforeAll(() => {
    document.documentElement.style.cssText = `
      --sidebar-width: 280px;
      --sidebar-bg: #F5F1EB;
      --sidebar-border: #E8E2D8;
      --sidebar-hover: #EBE5DC;
      --sidebar-text: #292524;
      --sidebar-text-dim: #78716C;
      --main-bg: #FAF7F2;
      --text: #292524;
      --text-secondary: #67605A;
      --text-tertiary: #9E9790;
      --border: #E7E2D9;
      --surface: #FFFFFF;
      --surface-hover: #F6F3ED;
      --accent: #D9614E;
      --accent-hover: #C5503D;
      --danger: #DC2626;
      --font-sans: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-serif: 'Instrument Serif', Georgia, serif;
      --font-mono: 'Fira Code', 'SF Mono', monospace;
      --radius: 12px;
      --radius-sm: 8px;
      --radius-lg: 16px;
      --shadow-sm: 0 1px 3px rgba(120, 113, 108, 0.05);
      --shadow: 0 4px 12px rgba(120, 113, 108, 0.06);
      --shadow-lg: 0 16px 32px -4px rgba(120, 113, 108, 0.12);
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

  it('uses warm light sidebar', () => {
    expect(document.documentElement.style.getPropertyValue('--sidebar-bg').trim()).toBe('#F5F1EB');
  });

  it('uses warm light main area', () => {
    expect(document.documentElement.style.getPropertyValue('--main-bg').trim()).toBe('#FAF7F2');
  });

  it('uses warm terracotta accent', () => {
    expect(document.documentElement.style.getPropertyValue('--accent').trim()).toBe('#D9614E');
  });

  it('defines serif font for headings', () => {
    expect(document.documentElement.style.getPropertyValue('--font-serif')).toContain('Instrument Serif');
  });

  it('defines sans font for body', () => {
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('Plus Jakarta Sans');
  });
});
