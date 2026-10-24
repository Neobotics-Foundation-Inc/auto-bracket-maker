import type { Theme } from '../lib/types';

interface Props {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="4.5" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
      <line key={deg} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${deg} 12 12)`} />
    ))}
  </svg>
);

const Moon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

/** Light/dark switch: sun on the left, crescent moon on the right, with a knob over the active one. */
export function ThemeSwitch({ theme, onChange }: Props) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`theme-switch ${dark ? 'theme-switch--dark' : ''}`}
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      <span className="theme-switch__knob" aria-hidden />
      <span className="theme-switch__icon theme-switch__icon--sun">
        <Sun />
      </span>
      <span className="theme-switch__icon theme-switch__icon--moon">
        <Moon />
      </span>
    </button>
  );
}
