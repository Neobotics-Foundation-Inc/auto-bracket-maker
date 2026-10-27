import { useRef, useState } from 'react';
import { BACKUP_LABELS, type Backup } from '../lib/backups';
import { describeEvent } from '../lib/eventFile';

interface Props {
  backups: Backup[];
  onExport: () => void;
  /** Reads the chosen file; resolves to an error message to show, or null once it's handled. */
  onImport: (file: File) => Promise<string | null>;
  onRestore: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
  onDeleteAll: () => void;
}

/** Drawn rather than an emoji, so it matches the other icons and takes the button's color. */
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "Today 14:32", "Yesterday 09:05" or "Oct 21 16:40". */
function when(at: number, now = Date.now()): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((day(new Date(now)) - day(date)) / 86_400_000);
  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

/**
 * Keeping the event safe: save it as a file (to a USB stick, a shared drive or another laptop)
 * and open one again, and go back to an automatic backup from this browser.
 */
export function BackupsPanel({ backups, onExport, onImport, onRestore, onDelete, onDeleteAll }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          Event file and backups <span className="count">{backups.length ? `${backups.length} saved` : 'none yet'}</span>
        </h2>
        <div className="actions">
          <button className="btn" onClick={onExport}>
            Export event
          </button>
          <button className="btn" onClick={() => input.current?.click()}>
            Import event
          </button>
          <button className="btn btn-quiet" disabled={backups.length === 0} onClick={onDeleteAll}>
            Delete all
          </button>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) setError(await onImport(file));
        }}
      />
      <p className="muted backups-intro">
        Export saves everything (teams, times, the bracket with its results, the logo and colors) as one file you can
        keep anywhere and import on any computer. Backups below are taken automatically as the event changes, and kept
        in this browser only.
      </p>
      {error && <p className="notice notice--error">{error}</p>}
      {backups.length > 0 && (
        <ol className="backups">
          {backups.map((backup, i) => (
            // Two backups can share a millisecond (the one before a restore and the restored one).
            <li key={`${backup.at}-${i}`} className="backup">
              <span className="backup__when">{when(backup.at)}</span>
              <span className="backup__what">
                <span className="backup__reason">{BACKUP_LABELS[backup.reason]}</span>
                <span className="muted">{describeEvent(backup.content)}</span>
              </span>
              <span className="backup__actions">
                <button className="btn btn-quiet" onClick={() => onRestore(backup)}>
                  Restore
                </button>
                <button
                  className="icon-btn backup__delete"
                  title="Delete this backup"
                  aria-label={`Delete the backup from ${when(backup.at)}`}
                  onClick={() => onDelete(backup)}
                >
                  <TrashIcon />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
