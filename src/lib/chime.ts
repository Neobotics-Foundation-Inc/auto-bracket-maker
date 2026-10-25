// Browsers only allow sound after a click or key press, so the audio is unlocked when the
// timer is started and the chime itself plays later, when time runs out.
let audio: AudioContext | null = null;

/** Call from a click or key press (starting the timer). */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}

/** Three short beeps, rising on the last, for the end of a race. */
export function chime() {
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.35, 0.7].forEach((offset, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = 'square';
    osc.frequency.value = i === 2 ? 1320 : 880;
    const at = t0 + offset;
    const length = i === 2 ? 0.5 : 0.18;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(audio!.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  });
}
