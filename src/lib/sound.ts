/**
 * Sons de célébration synthétisés en WebAudio — aucun fichier audio à charger.
 * Respecte la préférence « muet » de l'utilisateur (persistée en localStorage).
 */

const MUTE_KEY = 'zenith.muted';

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // localStorage indisponible : tant pis, la préférence ne survivra pas.
  }
}

function note(
  audio: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  peak: number,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Deux notes brèves et claires : un palier vient d'être validé. */
export function playTierChime() {
  if (isMuted()) return;
  const audio = audioContext();
  if (!audio) return;
  const t = audio.currentTime;
  note(audio, 660, t, 0.22, 0.12);
  note(audio, 990, t + 0.12, 0.32, 0.1);
}

/** Arpège ascendant : montée de rang du profil. */
export function playRankUpFanfare() {
  if (isMuted()) return;
  const audio = audioContext();
  if (!audio) return;
  const t = audio.currentTime;
  const steps = [523.25, 659.25, 783.99, 1046.5];
  steps.forEach((freq, i) => note(audio, freq, t + i * 0.11, 0.4, 0.11));
}

/** Petite vibration sur mobile, silencieusement ignorée ailleurs. */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Non supporté : rien à faire.
  }
}
