/**
 * Dire une distance, une durée, une allure — en français, toujours de la même
 * façon dans tout le module.
 */

/** « 10,2 km » ; « 850 m » sous le kilomètre. */
export function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Un temps de course : « 47:12 », « 1:05:09 », « 3:28:40 ». */
export function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Une durée d'entraînement, arrondie à la minute : « 45 min », « 1 h 05 ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${two(minutes % 60)}`;
}

/** Une allure en secondes par kilomètre : « 5:30 /km ». */
export function formatPace(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${two(s % 60)} /km`;
}

/** Une fourchette d'allures : « 5:20–5:40 /km » (la plus rapide d'abord). */
export function formatPaceRange(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return formatPace(min);
  return `${formatPace(min).replace(' /km', '')}–${formatPace(max)}`;
}
