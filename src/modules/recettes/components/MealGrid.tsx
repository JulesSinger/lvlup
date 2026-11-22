import { useState } from 'react';
import { MEAL_LABELS } from '../lib/calendarMarks';
import { formatMinutes, totalMinutes } from '../lib/duration';
import { MEALS, type Meal, type Recipe } from '../lib/types';
import { useSlotDrag } from './useSlotDrag';

/** Ce qu'une case montre d'un repas : celui du menu daté ou celui de la semaine type. */
export interface GridEntry {
  id: string;
  recipeId: string | null;
  title: string;
  servings: number | null;
  leftovers: boolean;
}

export interface GridRow {
  key: string;
  label: string;
  /** Une ligne mise en avant (aujourd'hui) ou atténuée (un jour passé). */
  tone?: 'today' | 'past';
  /** « du lun. 23 nov. », « du lundi » : pour dire de quelle case on parle. */
  of: string;
}

/** L'adresse d'une case, comme `data-meal-slot` la porte. */
export const slotId = (row: string, meal: Meal) => `${row}|${meal}`;
export function parseSlotId(id: string): { row: string; meal: Meal } {
  const at = id.lastIndexOf('|');
  return { row: id.slice(0, at), meal: id.slice(at + 1) as Meal };
}

/**
 * La grille des repas, jours en lignes, midi et soir en colonnes
 * (docs/etude-recettes.md §17, §22) — le menu d'une semaine et la semaine
 * type la partagent.
 *
 * Chaque repas dit s'il faut cuisiner (🍳, avec son temps et ses parts) ou
 * s'il suffit de sortir des restes (♻️) ; toucher le pictogramme bascule.
 * Deux façons d'échanger deux cases : glisser un repas sur une autre case
 * (tenir un instant au doigt), ou « ⇄ » puis toucher la case d'arrivée —
 * sans glisser, au clavier comme au doigt.
 */
