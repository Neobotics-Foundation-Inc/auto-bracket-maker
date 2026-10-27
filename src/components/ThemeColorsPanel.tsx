import { useEffect, useState, type CSSProperties } from 'react';
import { inkOn, isHex, NEOBOTICS_COLORS, onLight, PALETTES, readabilityWarnings, type ThemeColors } from '../lib/colors';
import type { Theme } from '../lib/types';

interface Props {
  /** The theme on screen: the Text color field shows and edits that theme's text color. */
  theme: Theme;
  /** The event's colors, or null for the Neobotics ones. */
  colors: ThemeColors | null;
  onChange: (colors: ThemeColors | null) => void;
}

const fields = (theme: Theme): { key: keyof ThemeColors; label: string; detail: string }[] => [
  { key: 'main', label: 'Main color', detail: 'Buttons, the active tab, highlights, winners and seed badges.' },
  theme === 'dark'
    ? { key: 'textDark', label: 'Text color', detail: 'Headings and team names in the dark theme. Switch to the light theme to set its own.' }
    : { key: 'text', label: 'Text color', detail: 'Headings and team names in the light theme. Switch to the dark theme to set its own.' },
];

const same = (a: ThemeColors, b: ThemeColors) =>
  (['main', 'text', 'textDark'] as const).every((key) => a[key].toLowerCase() === b[key].toLowerCase());

/** One color: the browser's picker plus a hex box, which applies once it holds a full #rrggbb. */
function ColorField({ label, detail, value, onChange }: { label: string; detail: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="color-field">
      <input type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <div className="color-field__text">
        <span className="color-field__label">{label}</span>
        <span className="color-field__detail">{detail}</span>
      </div>
      <input
        className="color-field__hex"
        value={text}
        spellCheck={false}
        maxLength={7}
        aria-label={`${label} (hex)`}
        onChange={(e) => {
          const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(next);
          if (isHex(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
    </div>
  );
}

export function ThemeColorsPanel({ theme, colors, onChange }: Props) {
  const current = colors ?? NEOBOTICS_COLORS;
  const palette = PALETTES.find((p) => same(p.colors, current));
  const warnings = readabilityWarnings(current);
  // The preview sets its own color variables, so it shows the choice on both themes at once.
  const previewVars = {
    '--brand': current.main,
    '--brand-ink': inkOn(current.main),
    '--brand-light': onLight(current.main),
    '--brand-light-ink': inkOn(onLight(current.main)),
    '--brand-text': current.text,
    '--brand-text-dark': current.textDark,
  } as CSSProperties;

  const choose = (next: ThemeColors) => onChange(same(next, NEOBOTICS_COLORS) ? null : next);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          Theme colors <span className="count">{colors ? (palette?.name ?? 'Custom') : 'Neobotics colors'}</span>
        </h2>
        <div className="actions">
          <button className="btn btn-quiet" disabled={!colors} onClick={() => onChange(null)}>
            Use Neobotics default
          </button>
        </div>
      </div>

      <div className="palettes" role="radiogroup" aria-label="Color palettes">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            role="radio"
            aria-checked={palette === p}
            className={`palette ${palette === p ? 'palette--active' : ''}`}
            onClick={() => choose(p.colors)}
          >
            <span className="palette__swatch" style={{ background: p.colors.main }} />
            <span className="palette__swatch palette__swatch--text" style={{ background: theme === 'dark' ? p.colors.textDark : p.colors.text }} />
            <span className="palette__name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="customize-body">
        <div className="color-fields">
          {fields(theme).map((f) => (
            <ColorField
              key={f.key}
              label={f.label}
              detail={f.detail}
              value={current[f.key]}
              onChange={(hex) => choose({ ...current, [f.key]: hex })}
            />
          ))}
          {warnings.length > 0 && (
            <ul className="color-warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="theme-previews" style={previewVars}>
          {(['dark', 'light'] as const).map((tone) => (
            <div key={tone} className={`theme-preview theme-preview--${tone}`} aria-label={`${tone} theme preview`}>
              <div className="theme-preview__bar">
                <span className="theme-preview__tab theme-preview__tab--active">Bracket</span>
                <span className="theme-preview__tab">Podium</span>
                <span className="theme-preview__button">Present</span>
              </div>
              <span className="theme-preview__heading">Semifinal</span>
              <div className="theme-preview__team">
                <span className="theme-preview__seed">1</span>
                <span>Winning team</span>
              </div>
              <span className="theme-preview__label">{tone === 'dark' ? 'Dark theme' : 'Light theme'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
