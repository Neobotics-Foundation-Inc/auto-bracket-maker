import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { downloadFile } from '../lib/download';
import { EMPTY_TIME, isCleared, MAX_TEAMS, mergeRows, newId, validateEntrants } from '../lib/entrants';
import type { BestOf, Entrant, EventInfo, ThirdPlaceFormat } from '../lib/types';
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
  format: ThirdPlaceFormat;
  onFormatChange: (format: ThirdPlaceFormat) => void;
  bestOf: BestOf;
  onBestOfChange: (bestOf: BestOf) => void;
  /** Eligibility checks: only teams checked in and inspected are seeded. */
  requireChecks: boolean;
  onRequireChecksChange: (on: boolean) => void;
  /** Panels after the teams, such as the event file and backups. */
  children?: ReactNode;
}

const FORMATS: { value: ThirdPlaceFormat; title: string; detail: string }[] = [
  {
    value: 'race',
    title: 'Third-place race',
    detail: 'The two semifinal losers race once more. The winner takes 3rd.',
  },
  {
    value: 'double',
    title: 'Losers bracket',
    detail:
      'Double elimination: a team is out after two losses. Losers get a second chance in a losers bracket, whose winner meets the main bracket’s winner in a grand final. About twice the races.',
  },
  {
    value: 'seed',
    title: 'Time-trial tiebreak',
    detail: 'No extra race: of the two semifinal losers, the one with the faster time trial takes 3rd.',
  },
];

const HEATS: { value: BestOf; title: string; detail: string }[] = [
  {
    value: 1,
    title: 'Single heat',
    detail: 'One heat per race: the winner advances.',
  },
  {
    value: 3,
    title: 'Best of 3',
    detail: 'The first team to win 2 heats advances. Click a team once for each heat it wins.',
  },
];

type Notice ={ kind: 'info' | 'error'; text: string } | null;

export function SetupPage(props: Props) {
  const { event, entrants, hasBracket, bracketStale, onEventChange, onEntrantsChange } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dragging, setDragging] = useState(false);
  const problems = validateEntrants(entrants, props.requireChecks);
  const cleared = entrants.filter(isCleared).length;

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      // The spreadsheet parser is large, so it only loads when a file is imported.
      const { readTeamRows } = await import('../lib/excel');
      const rows = await readTeamRows(file);
      if (rows.length === 0) {
        setNotice({ kind: 'error', text: `No team names found in ${file.name}.` });
        return;
      }
      const result = mergeRows(entrants, rows);
      onEntrantsChange(result.entrants);
      const teams = (n: number) => `${n} ${n === 1 ? 'team' : 'teams'}`;
      const parts = [`Added ${teams(result.added)} from ${file.name}.`];
      if (result.updated) parts.push(`Updated ${teams(result.updated)} already listed.`);
      if (result.duplicates) parts.push(`Skipped ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}.`);
      if (result.badTimes) {
        parts.push(
          result.badTimes === 1
            ? '1 time couldn’t be read and was left blank.'
            : `${result.badTimes} times couldn’t be read and were left blank.`,
        );
      }
      if (result.overflow) parts.push(`${result.overflow} left out: the limit is ${MAX_TEAMS} teams.`);
      setNotice({ kind: result.overflow || result.badTimes ? 'error' : 'info', text: parts.join(' ') });
      // A sheet with check columns means the event is tracking them.
      if (rows.some((r) => r.checks) && !props.requireChecks) props.onRequireChecksChange(true);
    } catch {
      setNotice({ kind: 'error', text: `Couldn't read ${file.name}. Use an .xlsx, .xls or .csv file.` });
    }
  }

  async function downloadTemplate() {
    const { templateCsv } = await import('../lib/excel');
    downloadFile('teams-template.csv', templateCsv(), 'text/csv');
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
        <h2>Third place</h2>
        <div className="format-options" role="radiogroup" aria-label="How third place is decided">
          {FORMATS.map((f) => (
            <label key={f.value} className={`format-option ${props.format === f.value ? 'format-option--active' : ''}`}>
              <input
                type="radio"
                name="format"
                value={f.value}
                checked={props.format === f.value}
                onChange={() => props.onFormatChange(f.value)}
              />
              <span className="format-option__title">{f.title}</span>
              <span className="format-option__detail">{f.detail}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Heats per race</h2>
        <p className="muted panel-note">For a new bracket. Each round can then be changed from its heading on the bracket.</p>
        <div className="format-options" role="radiogroup" aria-label="Heats per race">
          {HEATS.map((h) => (
            <label key={h.value} className={`format-option ${props.bestOf === h.value ? 'format-option--active' : ''}`}>
              <input
                type="radio"
                name="heats"
                value={h.value}
                checked={props.bestOf === h.value}
                onChange={() => props.onBestOfChange(h.value)}
              />
              <span className="format-option__title">{h.title}</span>
              <span className="format-option__detail">{h.detail}</span>
            </label>
          ))}
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
            <button className="btn btn-quiet" onClick={() => void downloadTemplate()}>
              Download template
            </button>
            <button className="btn" onClick={addTeam} disabled={entrants.length >= MAX_TEAMS}>
              Add team
            </button>
            <button className="btn btn-quiet" onClick={clearTeams} disabled={!entrants.length}>
              Clear all
            </button>
          </div>
        </div>

        <label className="checks-toggle">
          <input
            type="checkbox"
            checked={props.requireChecks}
            onChange={(e) => props.onRequireChecksChange(e.target.checked)}
          />
          <span>
            <strong>Eligibility checks</strong>
            <span className="muted">
              {props.requireChecks
                ? ` Only teams checked in and inspected are seeded: ${cleared} of ${entrants.length} cleared.`
                : ' Track check-in and inspection for each team, and seed only the cleared ones.'}
            </span>
          </span>
        </label>

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
          Drop an Excel or CSV file here. With headers like the template’s (Team, Time trial, Checked in, Inspected),
          each column is read in; otherwise team names come from the first column. Teams already listed get the
          sheet’s times and checks.
        </div>
        {notice && <p className={`notice notice--${notice.kind}`}>{notice.text}</p>}

        <TeamTable entrants={entrants} onChange={onEntrantsChange} requireChecks={props.requireChecks} />
      </section>

      {props.children}

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
                ? 'Teams, times or format changed since the bracket was made. Generate again to update it.'
                : props.requireChecks && cleared < entrants.length
                  ? `All set: the ${cleared} cleared teams will be seeded, fastest first.`
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