export function MealGrid({ rows, entriesOf, recipes, label, removeSuffix = '', onAdd, onOpen, onRemove, onToggleLeftovers, onSwap }: {
  rows: GridRow[];
  entriesOf: (row: string, meal: Meal) => GridEntry[];
  recipes: Recipe[];
  label: string;
  /** « du menu » : la fin du nom du bouton ✕ (« Retirer Restes du menu »). */
  removeSuffix?: string;
  onAdd: (row: string, meal: Meal) => void;
  onOpen: (recipe: Recipe) => void;
  onRemove: (entry: GridEntry) => void;
  onToggleLeftovers: (entry: GridEntry) => void;
  onSwap: (from: { row: string; meal: Meal }, to: { row: string; meal: Meal }) => void;
}) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const nameOf = (e: GridEntry) => (e.recipeId ? (byId.get(e.recipeId)?.title ?? e.title) : e.title);
  /** La case choisie par « ⇄ », en attente de sa case d'arrivée. */
  const [moving, setMoving] = useState<string | null>(null);
  const { drag, start, justDragged } = useSlotDrag((from, to) => onSwap(parseSlotId(from), parseSlotId(to)));

  const rowOf = (key: string) => rows.find((r) => r.key === key);
  const describe = (id: string) => {
    const { row, meal } = parseSlotId(id);
    return `${MEAL_LABELS[meal].toLowerCase()} ${rowOf(row)?.of ?? ''}`.trim();
  };

  function swapTo(target: string) {
    if (!moving) return;
    const from = moving;
    setMoving(null);
    if (from !== target) onSwap(parseSlotId(from), parseSlotId(target));
  }

  return (
    <>
      {moving && (
        <div className="recettes-grid-moving" role="status">
          Touche la case où mettre le {describe(moving)} — elles s’échangent.
          <button type="button" className="btn btn-sm" onClick={() => setMoving(null)}>
            Annuler
          </button>
        </div>
      )}
      <div className={`recettes-menu-grid${drag ? ' dragging' : ''}`} role="table" aria-label={label}>
        {rows.map((row) => (
          <div key={row.key} className={`recettes-menu-day${row.tone ? ` ${row.tone}` : ''}`} role="row">
            <div className="recettes-menu-date" role="rowheader">
              {row.label}
            </div>
            {MEALS.map((meal) => {
              const id = slotId(row.key, meal);
              const entries = entriesOf(row.key, meal);
              const target = (moving !== null && moving !== id) || drag?.over === id;
              return (
                <div
                  key={meal}
                  className={`recettes-menu-slot${moving === id || drag?.from === id ? ' source' : ''}${target ? ' target' : ''}${drag?.over === id ? ' over' : ''}`}
                  role="cell"
                  data-meal-slot={id}
                  aria-label={`${MEAL_LABELS[meal]} ${row.of}`}
                >
                  <span className="recettes-menu-meal">{MEAL_LABELS[meal]}</span>
                  {entries.map((e) => {
                    const recipe = e.recipeId ? byId.get(e.recipeId) : undefined;
                    const name = nameOf(e);
                    const minutes = recipe && !e.leftovers ? totalMinutes(recipe) : null;
                    return (
                      <span
                        key={e.id}
                        className={`recettes-menu-entry${e.leftovers ? ' leftovers' : ' cook'}`}
                        onPointerDown={(ev) => {
                          // Les petits boutons de la pastille gardent leur geste.
                          if ((ev.target as HTMLElement).closest('.recettes-menu-kind, .recettes-menu-remove')) return;
                          start(ev, id, name);
                        }}
                      >
                        <button
                          type="button"
                          className="recettes-menu-kind"
                          aria-label={e.leftovers ? `${name} : des restes — passer à cuisiner` : `${name} : à cuisiner — passer en restes`}
                          title={e.leftovers ? 'Des restes : rien à cuisiner' : 'À cuisiner'}
                          onClick={() => onToggleLeftovers(e)}
                        >
                          {e.leftovers ? '♻️' : '🍳'}
                        </button>
                        {recipe ? (
                          <button
                            type="button"
                            className="recettes-menu-recipe"
                            onClick={() => {
                              if (!justDragged.current) onOpen(recipe);
                            }}
                          >
                            {name}
                          </button>
                        ) : (
                          <span className="recettes-menu-free">{name}</span>
                        )}
                        {!e.leftovers && (e.servings || minutes) && (
                          <span className="recettes-menu-servings">
                            {[e.servings ? `×${e.servings}` : null, minutes ? formatMinutes(minutes) : null].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <button type="button" className="recettes-menu-remove" aria-label={`Retirer ${name}${removeSuffix ? ` ${removeSuffix}` : ''}`} onClick={() => onRemove(e)}>
                          ✕
                        </button>
                      </span>
                    );
                  })}
                  <span className="recettes-menu-actions">
                    {moving !== null && moving !== id ? (
                      <button type="button" className="btn btn-sm recettes-menu-here" aria-label={`Échanger avec le ${MEAL_LABELS[meal].toLowerCase()} ${row.of}`} onClick={() => swapTo(id)}>
                        Ici
                      </button>
                    ) : (
                      <>
                        {entries.length > 0 && moving === null && (
                          <button type="button" className="recettes-menu-swap" aria-label={`Échanger le ${MEAL_LABELS[meal].toLowerCase()} ${row.of} avec un autre repas`} title="Échanger avec un autre repas" onClick={() => setMoving(id)}>
                            ⇄
                          </button>
                        )}
                        {moving === null && (
                          <button type="button" className="recettes-menu-add" aria-label={`Ajouter au ${MEAL_LABELS[meal].toLowerCase()} ${row.of}`} onClick={() => onAdd(row.key, meal)}>
                            +
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {drag && (
        <div className="recettes-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.label}
        </div>
      )}
    </>
  );
}
