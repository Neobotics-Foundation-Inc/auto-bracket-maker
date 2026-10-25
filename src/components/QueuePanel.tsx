import { useEffect, useState } from 'react';
import { matchLabel } from '../lib/bracket';
import { clockTime, finishesAt, racesLeft, startsAt } from '../lib/queue';
import type { Bracket, Match } from '../lib/types';

interface Props {
  bracket: Bracket;
  queue: Match[];
  seeds: Map<string, number>;
  slotMs: number;
  onSlotChange: (ms: number) => void;
  onMove: (id: string, delta: -1 | 1) => void;
}

/** The clock, a few times a minute: enough for estimated start times. */
function useMinuteClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** "3 MIT BWSI vs 30 Duke RoboRacers". */
export function pairing(bracket: Bracket, match: Match, seeds: Map<string, number>): string {
  const side = (slot: string | null) => {
    const team = slot ? bracket.teams[slot] : undefined;
    return team ? `${seeds.get(team.id) ?? team.seed} ${team.name}` : 'TBD';
  };
  return `${side(match.a)} vs ${side(match.b)}`;
}

/**
 * The running order for the pit lane: the race on track, the next ones with estimated start
 * times, the races left and when the last should finish. Opened up, every ready race can be moved
 * up or down, for teams swapping slots.
 */
export function QueuePanel({ bracket, queue, seeds, slotMs, onSlotChange, onMove }: Props) {
  const now = useMinuteClock();
  const [open, setOpen] = useState(false);
  const left = racesLeft(bracket);
  const [current, ...next] = queue;
  if (!left) return null;

  return (
    <section className={`queue ${open ? 'queue--open' : ''}`} aria-label="Race queue">
      <div className="queue__summary">
        {current ? (
          <p className="queue__now">
            <span className="queue__tag">Now on track</span>
            <span className="queue__race">{matchLabel(bracket, current)}</span>
            <span className="queue__teams">{pairing(bracket, current, seeds)}</span>
          </p>
        ) : (
          <p className="queue__now muted">No race is ready: the next ones wait for results.</p>
        )}
        {next.length > 0 && (
          <p className="queue__deck">
            <span className="queue__tag">On deck</span>
            {next.slice(0, 2).map((m, i) => (
              <span key={m.id} className="queue__deck-item">
                <span className="mono">{clockTime(startsAt(i + 1, slotMs, now))}</span> {pairing(bracket, m, seeds)}
              </span>
            ))}
          </p>
        )}
        <p className="queue__meta">
          <span>
            {left} {left === 1 ? 'race' : 'races'} left · finish ≈ <span className="mono">{clockTime(finishesAt(bracket, slotMs, now))}</span>
          </span>
          <label className="queue__slot">
            <input
              type="number"
              min={1}
              max={60}
              value={Math.round(slotMs / 60_000)}
              onChange={(e) => {
                const minutes = Math.min(Math.max(Number(e.target.value) || 1, 1), 60);
                onSlotChange(minutes * 60_000);
              }}
              aria-label="Minutes per race, heat and changeover"
            />
            <span>min per race</span>
          </label>
          {queue.length > 1 && (
            <button className="btn btn-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'Hide queue' : `Full queue (${queue.length})`}
            </button>
          )}
        </p>
      </div>
      {open && (
        <ol className="queue__list">
          {queue.map((m, i) => (
            <li key={m.id} className="queue__item">
              <span className="mono queue__time">{i === 0 ? 'Now' : clockTime(startsAt(i, slotMs, now))}</span>
              <span className="queue__race">{matchLabel(bracket, m)}</span>
              <span className="queue__teams">{pairing(bracket, m, seeds)}</span>
              <span className="queue__moves">
                <button className="icon-btn" disabled={i === 0} onClick={() => onMove(m.id, -1)} aria-label={`Move ${matchLabel(bracket, m)} earlier`} title="Earlier">
                  ↑
                </button>
                <button
                  className="icon-btn"
                  disabled={i === queue.length - 1}
                  onClick={() => onMove(m.id, 1)}
                  aria-label={`Move ${matchLabel(bracket, m)} later`}
                  title="Later"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
