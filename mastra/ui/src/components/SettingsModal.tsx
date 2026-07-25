import { useState, useEffect } from 'react';
import Icon from './Icon';

export type FontStyle = 'sans' | 'serif' | 'mono' | 'rounded';
export type AvatarStyle = 'emoji' | 'svg' | 'animals';

export interface UserCustomization {
  fontStyle: FontStyle;
  avatarStyle: AvatarStyle;
}

const SETTINGS_KEY = 'gtmagent_user_settings';

export function loadSettings(): UserCustomization {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { fontStyle: 'sans', avatarStyle: 'emoji' };
}

export function saveSettings(settings: UserCustomization) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function applyFontToDocument(fontStyle: FontStyle) {
  let fontValue = "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif";
  if (fontStyle === 'serif') {
    fontValue = "'Instrument Serif', Georgia, serif";
  } else if (fontStyle === 'mono') {
    fontValue = "'Fira Code', 'SF Mono', monospace";
  } else if (fontStyle === 'rounded') {
    fontValue = "'Quicksand', 'Nunito', system-ui, sans-serif";
  }
  document.documentElement.style.setProperty('--font-sans', fontValue);
}

export const ANIMAL_EMOJI: Record<string, string> = {
  director: '🦁',
  'paid-search': '🦉',
  'social-ads': '🦊',
  seo: '🐙',
  'b2b-linkedin': '🐼',
  'lifecycle-retention': '🐯',
};

export const CLASSIC_EMOJI: Record<string, string> = {
  director: '🎯',
  'paid-search': '🔍',
  'social-ads': '📱',
  seo: '🌐',
  'b2b-linkedin': '💼',
  'lifecycle-retention': '🔄',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserCustomization;
  onUpdateSettings: (newSettings: UserCustomization) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }: SettingsModalProps) {
  const [font, setFont] = useState<FontStyle>(settings.fontStyle);
  const [avatar, setAvatar] = useState<AvatarStyle>(settings.avatarStyle);

  useEffect(() => {
    setFont(settings.fontStyle);
    setAvatar(settings.avatarStyle);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: UserCustomization = { fontStyle: font, avatarStyle: avatar };
    saveSettings(updated);
    applyFontToDocument(font);
    onUpdateSettings(updated);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(41, 37, 36, 0.4)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: 420,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="settings" size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Customization Settings</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4
          }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Font Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Typography Font</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { id: 'sans', label: 'Sans-Serif', sample: 'Modern & Clean' },
              { id: 'serif', label: 'Serif', sample: 'Warm & Classic' },
              { id: 'mono', label: 'Monospace', sample: 'Code & Tech' },
              { id: 'rounded', label: 'Rounded', sample: 'Soft & Friendly' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFont(f.id as FontStyle)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: font === f.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: font === f.id ? 'var(--accent-light)' : 'var(--surface-hover)',
                  color: 'var(--text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: font === f.id ? 'var(--accent)' : 'var(--text)' }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{f.sample}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Emoji / Avatar Style Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Agent Avatar Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { id: 'emoji', label: 'Classic', preview: '🎯 🔍 📱' },
              { id: 'animals', label: 'Animals', preview: '🦁 🦊 🐙' },
              { id: 'svg', label: 'Minimal', preview: '⚙️ 🧠 🎯' },
            ].map(a => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id as AvatarStyle)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: avatar === a.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: avatar === a.id ? 'var(--accent-light)' : 'var(--surface-hover)',
                  color: 'var(--text)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: avatar === a.id ? 'var(--accent)' : 'var(--text)' }}>{a.label}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{a.preview}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)'
          }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{
            padding: '8px 20px', background: 'var(--accent)', color: '#ffffff', border: 'none',
            borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(217, 97, 78, 0.3)'
          }}>
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
}
