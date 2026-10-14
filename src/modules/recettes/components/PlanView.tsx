import type { CSSProperties } from 'react';
import { minutesLabel, startLabel, type Schedule, type Slot } from '../lib/schedule';
import { STATIONS } from '../lib/types';

/** La couleur d'un poste : une teinte de la palette par poste proposé, puis d'autres pour les postes ajoutés. */
const STATION_COLORS = ['--violet', '--sky', '--orange', '--red', '--teal', '--lime'];
const EXTRA_COLORS = ['--pink', '--yellow', '--indigo', '--green', '--coral', '--lavender'];
/** Une étape sans poste : sur sa propre ligne, grise. */
export const NO_STATION = 'Sans poste';

export function stationColor(station: string | null, extras: readonly string[]): string {
  if (!station) return 'var(--gray)';
  const i = (STATIONS as readonly string[]).indexOf(station);
  if (i >= 0) return `var(${STATION_COLORS[i]})`;
  const j = extras.indexOf(station);
  return `var(${EXTRA_COLORS[(j < 0 ? 0 : j) % EXTRA_COLORS.length]})`;
}

/** Les postes du plan, dans l'ordre où la recette les utilise. */
export function lanesOf(slots: readonly Slot[]): { name: string; station: string | null; slots: Slot[] }[] {
  const order: (string | null)[] = [];
  for (const s of slots) if (!order.includes(s.station)) order.push(s.station);
  return order.map((station) => ({ name: station ?? NO_STATION, station, slots: slots.filter((s) => s.station === station) }));
}

export const extraStations = (slots: readonly Slot[]) =>
  [...new Set(slots.map((s) => s.station).filter((x): x is string => !!x && !(STATIONS as readonly string[]).includes(x)))];

const tint = (color: string): CSSProperties => ({ ['--c' as string]: color });

