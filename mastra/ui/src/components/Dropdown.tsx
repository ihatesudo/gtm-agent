import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import Icon from './Icon';

/**
 * Rich detail shown when an option is hovered or active. `tag` (e.g. "free",
 * "paid") is rendered as a colored chip; `description` as the body text.
 */
export interface OptionDetail {
  tag?: string;
  description?: string;
}

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional icon name from the Icon component (e.g. 'target', 'bot'). */
  icon?: string;
  /** Rich detail shown on hover/active. Omit for plain options. */
  detail?: OptionDetail;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Accessible label for the trigger button (e.g. "Model"). */
  ariaLabel: string;
  disabled?: boolean;
  /** Optional fixed pixel width for the trigger button. */
  triggerWidth?: number;
  /** Optional max pixel width for the dropdown list. */
  listMaxWidth?: number;
}

const TRIGGER_STYLE: React.CSSProperties = {
  background: 'var(--surface-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
  padding: '5px 8px 5px 10px',
  borderRadius: 'var(--radius-sm)',
  // No `outline: none` — keep the native focus ring so keyboard users can see
  // which selector has focus (Tab navigation contract).
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  free: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  paid: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  default: { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
};

/**
 * Dropdown — a custom popover select with rich hover details and full keyboard
 * support. Replaces the native <select> where per-option detail cards matter
 * (model/agent selectors). Mirrors the UX of mainstream chat apps (Doubao,
 * Kimi): hovering an option reveals a side detail card with context length,
 * capabilities, etc.
 *
 * Keyboard:
 *  - Enter / Space / ArrowDown on trigger → open
 *  - ArrowUp/ArrowDown → move the active (highlighted) option
 *  - Enter → select the active option and close
 *  - Escape → close without changing
 *  - Tab → close and move focus naturally (a11y: no manual tabIndex juggling)
 */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  triggerWidth,
  listMaxWidth,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number>(activeIndex);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Track the active index in a ref so keyboard handlers read the freshest
  // value even when multiple keys fire before React re-renders. (Without this,
  // ArrowDown then Enter can read a stale activeIndex and select the wrong
  // option, or — when the second key is batched — no-op.)
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // When the popover opens, move focus onto the listbox so it receives
  // ArrowUp/ArrowDown/Enter/Escape. Without this, focus stays on the trigger
  // button and keyboard navigation silently no-ops. We focus on a microtask
  // rather than rAF so it's testable in jsdom, which doesn't flush animation
  // frames between synthetic keystrokes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) listRef.current?.focus();
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];
  // The option whose detail is currently shown: hovered wins, else active.
  const shownIndex = hoveredIndex >= 0 ? hoveredIndex : activeIndex;
  const shown = options[shownIndex];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Keep the active option scrolled into view while navigating by keyboard.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (idx: number) => {
    const opt = options[idx];
    if (opt) onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
      setHoveredIndex(-1);
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
      setOpen(true);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.min(options.length - 1, i + 1);
        activeIndexRef.current = next;
        return next;
      });
      setHoveredIndex(-1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.max(0, i - 1);
        activeIndexRef.current = next;
        return next;
      });
      setHoveredIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(activeIndexRef.current);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const triggerStyle: React.CSSProperties = {
    ...TRIGGER_STYLE,
    width: triggerWidth,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderColor: open ? 'var(--accent)' : 'var(--border)',
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onKeyDown={(e) => {
        // Catch Escape at the wrapper level so it closes regardless of which
        // child (trigger vs listbox vs an option) currently has focus.
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
          setHoveredIndex(-1);
          setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        style={triggerStyle}
      >
        {selected?.icon && <Icon name={selected.icon} size={13} />}
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected?.label}</span>
        <Icon name="chevron-right" size={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(90deg)', transition: 'transform 0.15s ease', opacity: 0.6 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            zIndex: 50,
            display: 'flex',
            gap: 0,
            boxShadow: 'var(--shadow-md)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            onKeyDown={onListKeyDown}
            style={{
              margin: 0,
              padding: 4,
              listStyle: 'none',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              minWidth: 150,
              maxWidth: listMaxWidth ?? 240,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {options.map((opt, idx) => {
              const isActive = idx === activeIndex && hoveredIndex < 0;
              const isHovered = idx === hoveredIndex;
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseMove={() => setHoveredIndex(idx)}
                  onClick={() => choose(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: isSelected ? 600 : 500,
                    color: 'var(--text)',
                    background: isHovered
                      ? 'var(--accent-light)'
                      : isActive
                        ? 'var(--surface-hover)'
                        : 'transparent',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {opt.icon && <Icon name={opt.icon} size={13} style={{ opacity: 0.7 }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                  {opt.detail?.tag && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        ...(TAG_COLORS[opt.detail.tag] || TAG_COLORS.default),
                      }}
                    >
                      {opt.detail.tag}
                    </span>
                  )}
                  {isSelected && <Icon name="check" size={12} style={{ color: 'var(--accent)' }} />}
                </li>
              );
            })}
          </ul>

          {/* Detail card — mirrors mainstream chat apps: hover an item, see its
              capabilities without committing. Hidden when no detail present. */}
          {shown?.detail?.description && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: 'none',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                maxWidth: 240,
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: 12 }}>
                {shown.label}
              </div>
              <div>{shown.detail.description}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
