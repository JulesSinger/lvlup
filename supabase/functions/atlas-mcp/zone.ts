/**
 * Lire une heure dans un fuseau — le serveur tourne en UTC, l'app sur
 * l'appareil de Jules. Les rappels de Calendar et de Tâches, recalculés par
 * le connecteur après une écriture, doivent tomber au même instant que ceux
 * que l'écran calcule avec `new Date(y, m, d, h, min)` (comparé par les
 * tests des deux modules).
 */

/** L'écart (minutes) entre l'heure d'un fuseau et l'UTC, à un instant donné. */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((local - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** L'instant d'une heure locale d'un jour, dans un fuseau : ce que `new Date(y, m, d, h, min)` fait sur l'appareil. */
export function zonedInstant(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = zoneOffset(guess, timeZone);
  let t = guess - first * 60_000;
  const second = zoneOffset(t, timeZone);
  if (second !== first) t = guess - second * 60_000;
  return new Date(t);
}

/** Le jour d'un instant dans un fuseau. */
export function zonedDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
