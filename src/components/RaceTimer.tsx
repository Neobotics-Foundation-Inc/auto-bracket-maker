import { useEffect, useState } from 'react';
import {
  clampDuration,
  formatCountdown,
  formatCountdownParts,
  MAX_RACE_MS,
  parseDuration,
  phase,
  remaining,
  STEP_MS,
  WARNING_MS,
} from '../lib/timer';
import type { RaceTimer as Timer } from '../lib/types';

interface Props {
  timer: Timer;
  /** Start, pause, or reset once finished. */
  onToggle: () => void;
  /** Back to the full duration. */
  onReset: () => void;
  /** Lengthens (+1) or shortens (−1) the race by a step. */
  onAdjust: (steps: number) => void;
  /** Sets the race length typed in. */
  onSetDuration: (ms: number) => void;
  /** toolbar: compact, with duration controls. stage: large, for the audience in present mode. */
  variant: 'toolbar' | 'stage';
}

const LABELS = { idle: 'Race timer', running: 'Race timer', paused: 'Paused', finished: 'Time!' };
const ACTIONS = { idle: 'Start', running: 'Pause', paused: 'Resume', finished: 'Reset' };

/**
 * Re-renders while the countdown runs: a few times a second for whole seconds, or every
 * screen frame (`smooth`) so milliseconds run continuously.
 */
function useNow(running: boolean, smooth: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    if (smooth) {
      let frame = requestAnimationFrame(function tick() {
        setNow(Date.now());
        frame = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(frame);
    }
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running, smooth]);
  return now;
}

/** Drawn rather than typed, so the sign sits exactly in the middle of its round button. */
function StepIcon({ plus }: { plus: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d={plus ? 'M2 7h10M7 2v10' : 'M2 7h10'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The race length, typed straight in while the timer is stopped: "2:30", or a plain number
 * (up to 30 as minutes, above as seconds). Enter or leaving the box applies it; Escape or
 * anything unreadable puts the current length back.
 */
function DurationInput({ durationMs, onSet }: { durationMs: number; onSet: (ms: number) => void }) {
  const [text, setText] = useState(formatCountdown(durationMs));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(formatCountdown(durationMs)), [durationMs]);

  const commit = () => {
    const ms = parseDuration(text);
    if (ms === null) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 1200);
    } else {
      onSet(ms);
    }
    // Shows the length as applied (rounded and within limits), or the old one if unreadable.
    setText(formatCountdown(ms === null ? durationMs : clampDuration(ms)));
  };

  return (
    <input
      className={`race-timer__time race-timer__input ${invalid ? 'race-timer__input--invalid' : ''}`}
      value={text}
      inputMode="numeric"
      spellCheck={false}
      maxLength={8}
      aria-label="Race length (minutes:seconds)"
      title="Type a race length, like 2:30"
      onFocus={(e) => e.target.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(formatCountdown(durationMs));
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function RaceTimer({ timer, onToggle, onReset, onAdjust, onSetDuration, variant }: Props) {
  const now = useNow(timer.endsAt !== null, variant === 'stage');
  const state = phase(timer, now);
  const left = remaining(timer, now);
  const warning = state === 'running' && left <= WARNING_MS;
  const className = `race-timer race-timer--${variant} race-timer--${state} ${warning ? 'race-timer--warning' : ''}`;

  if (variant === 'stage') {
    const { main, millis } = formatCountdownParts(left);
    return (
      <div className={className} role="timer" aria-live="off">
        <span className="race-timer__label">{LABELS[state]}</span>
        <span className="race-timer__time">
          {main}
          <span className="race-timer__ms">{millis}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={className} role="group" aria-label="Race timer">
      {state === 'idle' && (
        <button
          className="btn race-timer__step"
          onClick={() => onAdjust(-1)}
          disabled={timer.durationMs <= STEP_MS}
          title="30 seconds shorter"
          aria-label="30 seconds shorter"
        >
          <StepIcon plus={false} />
        </button>
      )}
      {state === 'idle' ? (
        <DurationInput durationMs={timer.durationMs} onSet={onSetDuration} />
      ) : (
        <span className="race-timer__time" role="timer" title={LABELS[state]}>
          {formatCountdown(left)}
        </span>
      )}
      {state === 'idle' && (
        <button
          className="btn race-timer__step"
          onClick={() => onAdjust(1)}
          disabled={timer.durationMs >= MAX_RACE_MS}
          title="30 seconds longer"
          aria-label="30 seconds longer"
        >
          <StepIcon plus />
        </button>
      )}
      <button className={`btn ${state === 'running' ? '' : 'btn-primary'}`} onClick={onToggle} title={`${ACTIONS[state]} (Space)`}>
        {ACTIONS[state]}
      </button>
      {(state === 'running' || state === 'paused') && (
        <button className="btn btn-quiet" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}
