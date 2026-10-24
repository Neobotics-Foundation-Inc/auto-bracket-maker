import { useRef, useState, type DragEvent } from 'react';
import { EMPTY_TIME, MAX_TEAMS, mergeNames, newId, validateEntrants } from '../lib/entrants';
import type { Entrant, EventInfo } from '../lib/types';
import type { ConfirmRequest } from './ConfirmDialog';
import { TeamTable } from './TeamTable';

interface Props {
  event: EventInfo;
  entrants: Entrant[];
  hasBracket: boolean;
  bracketStale: boolean;
  onEventChange: (event: EventInfo) => void;
  onEntrantsChange: (entrants: Entrant[]) => void;
  onGenerate: () => void;
  onViewBracket: () => void;
  onConfirm: (request: ConfirmRequest) => void;
}

type Notice = { kind: 'info' | 'error'; text: string } | null;

export function SetupPage(props: Props) {
  const { event, entrants, hasBracket, bracketStale, onEventChange, onEntrantsChange } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dragging, setDragging] = useState(false);
  const problems = validateEntrants(entrants);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      // The spreadsheet parser is large, so it only loads when a file is imported.
      const { readTeamNames } = await import('../lib/excel');
      const names = await readTeamNames(file);
      if (names.length === 0) {
        setNotice({ kind: 'error', text: `No team names found in ${file.name}.` });
        return;
      }
      const result = mergeNames(entrants, names);
      onEntrantsChange(result.entrants);
      const parts = [`Added ${result.added} ${result.added === 1 ? 'team' : 'teams'} from ${file.name}.`];
      if (result.duplicates) parts.push(`Skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}.`);
      if (result.overflow) parts.push(`${result.overflow} left out: the limit is ${MAX_TEAMS} teams.`);
      setNotice({ kind: result.overflow ? 'error' : 'info', text: parts.join(' ') });
    } catch {
      setNotice({ kind: 'error', text: `Couldn't read ${file.name}. Use an .xlsx, .xls or .csv file.` });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void importFile(e.dataTransfer.files[0]);
  }

  function addTeam() {
    onEntrantsChange([...entrants, { id: newId(), name: '', ...EMPTY_TIME }]);
    // Focus the new name box after React renders it.
    requestAnimationFrame(() => {
      const names = document.querySelectorAll<HTMLInputElement>('.team-table input:not([data-time-input])');
      names[names.length - 1]?.focus();
    });
  }

  function clearTeams() {
    if (!entrants.length) return;
    props.onConfirm({
      title: 'Remove all teams?',
      message: 'Every team name and time on this page will be cleared.',
      confirmLabel: 'Remove all',
      onConfirm: () => {
        onEntrantsChange([]);
        setNotice(null);
      },
    });
  }

  return (
    <main className="page setup">
      <section className="panel">
        <h2>Event</h2>
        <div className="event-fields">
          <label>
            <span>Event name</span>
            <input
              value={event.title}
              placeholder="e.g. Regional Robotics Finals 2026"
              onChange={(e) => onEventChange({ ...event, title: e.target.value })}
            />
          </label>
          <label>
            <span>Subtitle (optional)</span>
            <input
              value={event.subtitle}
              placeholder="e.g. Autonomous Race · Main Hall"
              onChange={(e) => onEventChange({ ...event, subtitle: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            Teams <span className="count">{entrants.length} / {MAX_TEAMS}</span>
          </h2>
          <div className="actions">
            <button className="btn" onClick={() => fileInput.current?.click()}>
              Upload spreadsheet
            </button>
            <button className="btn" onClick={addTeam} disabled={entrants.length >= MAX_TEAMS}>
              Add team
            </button>
            <button className="btn btn-quiet" onClick={clearTeams} disabled={!entrants.length}>
              Clear all
            </button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".xlsx,.xls,.csv,.ods"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div
          className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
        >
          Drop an Excel or CSV file here. Team names are read from the first column; a header row like “Team” is
          skipped.
        </div>
        {notice && <p className={`notice notice--${notice.kind}`}>{notice.text}</p>}

        <TeamTable entrants={entrants} onChange={onEntrantsChange} />
      </section>

      <footer className="generate-bar">
        <div className="status">
          {problems.length ? (
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="ready">
              {bracketStale
                ? 'Teams or times changed since the bracket was made. Generate again to update it.'
                : 'All set. Fastest time is seed 1.'}
            </p>
          )}
        </div>
        <div className="actions">
          {hasBracket && (
            <button className="btn" onClick={props.onViewBracket}>
              View bracket
            </button>
          )}
          <button className="btn btn-primary" disabled={problems.length > 0} onClick={props.onGenerate}>
            {hasBracket ? 'Regenerate bracket' : 'Generate bracket'}
          </button>
        </div>
      </footer>
    </main>
  );
}
