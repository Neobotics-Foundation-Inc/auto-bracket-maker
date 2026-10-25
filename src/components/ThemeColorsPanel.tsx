import { useEffect, useState, type CSSProperties } from 'react';
import { inkOn, isHex, NEOBOTICS_COLORS, onLight, PALETTES, readabilityWarnings, type ThemeColors } from '../lib/colors';

interface Props {
  /** The event's colours, or null for the Neobotics ones. */
  colors: ThemeColors | null;
  onChange: (colors: ThemeColors | null) => void;
}

const FIELDS: { key: keyof ThemeColors; label: string; detail: string }[] = [
  { key: 'main', label: 'Main colour', detail: 'Buttons, the active tab, highlights, winners and seed badges.' },
  { key: 'text', label: 'Text colour', detail: 'Headings and team names in the light theme.' },
];

const same = (a: ThemeColors, b: ThemeColors) => a.main.toLowerCase() === b.main.toLowerCase() && a.text.toLowerCase() === b.text.toLowerCase();

/** One colour: the browser's picker plus a hex box, which applies once it holds a full #rrggbb. */
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

export function ThemeColorsPanel({ colors, onChange }: Props) {
  const current = colors ?? NEOBOTICS_COLORS;
  const palette = PALETTES.find((p) => same(p.colors, current));
  const warnings = readabilityWarnings(current);
  // The preview sets its own colour variables, so it shows the choice on both themes at once.
  const previewVars = {
    '--brand': current.main,
    '--brand-ink': inkOn(current.main),
    '--brand-light': onLight(current.main),
    '--brand-light-ink': inkOn(onLight(current.main)),
    '--brand-text': current.text,
  } as CSSProperties;

  const choose = (next: ThemeColors) => onChange(same(next, NEOBOTICS_COLORS) ? null : next);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          Theme colours <span className="count">{colors ? (palette?.name ?? 'Custom') : 'Neobotics colours'}</span>
        </h2>
        <div className="actions">
          <button className="btn btn-quiet" disabled={!colors} onClick={() => onChange(null)}>
            Use Neobotics default
          </button>
        </div>
      </div>

      <div className="palettes" role="radiogroup" aria-label="Colour palettes">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            role="radio"
            aria-checked={palette === p}
            className={`palette ${palette === p ? 'palette--active' : ''}`}
            onClick={() => choose(p.colors)}
          >
            <span className="palette__swatch" style={{ background: p.colors.main }} />
            <span className="palette__swatch palette__swatch--text" style={{ background: p.colors.text }} />
            <span className="palette__name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="customize-body">
        <div className="color-fields">
          {FIELDS.map((f) => (
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
