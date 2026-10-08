/**
 * Les minuteurs d'une étape — bibliothèque pure (docs/etude-recettes.md §5,
 * mode cuisine). « Cuire 25 minutes » propose un minuteur de 25:00 ; « 1 h 30 »,
 * 1:30:00 ; « 20 à 25 min », le plus court (on vérifie, on prolonge au besoin).
 */
import { fold } from './ingredients';

export interface StepTimer {
  /** Le passage du texte, tel qu'il est écrit (« 25 minutes »). */
  label: string;
  seconds: number;
  /** Position dans le texte, pour le mettre en valeur. */
  start: number;
  end: number;
}

const UNIT = String.raw`(heures?|h|minutes?|min|mn|secondes?|sec|s)`;
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

export function findTimers(text: string): StepTimer[] {
  const f = fold(text);
  const out: StepTimer[] = [];
  // « 1 h 30 », « 1h30 », « 1 heure 15 » d'abord, puis les durées simples ou en fourchette.
  const pattern = new RegExp(
    `\\b${NUM}\\s*(?:h|heures?)\\s*(\\d{1,2})(?!\\s*(?:min|mn|minutes?|s|sec|secondes?|\\d))\\b|\\b${NUM}(?:\\s*(?:a|-|–|ou)\\s*${NUM})?\\s*${UNIT}\\b`,
    'g',
  );
  for (const m of f.matchAll(pattern)) {
    let seconds: number;
    if (m[1] !== undefined) {
      seconds = Number(m[1].replace(',', '.')) * 3600 + Number(m[2]) * 60;
    } else {
      const value = Number(m[3].replace(',', '.'));
      const unit = m[5];
      const factor = unit.startsWith('h') ? 3600 : unit.startsWith('s') ? 1 : 60;
      seconds = value * factor;
    }
    seconds = Math.round(seconds);
    // Un minuteur sert entre 10 secondes et 12 heures ; « 2 s » est souvent un « 2 » suivi d'un pluriel.
    if (seconds < 10 || seconds > 43_200) continue;
    const start = m.index ?? 0;
    out.push({ label: text.slice(start, start + m[0].length), seconds, start, end: start + m[0].length });
  }
  return out;
}

/** 1500 → « 25:00 » ; 5400 → « 1:30:00 ». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
