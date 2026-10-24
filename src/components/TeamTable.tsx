import { useMemo, type KeyboardEvent } from 'react';
import { normalizeName, seedTeams } from '../lib/entrants';
import { formatTime, parseTime } from '../lib/time';
import type { Entrant } from '../lib/types';

interface Props {
  entrants: Entrant[];
  onChange: (entrants: Entrant[]) => void;
}

/** Enter in a time box jumps to the next team's time, for fast data entry. */
function focusNextTime(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-time-input]')];
  inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
}

export function TeamTable({ entrants, onChange }: Props) {
  const seeds = useMemo(() => new Map(seedTeams(entrants).map((t) => [t.id, t.seed])), [entrants]);
  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entrants) {
      const key = normalizeName(e.name);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entrants]);

  const update = (id: string, patch: Partial<Entrant>) =>
    onChange(entrants.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  if (entrants.length === 0) {
    return <p className="empty">No teams yet. Upload a spreadsheet or add teams one at a time.</p>;
  }

  return (
    <table className="team-table">
      <thead>
        <tr>
          <th className="num">#</th>
          <th className="num">Seed</th>
          <th>Team name</th>
          <th>Time-trial result</th>
          <th aria-label="Remove" />
        </tr>
      </thead>
      <tbody>
        {entrants.map((entrant, i) => {
          const timeMs = parseTime(entrant.timeText);
          const timeInvalid = entrant.timeText.trim() !== '' && timeMs === null;
          const duplicate = (duplicates.get(normalizeName(entrant.name)) ?? 0) > 1;
          const seed = seeds.get(entrant.id);
          return (
            <tr key={entrant.id}>
              <td className="num muted">{i + 1}</td>
              <td className="num">{seed ? <span className="seed">{seed}</span> : <span className="muted">–</span>}</td>
              <td>
                <input
                  className={duplicate ? 'invalid' : undefined}
                  value={entrant.name}
                  placeholder="Team name"
                  aria-label={`Team ${i + 1} name`}
                  onChange={(e) => update(entrant.id, { name: e.target.value })}
                />
              </td>
              <td>
                <div className="time-cell">
                  <input
                    data-time-input
                    className={`mono ${timeInvalid ? 'invalid' : ''}`}
                    value={entrant.timeText}
                    placeholder="m:ss.xx or seconds"
                    inputMode="decimal"
                    aria-label={`Team ${i + 1} time`}
                    onChange={(e) => update(entrant.id, { timeText: e.target.value })}
                    onKeyDown={focusNextTime}
                  />
                  <span className={timeInvalid ? 'hint error' : 'hint'}>
                    {timeInvalid ? 'Invalid time' : timeMs !== null ? formatTime(timeMs) : ''}
                  </span>
                </div>
              </td>
              <td>
                <button
                  className="icon-btn"
                  title={`Remove ${entrant.name || 'team'}`}
                  aria-label={`Remove ${entrant.name || 'team'}`}
                  onClick={() => onChange(entrants.filter((e) => e.id !== entrant.id))}
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
