import { useEffect, useMemo, useRef, useState } from 'react';
import { stepIngredients } from '../lib/cooking';
import { isSectionHeading, scaleIngredient } from '../lib/ingredients';
import { minutesLabel, schedule, stepKey, withIds, type Live, type Slot } from '../lib/schedule';
import { formatClock } from '../lib/timers';
import type { Recipe } from '../lib/types';
import { beep, useWakeLock } from './kitchen';
import { clockLabel, extraStations, PlanView, stationColor } from './PlanView';

/**
 * La cuisine en cours, gardée sur l'appareil : un rechargement (ou le
 * téléphone qui recharge l'app) au milieu des pâtes reprend où l'on en était.
 * Rien de grave si elle se perd : on relance. Voir CLAUDE.md §4.
 */
const STORAGE_KEY = 'recettes.kitchen.v1';
/** Au-delà, une cuisine oubliée n'est plus reprise. */
const STALE_MS = 12 * 3600_000;
/** L'annonce d'une étape, avant son heure. */
const HEADS_UP_MIN = 20 / 60;

interface Saved {
  recipeId: string;
  launchedAt: number;
  started: Record<string, number>;
  done: Record<string, number>;
}

function readSaved(recipeId: string): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
    if (!raw || raw.recipeId !== recipeId || Date.now() - raw.launchedAt > STALE_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Navigation privée : la cuisine tient tant que l'écran reste ouvert.
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * « En cuisine » (docs/etude-recettes.md §20) — le mode par défaut d'une
 * recette minutée. Avant de lancer : le plan. Après : ce qu'il faut faire
 * maintenant (annoncé 20 s avant, avec un bip), ce qui tourne (une barre par
 * étape qui cuit toute seule), et ce qui vient ensuite. Le plan suit ce qui
 * se passe vraiment : une étape commencée en retard décale ce qui en dépend,
 * et l'heure du repas avec.
 */
export function KitchenMode({ recipe, factor, servings, onClose, onStepByStep }: {
  recipe: Recipe;
  factor: number;
  servings: number | null;
  onClose: () => void;
  onStepByStep: () => void;
}) {
  const steps = useMemo(() => withIds(recipe.steps), [recipe.steps]);
  const ingredients = recipe.ingredients.filter((i) => !isSectionHeading(i.text));
  const [saved, setSaved] = useState<Saved | null>(() => readSaved(recipe.id));
  const [now, setNow] = useState(() => Date.now());
  const wake = useWakeLock();
  const rang = useRef(new Set<string>());

  const keys = steps.map(stepKey);
  // Les identifiants viennent de la recette quand elle en a ; sinon `withIds` en tire de nouveaux à chaque ouverture,
  // et une cuisine gardée ne les retrouverait pas : on ne la reprend alors pas.
  const resumable = saved && Object.keys({ ...saved.started, ...saved.done }).every((k) => keys.includes(k));
  const launched = saved && resumable ? saved : null;
  const nowMin = launched ? (now - launched.launchedAt) / 60_000 : 0;
  const live: Live | undefined = launched ? { now: nowMin, started: launched.started, done: launched.done } : undefined;
  const plan = useMemo(() => schedule(steps, live), [steps, live?.now, launched]); // eslint-disable-line react-hooks/exhaustive-deps
  const extras = extraStations(plan.slots);

  useEffect(() => {
    if (!launched) return;
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, [launched]);

  // Les bips : l'annonce 20 s avant une étape, son heure, et la fin de ce qui cuit tout seul — une fois chacun.
  useEffect(() => {
    if (!launched) return;
    for (const s of plan.slots) {
      const ring = (what: string, count: number) => {
        const id = `${s.key}:${what}`;
        if (rang.current.has(id)) return;
        rang.current.add(id);
        beep(count);
      };
      if (s.state === 'pending' && s.start - nowMin <= HEADS_UP_MIN && s.start > nowMin) ring('soon', 1);
      if (s.state === 'pending' && s.start <= nowMin) ring('due', 3);
      if (!s.hands && s.state === 'done' && launched.done[s.key] === undefined) ring('end', 3);
    }
  }, [plan, nowMin, launched]);

  function update(change: (s: Saved) => Saved) {
    setSaved((current) => {
      if (!current) return current;
      const next = change(current);
      writeSaved(next);
      return next;
    });
  }

  function launch() {
    const t = Date.now();
    const first = schedule(steps);
    const started: Record<string, number> = {};
    for (const s of first.slots) if (s.start === 0) started[s.key] = 0;
    const next = { recipeId: recipe.id, launchedAt: t, started, done: {} };
    rang.current.clear();
    writeSaved(next);
    setSaved(next);
    setNow(t);
  }

  const minuteNow = () => (Date.now() - (launched?.launchedAt ?? Date.now())) / 60_000;
  const begin = (s: Slot) => update((c) => ({ ...c, started: { ...c.started, [s.key]: minuteNow() } }));
  const finish = (s: Slot) => update((c) => ({ ...c, started: { ...c.started, [s.key]: c.started[s.key] ?? minuteNow() }, done: { ...c.done, [s.key]: minuteNow() } }));

  function quit() {
    if (launched && plan.slots.some((s) => s.state !== 'done') && !window.confirm('Quitter ? La cuisine en cours sera oubliée.')) return;
    writeSaved(null);
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && quit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const due = plan.slots.filter((s) => s.state === 'pending' && s.start <= nowMin + 1e-6);
  const working = plan.slots.filter((s) => s.state === 'running' && s.hands);
  const cooking = plan.slots.filter((s) => s.state === 'running' && !s.hands);
  const upcoming = plan.slots.filter((s) => s.state === 'pending' && s.start > nowMin + 1e-6).sort((a, b) => a.start - b.start);
  const next = upcoming[0];
  const finished = launched && plan.slots.every((s) => s.state === 'done');
  const launchAt = launched ? new Date(launched.launchedAt) : null;
  const tableAt = new Date((launched?.launchedAt ?? now) + Math.ceil(plan.total) * 60_000);
  const usedOf = (s: Slot) => stepIngredients(s.text, ingredients);

  const card = (s: Slot, kind: 'due' | 'working' | 'soon') => (
    <section key={s.key} className={`recettes-kitchen-now recettes-kitchen-${kind}`} style={{ ['--c' as string]: stationColor(s.station, extras) }}>
      <p className="recettes-kitchen-label">
        {kind === 'due' ? 'Maintenant' : kind === 'working' ? 'En cours' : `Dans ${formatClock((s.start - nowMin) * 60)}`}
        {s.station && <span> · {s.station}</span>}
      </p>
      <p className="recettes-kitchen-what">
        {s.index + 1}. {s.text}
      </p>
      <p className="recettes-kitchen-meta">
        {s.hands ? '✋ tu es dessus' : '🔥 ça cuit tout seul'} · {minutesLabel(s.minutes)}
      </p>
      {kind !== 'soon' && usedOf(s).length > 0 && (
        <ul className="recettes-cook-used" aria-label="Ingrédients de cette étape">
          {usedOf(s).map((u, i) => (
            <li key={i}>{scaleIngredient(u.text, factor)}</li>
          ))}
        </ul>
      )}
      <div className="recettes-kitchen-actions">
        {kind === 'working' ? (
          <button type="button" className="btn btn-primary" onClick={() => finish(s)}>
            ✓ Fini
          </button>
        ) : (
          <button type="button" className={`btn${kind === 'due' ? ' btn-primary' : ''}`} onClick={() => begin(s)}>
            {kind === 'due' ? 'C’est parti' : 'Commencer maintenant'}
          </button>
        )}
      </div>
    </section>
  );

  return (
    <div className="recettes-cook recettes-kitchen" role="dialog" aria-modal="true" aria-label={`En cuisine — ${recipe.title}`}>
      <header className="recettes-cook-head">
        <div className="recettes-cook-title">
          <span className="recettes-cook-name">{recipe.title}</span>
          <span className="recettes-cook-sub">
            {servings ? `Pour ${servings} ${recipe.yieldLabel} · ` : ''}
            {wake === 'on' ? '🔆 L’écran reste allumé' : 'L’écran peut se mettre en veille'}
          </span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onStepByStep}>
          Étape par étape
        </button>
        <button type="button" className="btn btn-sm" onClick={quit} aria-label="Quitter la cuisine">
          ✕
        </button>
      </header>

      <main className="recettes-cook-body recettes-kitchen-body">
        {!launched ? (
          <>
            <div className="recettes-kitchen-clock">
              <span className="recettes-kitchen-big">{minutesLabel(Math.ceil(plan.total))}</span>
              <span className="recettes-hint">Lancé maintenant, à table vers {hhmm(tableAt)}</span>
            </div>
            <button type="button" className="btn btn-primary recettes-kitchen-launch" onClick={launch}>
              ▶ Lancer
            </button>
            <PlanView plan={plan} />
          </>
        ) : finished ? (
          <div className="recettes-kitchen-clock">
            <span className="recettes-kitchen-big">À table !</span>
            <span className="recettes-hint">Tout est prêt, en {minutesLabel(Math.round(nowMin))}.</span>
            <button type="button" className="btn btn-primary" onClick={quit}>
              Terminer
            </button>
          </div>
        ) : (
          <>
            <div className="recettes-kitchen-clock" aria-live="off">
              <span className="recettes-kitchen-big">{formatClock(nowMin * 60)}</span>
              <span className="recettes-hint">
                sur {minutesLabel(Math.ceil(plan.total))} · à table vers {hhmm(tableAt)}
              </span>
            </div>

            {due.map((s) => card(s, 'due'))}
            {working.map((s) => card(s, 'working'))}
            {due.length === 0 && working.length === 0 && next && card(next, 'soon')}
            {due.length === 0 && working.length === 0 && !next && <p className="recettes-hint">Rien à faire de tes mains : ça cuit.</p>}

            {cooking.length > 0 && (
              <ul className="recettes-kitchen-running" aria-label="Ce qui cuit">
                {cooking.map((s) => {
                  const left = Math.max(0, s.end - nowMin);
                  return (
                    <li key={s.key} style={{ ['--c' as string]: stationColor(s.station, extras) }}>
                      <span className="recettes-kitchen-station">
                        <i aria-hidden="true" />
                        {s.station ?? 'Sans poste'}
                      </span>
                      <span className="recettes-kitchen-run-top">
                        <b>{s.text}</b>
                        <span className="recettes-kitchen-left">{formatClock(left * 60)}</span>
                      </span>
                      <span className="recettes-kitchen-bar">
                        <span style={{ width: `${Math.min(100, ((nowMin - s.start) / Math.max(s.end - s.start, 0.01)) * 100)}%` }} />
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => finish(s)}>
                        Fini plus tôt
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {upcoming.length > (due.length === 0 && working.length === 0 ? 1 : 0) && (
              <section aria-label="Ensuite">
                <p className="recettes-kitchen-label">Ensuite</p>
                <ul className="recettes-kitchen-next">
                  {upcoming.slice(due.length === 0 && working.length === 0 ? 1 : 0).map((s) => (
                    <li key={s.key}>
                      <span>{clockLabel(s.start, launchAt)}</span>
                      <span>
                        {s.index + 1}. {s.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