/** L'heure d'une minute du plan : « 3 min », ou « 19:42 » quand on sait quand on lance. */
export function clockLabel(minute: number, launchAt: Date | null): string {
  if (!launchAt) return minutesLabel(Math.round(minute));
  const d = new Date(launchAt.getTime() + Math.round(minute) * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Le plan d'une recette minutée (docs/etude-recettes.md §20, maquette
 * `docs/maquette-recettes-timeline.html`) : sur ordinateur, une ligne par
 * poste sur un temps commun, la ligne « Tes mains », le chemin qui fixe la
 * durée en contour or ; sur téléphone, la même chose minute par minute. Les
 * deux sont rendus, le CSS choisit selon la largeur.
 */
export function PlanView({ plan, launchAt = null }: { plan: Schedule; launchAt?: Date | null }) {
  const extras = extraStations(plan.slots);
  const lanes = lanesOf(plan.slots);
  const total = Math.max(plan.total, 1);
  const pct = (m: number) => `${(m / total) * 100}%`;
  const ticks = tickMinutes(total);
  const handsMinutes = busyMinutes(plan.slots);
  const byStart = new Map<number, Slot[]>();
  for (const s of [...plan.slots].sort((a, b) => a.start - b.start || a.index - b.index)) {
    const key = Math.round(s.start * 2) / 2;
    byStart.set(key, [...(byStart.get(key) ?? []), s]);
  }

  return (
    <div className="recettes-plan">
      <p className="recettes-plan-meta">
        {minutesLabel(Math.ceil(plan.total))} en tout · {lanes.length} poste{lanes.length > 1 ? 's' : ''} · {minutesLabel(Math.round(handsMinutes))} les mains
        occupées
      </p>

      <div className="recettes-gantt" role="img" aria-label={`Le plan : ${plan.slots.length} étapes sur ${minutesLabel(Math.ceil(plan.total))}`}>
        <div className="recettes-gantt-row recettes-gantt-axis">
          <span />
          <div className="recettes-gantt-track">
            {ticks.map((m) => (
              <span key={m} className="recettes-gantt-tick" style={{ left: pct(m) }}>
                {clockLabel(m, launchAt)}
              </span>
            ))}
          </div>
        </div>
        {lanes.map((lane) => (
          <div key={lane.name} className="recettes-gantt-row" style={tint(stationColor(lane.station, extras))}>
            <span className="recettes-gantt-lane">
              <i aria-hidden="true" />
              {lane.name}
            </span>
            <div className="recettes-gantt-track">
              {lane.slots.map((s) => (
                <div
                  key={s.key}
                  className={`recettes-gantt-block ${s.hands ? 'hands' : 'alone'}${s.critical ? ' critical' : ''}`}
                  style={{ left: pct(s.start), width: pct(s.end - s.start) }}
                  title={`${s.index + 1}. ${s.text} — ${clockLabel(s.start, launchAt)} → ${clockLabel(s.end, launchAt)}, ${startLabel(s, plan.slots)}`}
                >
                  <b>
                    {s.index + 1}. {s.text}
                  </b>
                  <em>
                    {clockLabel(s.start, launchAt)}–{clockLabel(s.end, launchAt)}
                  </em>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="recettes-gantt-row recettes-gantt-hands">
          <span className="recettes-gantt-lane">✋ Tes mains</span>
          <div className="recettes-gantt-track">
            <span className="recettes-gantt-free" />
            {plan.slots
              .filter((s) => s.hands)
              .map((s) => (
                <span key={s.key} className="recettes-gantt-busy" style={{ left: pct(s.start), width: pct(s.end - s.start) }} />
              ))}
          </div>
        </div>
      </div>

      <ol className="recettes-plan-list" aria-label="Le plan, minute par minute">
        {[...byStart.entries()].map(([minute, slots]) => (
          <li key={minute}>
            <span className="recettes-plan-time">{clockLabel(minute, launchAt)}</span>
            <div>
              {slots.map((s) => (
                <p key={s.key} className="recettes-plan-act" style={tint(stationColor(s.station, extras))}>
                  <i aria-hidden="true" />
                  <span>
                    {s.text}
                    <span className="recettes-plan-tag">
                      {s.hands ? '✋' : '🔥'} {minutesLabel(s.minutes)}
                    </span>
                    <small>
                      {s.station ?? NO_STATION}
                      {s.after && s.after.kind === 'end' && s.after.key !== plan.slots[s.index - 1]?.key ? ` · ${startLabel(s, plan.slots)}` : ''}
                    </small>
                  </span>
                </p>
              ))}
            </div>
          </li>
        ))}
        <li>
          <span className="recettes-plan-time">{clockLabel(plan.total, launchAt)}</span>
          <div>
            <p className="recettes-plan-act recettes-plan-end">
              <b>À table</b>
            </p>
          </div>
        </li>
      </ol>

      <p className="recettes-plan-legend">
        <span>
          <i className="hands" /> tu es dessus
        </span>
        <span>
          <i className="alone" /> ça cuit tout seul
        </span>
        <span>
          <i className="critical" /> fixe la durée totale
        </span>
      </p>
    </div>
  );
}

/** Des repères lisibles : toutes les 1, 2, 5, 10, 15 ou 30 minutes selon la durée, la fin comprise. */
function tickMinutes(total: number): number[] {
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => total / s <= 8) ?? 120;
  const out: number[] = [];
  for (let m = 0; m < total - step / 2; m += step) out.push(m);
  out.push(Math.ceil(total));
  return out;
}

/** Les minutes où les mains sont prises, chevauchements comptés une fois. */
function busyMinutes(slots: readonly Slot[]): number {
  const spans = slots.filter((s) => s.hands).map((s) => [s.start, s.end]).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [a, b] of spans) {
    const from = Math.max(a, cursor);
    if (b > from) total += b - from;
    cursor = Math.max(cursor, b);
  }
  return total;
}
