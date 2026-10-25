import { useRef, useState, type DragEvent } from 'react';
import { prepareLogo, type Branding } from '../lib/branding';
import { ThemeColorsPanel } from './ThemeColorsPanel';

interface Props {
  branding: Branding;
  /** Returns false when the browser couldn't store the images. */
  onBrandingChange: (branding: Branding) => boolean;
  onNext: () => void;
}

type Notice = { kind: 'info' | 'error'; text: string } | null;

const NEOBOTICS_LOGO = {
  dark: './brand/neobotics-logo-transparent-white.webp',
  light: './brand/neobotics-logo-transparent.webp',
};

export function CustomizePage({ branding, onBrandingChange, onNext }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const isCustom = !!branding.logoDark;

  function apply(next: Branding, done: Notice) {
    setNotice(
      onBrandingChange(next)
        ? done
        : { kind: 'error', text: 'The browser has no room to keep this image after a reload. Try a smaller file.' },
    );
  }

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      apply({ ...branding, ...(await prepareLogo(file)) }, { kind: 'info', text: `Logo updated from ${file.name}.` });
    } catch {
      setNotice({ kind: 'error', text: `Couldn't read ${file.name}. Use a PNG, JPG or WebP image.` });
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void upload(e.dataTransfer.files[0]);
  }

  return (
    <main className="page setup">
      <section className="panel">
        <h2>Customize</h2>
        <p className="muted customize-intro">
          Add your event’s logo and colors. The logo replaces the Neobotics logo in the top bar, adjusted to suit each
          theme, and the colors run through the whole app. Skip this to use the Neobotics look.
        </p>
        {notice && <p className={`notice notice--${notice.kind}`}>{notice.text}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            Logo <span className="count">{isCustom ? 'Your upload' : 'Neobotics logo'}</span>
          </h2>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => input.current?.click()}>
              {isCustom ? 'Replace' : 'Upload'}
            </button>
            <button
              className="btn btn-quiet"
              disabled={!isCustom || busy}
              onClick={() =>
                apply(
                  { ...branding, logoDark: null, logoLight: null, version: undefined },
                  { kind: 'info', text: 'Back to the Neobotics logo.' },
                )
              }
            >
              Use Neobotics default
            </button>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="customize-body">
          <div className="logo-previews">
            {(['dark', 'light'] as const).map((tone) => {
              const custom = tone === 'dark' ? branding.logoDark : branding.logoLight;
              return (
                <div key={tone} className={`logo-preview logo-preview--${tone}`}>
                  <img
                    className={custom ? 'custom-logo' : 'neobotics-logo'}
                    src={custom ?? NEOBOTICS_LOGO[tone]}
                    alt={`Logo on the ${tone} theme`}
                  />
                  <span>{tone === 'dark' ? 'Dark theme' : 'Light theme'}</span>
                </div>
              );
            })}
          </div>
          <div
            className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => input.current?.click()}
            aria-live="polite"
          >
            {busy
              ? 'Preparing the logo…'
              : 'Drop a logo here or click to choose one. A solid background is removed, and dark or light lettering is flipped to suit each theme.'}
          </div>
        </div>
      </section>

      <ThemeColorsPanel colors={branding.colors ?? null} onChange={(colors) => onBrandingChange({ ...branding, colors })} />

      <footer className="generate-bar">
        <div className="status">
          <p className="muted">You can come back and change these at any time.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={onNext}>
            Next: Setup
          </button>
        </div>
      </footer>
    </main>
  );
}
