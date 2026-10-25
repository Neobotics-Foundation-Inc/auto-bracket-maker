import { useMemo, type KeyboardEvent } from 'react';
import { isCleared, NO_CHECKS, normalizeName, seedTeams, shownSeeds } from '../lib/entrants';
import { checkTimeParts, formatTime } from '../lib/time';
import type { Checks, Entrant, TimeParts } from '../lib/types';

interface Props {
  entrants: Entrant[];
  onChange: (entrants: Entrant[]) => void;
  /** Shows each team's check-in, inspection and obstacle test, and seeds only cleared teams. */
  requireChecks: boolean;
}

const TIME_FIELDS: { key: keyof TimeParts; label: string; maxLength: number }[] = [
  { key: 'min', label: 'minutes', maxLength: 3 },
  { key: 'sec', label: 'seconds', maxLength: 2 },
  { key: 'ms', label: 'milliseconds', maxLength: 3 },
];

const timeInputs = () => [...document.querySelectorAll<HTMLInputElement>('[data-time-input]')];

/** Enter jumps to the next team's minutes, for fast data entry. */
function onTimeKey(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = timeInputs();
  inputs.slice(inputs.indexOf(e.currentTarget) + 1).find((input) => input.dataset.timeInput === 'min')?.focus();
}

/**
 * Typing ":" or "." moves to the next box, so "1:23.450" can be typed straight through.
 * Checked on the value rather than the key, since phone keyboards often send no key events.
 */
function moveOnSeparator(input: HTMLInputElement) {
  if (!/[:.,]/.test(input.value) || input.dataset.timeInput === 'ms') return;
  const inputs = timeInputs();
  inputs[inputs.indexOf(input) + 1]?.focus();
}

const CHECKS: { key: keyof Checks; short: string; label: string }[] = [
  { key: 'checkedIn', short: 'In', label: 'Checked in' },
  { key: 'inspected', short: 'Insp.', label: 'Inspected' },
  { key: 'obstacleTest', short: 'Obst.', label: 'Passed the obstacle test' },
];

export function TeamTable({ entrants, onChange, requireChecks }: Props) {
  const seeds = useMemo(() => shownSeeds(seedTeams(entrants, requireChecks)), [entrants, requireChecks]);
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
    <table className={`team-table ${requireChecks ? 'team-table--checks' : ''}`}>
      <thead>
        <tr>
          <th className="num">#</th>
          <th className="num">Seed</th>
          <th>Team name</th>
          <th>Time-trial result (min : sec . ms)</th>
          {requireChecks && <th title="Checked in · Inspected · Passed the obstacle test">Cleared</th>}
          <th aria-label="Remove" />
        </tr>
      </thead>
      <tbody>
        {entrants.map((entrant, i) => {
          const time = checkTimeParts(entrant);
          const timeInvalid = time.error !== null;
          const duplicate = (duplicates.get(normalizeName(entrant.name)) ?? 0) > 1;
          const seed = seeds.get(entrant.id);
          const blocked = requireChecks && !isCleared(entrant);
          return (
            <tr key={entrant.id} className={blocked ? 'team-row--blocked' : undefined}>
              <td className="num muted team-table__index">{i + 1}</td>
              <td className="num team-table__seed">
                {seed ? (
                  <span className="seed">{seed}</span>
                ) : (
                  <span className="muted" title={blocked ? 'Not cleared yet, so not seeded' : 'No time yet'}>
                    –
                  </span>
                )}
              </td>
              <td className="team-table__name">
                <input
                  className={duplicate ? 'invalid' : undefined}
                  value={entrant.name}
                  placeholder="Team name"
                  aria-label={`Team ${i + 1} name`}
                  onChange={(e) => update(entrant.id, { name: e.target.value })}
                />
              </td>
              <td className="team-table__time">
                <div className="time-cell">
                  <div className="time-fields">
                    {TIME_FIELDS.map((field, f) => (
                      <span key={field.key} className="time-field">
                        {f > 0 && <span className="time-sep">{f === 1 ? ':' : '.'}</span>}
                        <input
                          data-time-input={field.key}
                          className={`mono ${timeInvalid ? 'invalid' : ''}`}
                          value={entrant[field.key]}
                          placeholder={field.key}
                          inputMode="numeric"
                          style={{ width: `${field.maxLength + 3}ch` }}
                          aria-label={`Team ${i + 1} ${field.label}`}
                          onChange={(e) => {
                            // Capped here rather than with maxLength, which would block a separator in a full box.
                            const digits = e.target.value.replace(/\D/g, '').slice(0, field.maxLength);
                            update(entrant.id, { [field.key]: digits });
                            moveOnSeparator(e.target);
                          }}
                          // Deferred so the click that focused the box doesn't clear the selection.
                          onFocus={(e) => {
                            const input = e.target;
                            setTimeout(() => input.select());
                          }}
                          onKeyDown={onTimeKey}
                        />
                      </span>
                    ))}
                  </div>
                  <span className={timeInvalid ? 'hint error' : 'hint'}>
                    {time.error ?? (time.ms !== null ? formatTime(time.ms) : '')}
                  </span>
                </div>
              </td>
              {requireChecks && (
                <td className="team-table__checks">
                  <div className="checks" role="group" aria-label={`${entrant.name || `Team ${i + 1}`}: eligibility`}>
                    {CHECKS.map((c) => {
                      const on = !!entrant.checks?.[c.key];
                      return (
                        <button
                          key={c.key}
                          className={`check ${on ? 'check--on' : ''}`}
                          aria-pressed={on}
                          title={`${c.label}: ${on ? 'yes' : 'not yet'}`}
                          onClick={() => update(entrant.id, { checks: { ...NO_CHECKS, ...entrant.checks, [c.key]: !on } })}
                        >
                          {c.short}
                        </button>
                      );
                    })}
                  </div>
                </td>
              )}
              <td className="team-table__remove">
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
