/**
 * Le temps sur l'axe d'un graphique — bibliothèque pure.
 *
 * Demande de Jules (06/10/2026) : sur les courbes d'une action ou d'un
 * palier, « on a les points mais pas les dates, c'est compliqué de prendre
 * conscience de la temporalité ». Deux défauts à la fois : aucune date
 * affichée, et des relevés posés à intervalles réguliers quel que soit
 * l'écart réel — trois pesées en une semaine puis une après deux mois
 * avaient l'air espacées pareil. Ici, un relevé se place à sa date.
 */

const DAY_MS = 86_400_000;

/** Jours écoulés entre deux dates `AAAA-MM-JJ`, comptés en UTC pur (pas d'heure d'été). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * La place de chaque jour sur l'axe, de 0 (le premier) à 1 (le dernier),
 * proportionnelle au temps écoulé. Un seul jour, ou tous le même : 0.
 */
export function timePositions(days: string[]): number[] {
  if (days.length === 0) return [];
  const span = daysBetween(days[0], days[days.length - 1]);
  if (span <= 0) return days.map(() => 0);
  return days.map((d) => daysBetween(days[0], d) / span);
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * « 12 mai », court pour tenir sous un axe ; l'année seulement quand elle
 * n'est pas celle d'aujourd'hui (« 12 mai 2025 »).
 */
export function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const label = `${d} ${MONTHS[m - 1]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${y}`;
}

/**
 * « il y a 3 jours », « il y a 2 mois » : ce qui donne la mesure du temps
 * d'un coup d'œil, à côté de la date.
 */
export function agoLabel(day: string, today: string): string {
  const n = daysBetween(day, today);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n < 14) return `il y a ${n} jours`;
  if (n < 60) return `il y a ${Math.round(n / 7)} semaines`;
  if (n < 365) return `il y a ${Math.round(n / 30.44)} mois`;
  const years = Math.round(n / 365.25);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

/** La durée couverte par une série, dite simplement : « sur 3 semaines ». */
export function spanLabel(from: string, to: string): string {
  const n = daysBetween(from, to);
  if (n <= 0) return 'le même jour';
  if (n < 14) return `sur ${n + 1} jours`;
  if (n < 60) return `sur ${Math.round(n / 7)} semaines`;
  if (n < 365) return `sur ${Math.round(n / 30.44)} mois`;
  const years = n / 365.25;
  return years < 1.5 ? 'sur 1 an' : `sur ${Math.round(years)} ans`;
}

/**
 * Les dates à écrire sous l'axe : toujours la première et la dernière, et
 * entre les deux des repères régulièrement espacés dans le TEMPS (pas dans la
 * liste), tant qu'ils ne se chevauchent pas. `slots` = combien d'étiquettes
 * tiennent sur la largeur. Rend des jours `AAAA-MM-JJ` avec leur place (0 à 1).
 */
export function axisTicks(days: string[], slots: number): { day: string; at: number }[] {
  if (days.length === 0) return [];
  const first = days[0];
  const last = days[days.length - 1];
  const span = daysBetween(first, last);
  if (span <= 0) return [{ day: first, at: 0 }];
  const ticks = [{ day: first, at: 0 }];
  const inner = Math.max(0, Math.min(3, slots - 2));
  for (let i = 1; i <= inner; i++) {
    const at = i / (inner + 1);
    const offset = Math.round(span * at);
    if (offset <= 0 || offset >= span) continue;
    const t = new Date(Date.parse(`${first}T00:00:00Z`) + offset * DAY_MS);
    ticks.push({ day: t.toISOString().slice(0, 10), at: offset / span });
  }
  ticks.push({ day: last, at: 1 });
  return ticks;
}
