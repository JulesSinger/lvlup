/**
 * Les durées d'une recette — bibliothèque pure (docs/etude-recettes.md §4.1).
 * Les sites les écrivent en ISO 8601 (« PT1H35M ») ; Atlas les range en
 * minutes et les dit « 1 h 35 ».
 */

/** « PT1H35M » → 95 ; « P1DT2H » → 1560 ; illisible → null. */
export function parseIsoDuration(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const m = /^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i.exec(text.trim());
  if (!m || text.trim().toUpperCase() === 'P' || text.trim().toUpperCase() === 'PT') return null;
  const n = (v: string | undefined) => (v ? Number(v.replace(',', '.')) : 0);
  const minutes = n(m[1]) * 1440 + n(m[2]) * 60 + n(m[3]) + n(m[4]) / 60;
  return Number.isFinite(minutes) ? Math.round(minutes) : null;
}

/** 95 → « 1 h 35 » ; 45 → « 45 min » ; 1440 → « 24 h » ; 3000 → « 2 j 2 h ». */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 2880) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${String(rest).padStart(2, '0')}` : `${h} h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.round((m % 1440) / 60);
  return h ? `${d} j ${h} h` : `${d} j`;
}

/** Le temps total d'une recette : préparation, cuisson et repos ; null si rien n'est dit. */
export function totalMinutes(r: { prepMinutes: number | null; cookMinutes: number | null; restMinutes: number | null }): number | null {
  const parts = [r.prepMinutes, r.cookMinutes, r.restMinutes].filter((v): v is number => v !== null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}
