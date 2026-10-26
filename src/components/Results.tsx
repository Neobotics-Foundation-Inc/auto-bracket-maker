import { shownSeeds } from '../lib/entrants';
import { placings, raceRows } from '../lib/results';
import { formatTime } from '../lib/time';
import type { Bracket, EventInfo, SeededTeam } from '../lib/types';

interface ActionsProps {
  hasBracket: boolean;
  hasStandings: boolean;
  onStandings: () => void;
  onResults: () => void;
  onPrint: () => void;
}

/** The three ways to get results out: two spreadsheets and a printable page (or PDF). */
export function ResultsActions({ hasBracket, hasStandings, onStandings, onResults, onPrint }: ActionsProps) {
  return (
    <div className="actions">
      <button className="btn" disabled={!hasStandings} onClick={onStandings}>
        Standings (CSV)
      </button>
      <button className="btn" disabled={!hasBracket} onClick={onResults}>
        Race results (CSV)
      </button>
      <button className="btn" disabled={!hasStandings} onClick={onPrint}>
        Print or save as PDF
      </button>
    </div>
  );
}

/** On the Setup page: the results, ready to post on the event's site after the competition. */
export function ResultsPanel(props: ActionsProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Results</h2>
        <ResultsActions {...props} />
      </div>
      <p className="muted backups-intro">
        The time-trial standings and every race result as spreadsheets, or a printable page with the podium, standings
        and races (choose “Save as PDF” in the print dialog).
      </p>
    </section>
  );
}

interface PrintProps {
  event: EventInfo;
  standings: SeededTeam[];
  bracket: Bracket | null;
}

/** Shown only when printing: the event's results on plain paper. */
export function PrintResults({ event, standings, bracket }: PrintProps) {
  const seeds = shownSeeds(standings);
  const fastest = standings[0]?.timeMs ?? 0;
  const races = bracket ? raceRows(bracket) : [];
  return (
    <div className="print-results" aria-hidden>
      <h1>{event.title || 'Tournament results'}</h1>
      {event.subtitle && <p>{event.subtitle}</p>}
      <p className="print-results__date">Results as of {new Date().toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>

      {bracket && (
        <>
          <h2>Podium</h2>
          <ol className="print-results__podium">
            {placings(bracket).map((p) => (
              <li key={p.place}>
                <strong>{p.place}</strong> {p.team ?? 'Not decided yet'}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Time-trial standings</h2>
      <table>
        <thead>
          <tr>
            <th>Seed</th>
            <th>Team</th>
            <th>Time</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((t) => (
            <tr key={t.id}>
              <td>{seeds.get(t.id) ?? t.seed}</td>
              <td>{t.name}</td>
              <td>{formatTime(t.timeMs)}</td>
              <td>{t.timeMs === fastest ? '' : `+${formatTime(t.timeMs - fastest)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {races.length > 0 && (
        <>
          <h2>Races</h2>
          <table>
            <thead>
              <tr>
                <th>Race</th>
                <th>Teams</th>
                <th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {races.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.section !== 'Bracket' && r.section !== r.race && `${r.section} · `}
                    {r.race}
                  </td>
                  <td>
                    {r.teamA} vs {r.teamB}
                  </td>
                  <td>
                    {r.winner || (r.status === 'Ready' ? 'To race' : '—')}
                    {r.score && ` (${r.score})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
