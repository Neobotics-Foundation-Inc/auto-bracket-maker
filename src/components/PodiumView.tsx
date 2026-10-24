import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { podium } from '../lib/bracket';
import { formatTime } from '../lib/time';
import type { Bracket, ThirdPlaceFormat } from '../lib/types';
import { FitToScreen } from './FitToScreen';

interface Props {
  bracket: Bracket;
}

const WIDTH = 960;
const HEIGHT = 520;

/** What each empty step is waiting for, per format. */
const PENDING: Record<ThirdPlaceFormat, Record<1 | 2 | 3, string>> = {
  race: { 1: 'Winner of the final', 2: 'Runner-up of the final', 3: 'Winner of the third-place race' },
  double: { 1: 'Winner of the grand final', 2: 'Runner-up of the grand final', 3: 'Runner-up of the losers final' },
  seed: { 1: 'Winner of the final', 2: 'Runner-up of the final', 3: 'Faster semifinal loser in the time trial' },
};

const PLACES = [
  { place: 2, label: '2nd' },
  { place: 1, label: '1st' },
  { place: 3, label: '3rd' },
] as const;

const MIN_NAME_SIZE = 16;

/**
 * A team name at the largest size (up to maxSize) where it fits in two lines without
 * breaking a word, so long names shrink instead of being cut off.
 */
function FittedName({ name, maxSize }: { name: string; maxSize: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(maxSize);
  // Bumped to start measuring again from maxSize, e.g. once the title font has loaded.
  const [pass, setPass] = useState(0);

  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setPass((p) => p + 1));
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => setSize(maxSize), [name, maxSize, pass]);
  useLayoutEffect(() => {
    const el = ref.current;
    const overflows = el && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    if (overflows && size > MIN_NAME_SIZE) setSize(size - 2);
  }, [size, name, pass]);

  return (
    <span ref={ref} className="podium-place__name" title={name} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

/** First, second and third on a podium, with the winner on the centre step. */
export function PodiumView({ bracket }: Props) {
  const result = podium(bracket);
  const ids = { 1: result.first, 2: result.second, 3: result.third };
  // With 2 teams there are no semifinals, so no third place to show.
  const places = PLACES.filter((p) => p.place !== 3 || bracket.rounds.length >= 2).map((p) => ({
    ...p,
    pending: PENDING[bracket.format][p.place],
  }));

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
                    <FittedName name={team.name} maxSize={place === 1 ? 38 : 30} />
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
