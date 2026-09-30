import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isNetworkError } from '../../core/data/outbox';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { AddFoodDialog } from './components/AddFoodDialog';
import { DaySummary } from './components/DaySummary';
import { EntryEditor } from './components/EntryEditor';
import { WeekView } from './components/WeekView';
import { MyFoodsDialog } from './components/MyFoodsDialog';
import { TargetEditor } from './components/TargetEditor';
import { nutritionStore } from './data';
import { applyPendingEntries, pendingEntryIds } from './data/entryOutbox';
import { journalWriter } from './data/journalWriter';
import { CIQUAL_CREDIT } from './lib/ciqual';
import { dayLabel, dayString, rangeLabel, shiftDay } from './lib/day';
import { copyMeal, groupByMeal, rescaleEntry, targetForDay, totalOf } from './lib/journal';
import { weekSummary } from './lib/week';
import { MEALS, MEAL_LABELS, type Entry, type Meal, type Target, type TargetInput } from './lib/types';

/**
 * Écran racine de Cérès — le journal du jour, étape 3
 * (docs/etude-nutrition.md §5, §10) : la V1 ; l'objectif quotidien, étape 4 ;
 * « Mes aliments » et les favoris, étape 5 ; la file hors ligne et la vue
 * « Semaine », étape 7.
 *
 * Un jour à la fois, découpé en quatre repas, avec son total en tête. Les
 * deux raccourcis qui font tenir une saisie quotidienne (étude §3) sont là
 * dès la V1 : les aliments récents dans la fenêtre d'ajout, et la copie d'un
 * repas de la veille.
 */
