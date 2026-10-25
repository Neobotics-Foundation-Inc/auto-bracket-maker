import { useMemo, useState } from 'react';
import { shownSeeds } from '../lib/entrants';
import { formatTime } from '../lib/time';
import type { SeededTeam } from '../lib/types';
import { FitToScreen, type Box } from './FitToScreen';

interface Props {
  teams: SeededTeam[];
  present: boolean;
}

const ROW_H = 44;
const HEAD_H = 48;
const COL_W = 600;
const COL_GAP = 48;
const MAX_ROWS_PER_COL = 25;
const MAX_COLUMNS = 4;
// Present mode may enlarge this far, so a short list fills a projected screen.
const PRESENT_MAX_SCALE = 4;

const sizeOf = (teamCount: number, columns: number) => {
  const perCol = Math.ceil(teamCount / columns);
  return { perCol, width: columns * COL_W + (columns - 1) * COL_GAP, height: HEAD_H + perCol * ROW_H };
};

/**
 * How many columns to split the list into. On screen, a second column starts past 25 rows.
 * Presenting, it's whichever count shows the rows largest in the space available (fewer on
 * a near tie), so a widescreen projector isn't left with empty sides.
 */
export function columnCount(teamCount: number, box: Box | null): number {
  if (!box?.w || !box.h) return teamCount > MAX_ROWS_PER_COL ? 2 : 1;
  let best = 1;
  let bestScale = 0;
  for (let c = 1; c <= Math.min(MAX_COLUMNS, Math.max(teamCount, 1)); c++) {
    const { width, height } = sizeOf(teamCount, c);
    const scale = Math.min(box.w / width, box.h / height, PRESENT_MAX_SCALE);
    if (scale > bestScale * 1.03) {
      best = c;
      bestScale = scale;
    }
  }
  return best;
}

/** Time-trial ranking, split into columns when there are many teams. */
export function StandingsView({ teams, present }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const seeds = useMemo(() => shownSeeds(teams), [teams]);
  const columnTotal = columnCount(teams.length, present ? box : null);
  const { perCol, width, height } = sizeOf(teams.length, columnTotal);
  const columns = Array.from({ length: columnTotal }, (_, c) => teams.slice(c * perCol, (c + 1) * perCol)).filter(
    (c) => c.length,
  );
  const leader = teams[0]?.timeMs ?? 0;

  return (
    <FitToScreen
      width={Math.max(width, COL_W)}
      height={height}
      fit={present}
      maxScale={present ? PRESENT_MAX_SCALE : undefined}
      onBox={setBox}
    >
      <div className="standings" style={{ gap: COL_GAP }}>
        {columns.map((col, c) => (
          <div key={c} className="standings-card ring ring--slow" style={{ width: COL_W }}>
            <table>
              <thead>
                <tr style={{ height: HEAD_H }}>
                  <th className="num">Seed</th>
                  <th>Team</th>
                  <th className="num">Time</th>
                  <th className="num">Gap</th>
                </tr>
              </thead>
              <tbody>
                {col.map((t) => {
                  const seed = seeds.get(t.id) ?? t.seed;
                  return (
                    <tr key={t.id} style={{ height: ROW_H }} className={seed <= 3 ? `podium podium--${seed}` : ''}>
                      <td className="num">
                        <span className="seed">{seed}</span>
                      </td>
                      <td className="name" title={t.name}>
                        {t.name}
                      </td>
                      <td className="num mono">{formatTime(t.timeMs)}</td>
                      <td className="num mono muted">{seed === 1 ? '–' : `+${formatTime(t.timeMs - leader)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </FitToScreen>
  );
}
