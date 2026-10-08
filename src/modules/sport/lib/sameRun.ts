/**
 * La même sortie venue par deux chemins (le raccourci, puis l'archive Strava ;
 * une saisie à la main, puis le raccourci) : départ à dix minutes près,
 * distance à 10 % près (docs/etude-sport.md §3.5).
 *
 * Le même critère vit dans la fonction `sport-import`
 * (`supabase/functions/sport-import/payload.ts`) ; un test compare les deux.
 */
export function sameRun(a: { startedAt: string; distanceM: number }, b: { startedAt: string; distanceM: number }): boolean {
  const gap = Math.abs(Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const longer = Math.max(a.distanceM, b.distanceM);
  return gap <= 10 * 60_000 && (longer === 0 || Math.abs(a.distanceM - b.distanceM) / longer <= 0.1);
}
