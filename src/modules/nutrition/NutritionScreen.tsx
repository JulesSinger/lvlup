import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import { AddFoodDialog } from './components/AddFoodDialog';
import { DaySummary } from './components/DaySummary';
import { EntryEditor } from './components/EntryEditor';
import { TargetEditor } from './components/TargetEditor';
import { nutritionStore } from './data';
import { CIQUAL_CREDIT } from './lib/ciqual';
import { dayLabel, dayString, shiftDay } from './lib/day';
import { copyMeal, groupByMeal, rescaleEntry, targetForDay, totalOf } from './lib/journal';
import { MEALS, MEAL_LABELS, type Entry, type Meal, type Target, type TargetInput } from './lib/types';

/**
 * Écran racine de Cérès — le journal du jour, étape 3
 * (docs/etude-nutrition.md §5, §10) : la V1 ; l'objectif quotidien, étape 4.
 *
 * Un jour à la fois, découpé en quatre repas, avec son total en tête. Les
 * deux raccourcis qui font tenir une saisie quotidienne (étude §3) sont là
 * dès la V1 : les aliments récents dans la fenêtre d'ajout, et la copie d'un
 * repas de la veille.
 */
export function NutritionScreen({ error, onError, onOpenSettings, onBackToHub, reloadToken }: ModuleScreenProps) {
  const today = dayString();
  const [day, setDay] = useState(today);
  /** Le jour affiché et la veille : la veille sert à « Copier la veille ». */
  const [entries, setEntries] = useState<Entry[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [copying, setCopying] = useState<Meal | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextEntries, nextTargets] = await Promise.all([
        nutritionStore.listEntries(shiftDay(day, -1), day),
        nutritionStore.listTargets(),
      ]);
      setEntries(nextEntries);
      setTargets(nextTargets);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
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

  const previousDay = shiftDay(day, -1);
  const dayEntries = useMemo(() => entries.filter((e) => e.day === day), [entries, day]);
  const previousEntries = useMemo(() => entries.filter((e) => e.day === previousDay), [entries, previousDay]);
  const byMeal = useMemo(() => groupByMeal(dayEntries), [dayEntries]);
  const previousByMeal = useMemo(() => groupByMeal(previousEntries), [previousEntries]);
  const total = useMemo(() => totalOf(dayEntries), [dayEntries]);
  const target = useMemo(() => targetForDay(targets, day), [targets, day]);

  async function copyFromPreviousDay(meal: Meal) {
    setCopying(meal);
    try {
      // Une à une, dans l'ordre : si le réseau lâche au milieu, ce qui est
      // déjà copié reste, et l'erreur dit que la suite manque.
      for (const input of copyMeal(previousEntries, meal, day)) {
        await nutritionStore.createEntry(input);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Copie impossible.');
    } finally {
      setCopying(null);
      await refresh();
    }
  }

  async function saveGrams(entry: Entry, grams: number) {
    await nutritionStore.updateEntry(entry.id, rescaleEntry(entry, grams));
    setEditing(null);
    await refresh();
  }

  async function removeEntry(entry: Entry) {
    await nutritionStore.deleteEntry(entry.id);
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
          <div className="brand">
            <span className="brand-mark">🌾</span>
            <span className="brand-name">Cérès</span>
          </div>
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm nutrition-topbar-btn"
              onClick={onBackToHub}
              title="Modules"
              aria-label="Modules"
            >
              <span aria-hidden="true">←</span>
              <span className="nutrition-topbar-label">Modules</span>
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

        <div className="nutrition-day-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDay((d) => shiftDay(d, -1))}
            aria-label="Jour précédent"
          >
            ←
          </button>
          <span className="nutrition-day-label">{dayLabel(day, today)}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDay((d) => shiftDay(d, 1))}
            aria-label="Jour suivant"
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
                              className="nutrition-entry"
                              onClick={() => setEditing(entry)}
                              title="Modifier la quantité"
                            >
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
