import { formatTime } from '../lib/time';
import type { SeededTeam } from '../lib/types';
import { FitToScreen } from './FitToScreen';

interface Props {
  teams: SeededTeam[];
  present: boolean;
}

const ROW_H = 44;
const HEAD_H = 48;
const COL_W = 600;
const COL_GAP = 48;
const MAX_ROWS_PER_COL = 25;

/** Time-trial ranking, split into two columns when there are many teams. */
export function StandingsView({ teams, present }: Props) {
  const perCol = teams.length > MAX_ROWS_PER_COL ? Math.ceil(teams.length / 2) : teams.length;
  const columns = perCol ? [teams.slice(0, perCol), teams.slice(perCol)].filter((c) => c.length) : [];
  const width = columns.length * COL_W + (columns.length - 1) * COL_GAP;
  const height = HEAD_H + perCol * ROW_H;
  const leader = teams[0]?.timeMs ?? 0;

  return (
    <FitToScreen width={Math.max(width, COL_W)} height={height} fit={present}>
      <div className="standings" style={{ gap: COL_GAP }}>
        {columns.map((col, c) => (
          <table key={c} style={{ width: COL_W }}>
            <thead>
              <tr style={{ height: HEAD_H }}>
                <th className="num">Seed</th>
                <th>Team</th>
                <th className="num">Time</th>
                <th className="num">Gap</th>
              </tr>
            </thead>
            <tbody>
              {col.map((t) => (
                <tr key={t.id} style={{ height: ROW_H }} className={t.seed <= 3 ? `podium podium--${t.seed}` : ''}>
                  <td className="num">
                    <span className="seed">{t.seed}</span>
                  </td>
                  <td className="name" title={t.name}>
                    {t.name}
                  </td>
                  <td className="num mono">{formatTime(t.timeMs)}</td>
                  <td className="num mono muted">{t.seed === 1 ? '–' : `+${formatTime(t.timeMs - leader)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </FitToScreen>
  );
}
