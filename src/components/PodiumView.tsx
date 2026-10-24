import { podium } from '../lib/bracket';
import { formatTime } from '../lib/time';
import type { Bracket } from '../lib/types';
import { FitToScreen } from './FitToScreen';

interface Props {
  bracket: Bracket;
}

const WIDTH = 960;
const HEIGHT = 520;

const PLACES = [
  { place: 2, label: '2nd', pending: 'Runner-up of the final' },
  { place: 1, label: '1st', pending: 'Winner of the final' },
  { place: 3, label: '3rd', pending: 'Winner of the third-place race' },
] as const;

/** First, second and third on a podium, with the winner on the centre step. */
export function PodiumView({ bracket }: Props) {
  const result = podium(bracket);
  const ids = { 1: result.first, 2: result.second, 3: result.third };
  // With 2 teams there is no third place to show.
  const places = PLACES.filter((p) => p.place !== 3 || bracket.thirdPlace);

  return (
    // Always scaled to fit: the podium is a single picture, never something to scroll.
    <FitToScreen width={WIDTH} height={HEIGHT} fit>
      <div className="podium-stage" style={{ width: WIDTH, height: HEIGHT }}>
        {places.map(({ place, label, pending }) => {
          const id = ids[place];
          const team = id ? bracket.teams[id] : null;
          return (
            <div key={place} className={`podium-place podium-place--${place} ${team ? '' : 'podium-place--pending'}`}>
              <div className="podium-place__team" key={id ?? 'pending'}>
                {team ? (
                  <>
                    <span className="podium-place__name" title={team.name}>
                      {team.name}
                    </span>
                    <span className="podium-place__meta">
                      Seed {team.seed} · Time trial <span className="mono">{formatTime(team.timeMs)}</span>
                    </span>
                  </>
                ) : (
                  <span className="podium-place__pending">{pending}</span>
                )}
              </div>
              <div className="podium-place__step">
                <span className="podium-place__label">{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </FitToScreen>
  );
}