export function NutritionScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, label, emoji }: ModuleScreenProps) {
  const today = dayString();
  const [day, setDay] = useState(today);
  /** Un jour, ou les sept jours qui finissent par `day` (étape 7). */
  const [view, setView] = useState<'day' | 'week'>('day');
  /**
   * Les sept jours qui finissent par le jour affiché : la veille sert à
   * « Copier la veille », les sept à la vue « Semaine ».
   */
  const [entries, setEntries] = useState<Entry[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [copying, setCopying] = useState<Meal | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [showFoods, setShowFoods] = useState(false);
  /**
   * Les dernières entrées reçues du serveur. La file hors ligne est
   * réappliquée par-dessus à chaque relecture — y compris quand celle-ci
   * échoue faute de réseau, pour qu'un ajout hors ligne s'affiche quand même.
   */
  const serverEntries = useRef<Entry[]>([]);
  /** Les entrées qui attendent le réseau (étape 7). */
  const [pendingIds, setPendingIds] = useState(() => pendingEntryIds(journalWriter.pending()));

  const refresh = useCallback(async () => {
    try {
      const [nextEntries, nextTargets] = await Promise.all([
        nutritionStore.listEntries(shiftDay(day, -6), day),
        nutritionStore.listTargets(),
      ]);
      // La file par-dessus le serveur : un rafraîchissement n'efface jamais
      // ce qui n'est pas encore parti.
      serverEntries.current = nextEntries;
      setEntries(applyPendingEntries(nextEntries, journalWriter.pending()));
      setTargets(nextTargets);
      onError('');
    } catch (err) {
      if (isNetworkError(err)) {
        setEntries(applyPendingEntries(serverEntries.current, journalWriter.pending()));
        onError('Hors ligne : le journal montre les dernières données connues, les nouvelles saisies partiront au retour du réseau.');
      } else {
        onError(err instanceof Error ? err.message : 'Chargement impossible.');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Au montage, à chaque changement de jour, et après une restauration de
  // sauvegarde (reloadToken) : le hub ne sait pas relire les données d'un
  // module, c'est à lui de le faire.
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  // --- File hors ligne (étape 7) ------------------------------------------
  /** Envoie ce qui attend, puis relit : même motif que Zénith. */
  const sync = useCallback(async () => {
    const result = await journalWriter.flush();
    if (result.dropped.length > 0) onError(result.dropped[0]);
    if (result.sent > 0 || result.dropped.length > 0) await refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Au démarrage (une saisie peut attendre depuis la dernière session), au
  // retour du réseau, et au retour sur l'application.
  useEffect(() => {
    void sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [sync]);

  // Seuls les repères « en attente » suivent la file en direct. Les entrées,
  // elles, se recalculent à chaque relecture (après chaque écriture, et
  // après un envoi) : les recalculer ici ferait disparaître un instant une
  // entrée tout juste envoyée, avant que la relecture la ramène du serveur.
  useEffect(() => journalWriter.onPendingChange((ops) => setPendingIds(pendingEntryIds(ops))), []);

  const previousDay = shiftDay(day, -1);
  const dayEntries = useMemo(() => entries.filter((e) => e.day === day), [entries, day]);
  const previousEntries = useMemo(() => entries.filter((e) => e.day === previousDay), [entries, previousDay]);
  const byMeal = useMemo(() => groupByMeal(dayEntries), [dayEntries]);
  const previousByMeal = useMemo(() => groupByMeal(previousEntries), [previousEntries]);
  const total = useMemo(() => totalOf(dayEntries), [dayEntries]);
  const target = useMemo(() => targetForDay(targets, day), [targets, day]);
  const week = useMemo(() => weekSummary(entries, targets, day), [entries, targets, day]);
  const step = view === 'week' ? 7 : 1;

  async function copyFromPreviousDay(meal: Meal) {
    setCopying(meal);
    try {
      // Une à une, dans l'ordre : si le réseau lâche au milieu, ce qui est
      // déjà copié reste, et l'erreur dit que la suite manque.
      for (const input of copyMeal(previousEntries, meal, day)) {
        await journalWriter.add(input);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Copie impossible.');
    } finally {
      setCopying(null);
      await refresh();
    }
  }

  async function saveGrams(entry: Entry, grams: number) {
    await journalWriter.update(entry.id, rescaleEntry(entry, grams));
    setEditing(null);
    await refresh();
  }

  async function removeEntry(entry: Entry) {
    await journalWriter.remove(entry.id);
    setEditing(null);
    await refresh();
  }

  async function saveTarget(input: TargetInput) {
    await nutritionStore.setTarget(input);
    setEditingTarget(false);
    await refresh();
  }

  async function removeTarget(t: Target) {
    await nutritionStore.deleteTarget(t.id);
    await refresh();
  }

  const copyLabel = day === today ? 'Copier d’hier' : 'Copier la veille';

  return (
    <div className="layout">
      <main className="main nutrition-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm nutrition-topbar-btn"
              onClick={() => setShowFoods(true)}
              title="Mes aliments"
              aria-label="Mes aliments"
            >
              <span aria-hidden="true">🥫</span>
              <span className="nutrition-topbar-label">Mes aliments</span>
            </button>
            <button
              className="btn btn-ghost btn-sm nutrition-topbar-btn"
              onClick={onOpenSettings}
              title="Réglages"
              aria-label="Réglages"
            >
              <span aria-hidden="true">⚙</span>
              <span className="nutrition-topbar-label">Réglages</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        {pendingIds.size > 0 && (
          <div className="notice info nutrition-pending-notice" role="status">
            {pendingIds.size} saisie{pendingIds.size > 1 ? 's' : ''} en attente d’envoi : elle
            {pendingIds.size > 1 ? 's partiront' : ' partira'} dès le retour du réseau.
          </div>
        )}

        <div className="nutrition-view-tabs" role="tablist" aria-label="Affichage">
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`nutrition-view-tab${view === v ? ' on' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'day' ? 'Jour' : 'Semaine'}
            </button>
          ))}
        </div>

        <div className="nutrition-day-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDay((d) => shiftDay(d, -step))}
            aria-label={view === 'week' ? 'Semaine précédente' : 'Jour précédent'}
          >
            ←
          </button>
          <span className="nutrition-day-label">
            {view === 'week' ? rangeLabel(shiftDay(day, -6), day) : dayLabel(day, today)}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDay((d) => shiftDay(d, step))}
            aria-label={view === 'week' ? 'Semaine suivante' : 'Jour suivant'}
          >
            →
          </button>
          {day !== today && (
            <button type="button" className="btn btn-sm nutrition-day-today" onClick={() => setDay(today)}>
              Aujourd’hui
            </button>
          )}
        </div>

        {loading ? (
          <p>Chargement…</p>
        ) : view === 'week' ? (
          <WeekView
            summary={week}
            today={today}
            onOpenDay={(d) => {
              setDay(d);
              setView('day');
            }}
          />
        ) : (
          <>
            <DaySummary total={total} target={target} onEditTarget={() => setEditingTarget(true)} />

            <div className="nutrition-meals">
              {MEALS.map((meal) => {
                const mealEntries = byMeal[meal];
                const mealKcal = totalOf(mealEntries).kcal;
                const canCopy = previousByMeal[meal].length > 0;
                return (
                  <section key={meal} className="nutrition-meal" aria-label={MEAL_LABELS[meal]}>
                    <header className="nutrition-meal-head">
                      <h2 className="nutrition-meal-title">{MEAL_LABELS[meal]}</h2>
                      {mealKcal > 0 && <span className="nutrition-meal-kcal">{mealKcal} kcal</span>}
                    </header>

                    {mealEntries.length > 0 && (
                      <ul className="nutrition-entries">
                        {mealEntries.map((entry) => (
                          <li key={entry.id}>
                            <button
                              type="button"
                              className={`nutrition-entry${pendingIds.has(entry.id) ? ' pending' : ''}`}
                              onClick={() => setEditing(entry)}
                              title={pendingIds.has(entry.id) ? 'En attente d’envoi — modifier la quantité' : 'Modifier la quantité'}
                            >
                              {pendingIds.has(entry.id) && (
                                <span className="nutrition-entry-pending" aria-label="En attente d’envoi">
                                  ⏳
                                </span>
                              )}
                              <span className="nutrition-entry-label">{entry.label}</span>
                              <span className="nutrition-entry-grams">{entry.grams} g</span>
                              <span className="nutrition-entry-kcal">{entry.kcal} kcal</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="nutrition-meal-actions">
                      <button type="button" className="btn btn-sm" onClick={() => setAdding(meal)}>
                        + Ajouter
                      </button>
                      {canCopy && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void copyFromPreviousDay(meal)}
                          disabled={copying !== null}
                          title={previousByMeal[meal].map((e) => e.label).join(', ')}
                        >
                          {copying === meal ? 'Copie…' : `${copyLabel} (${previousByMeal[meal].length})`}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="nutrition-credit">
              Aliments : {CIQUAL_CREDIT}. Des estimations, pas un avis médical.
            </p>
          </>
        )}

        {adding !== null && (
          <AddFoodDialog
            day={day}
            today={today}
            meal={adding}
            onCancel={() => setAdding(null)}
            onAdded={async () => {
              setAdding(null);
              await refresh();
            }}
          />
        )}

        {showFoods && <MyFoodsDialog onClose={() => setShowFoods(false)} />}

        {editingTarget && (
          <TargetEditor
            today={today}
            current={targetForDay(targets, today)}
            targets={targets}
            onCancel={() => setEditingTarget(false)}
            onSave={saveTarget}
            onDelete={removeTarget}
          />
        )}

        {editing !== null && (
          <EntryEditor
            entry={editing}
            onCancel={() => setEditing(null)}
            onSave={(grams) => saveGrams(editing, grams)}
            onDelete={() => removeEntry(editing)}
          />
        )}
      </main>
    </div>
  );
}
