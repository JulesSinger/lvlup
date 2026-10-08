import { useMemo, useState } from 'react';
import { MEAL_LABELS } from '../lib/calendarMarks';
import { fold } from '../lib/ingredients';
import { weekDays } from '../lib/menu';
import { MEALS, type Meal, type PlanEntryInput, type Recipe } from '../lib/types';
import { validatePlanEntry } from '../lib/validation';
import { weekdayLabel } from '../lib/format';
import { Modal } from './Modal';

/**
 * Poser un repas au menu (docs/etude-recettes.md §5, §17). Depuis une case
 * du menu : choisir une recette du carnet, ou écrire ce qu'on mange
 * (« Restes », « Resto »). Depuis une recette : choisir le jour et le repas.
 */
export function PlanPicker({ recipes, recipe, slot, today, servings, onAdd, onClose }: {
  recipes: Recipe[];
  /** Depuis la fiche : la recette est connue, on choisit le jour. */
  recipe?: Recipe;
  /** Depuis le menu : la case est connue, on choisit la recette. */
  slot?: { day: string; meal: Meal };
  today: string;
  servings: number | null;
  onAdd: (input: Omit<PlanEntryInput, 'position'>) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Recipe | null>(recipe ?? null);
  const [free, setFree] = useState('');
  const [day, setDay] = useState(slot?.day ?? today);
  const [meal, setMeal] = useState<Meal>(slot?.meal ?? 'soir');
  const [count, setCount] = useState<number | null>(servings ?? recipe?.servings ?? null);
  const [error, setError] = useState('');

  const found = useMemo(() => {
    const q = fold(query.trim());
    const list = q ? recipes.filter((r) => fold(r.title).includes(q)) : recipes;
    return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'fr')).slice(0, 30);
  }, [recipes, query]);

  async function add() {
    const input = { day, meal, recipeId: chosen?.id ?? null, title: chosen ? '' : free.trim(), servings: count };
    const problem = validatePlanEntry({ ...input, position: 0 });
    if (problem) return setError(problem);
    try {
      await onAdd(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  const days = weekDays(day);

  return (
    <Modal
      title={recipe ? `Au menu — ${recipe.title}` : `${MEAL_LABELS[meal]} du ${weekdayLabel(day)}`}
      onClose={onClose}
      footer={
        <>
          <span className="recettes-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void add()} disabled={!chosen && !free.trim()}>
            Ajouter au menu
          </button>
        </>
      }
    >
      {!slot && (
        <>
          <div className="field">
            <span className="recettes-label">Le jour</span>
            <div className="recettes-choice recettes-days" role="group" aria-label="Le jour">
              {days.map((d) => (
                <button key={d} type="button" className={`recettes-choice-item${d === day ? ' on' : ''}`} aria-pressed={d === day} onClick={() => setDay(d)}>
                  {weekdayLabel(d)}
                </button>
              ))}
            </div>
            <input type="date" aria-label="Un autre jour" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </div>
          <div className="field">
            <span className="recettes-label">Le repas</span>
            <div className="recettes-choice" role="group" aria-label="Le repas">
              {MEALS.map((m) => (
                <button key={m} type="button" className={`recettes-choice-item${m === meal ? ' on' : ''}`} aria-pressed={m === meal} onClick={() => setMeal(m)}>
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!recipe && (
        <>
          <div className="field">
            <label htmlFor="recettes-plan-search">Une recette du carnet</label>
            <input id="recettes-plan-search" type="search" value={query} placeholder="Chercher…" onChange={(e) => setQuery(e.target.value)} />
          </div>
          {recipes.length === 0 ? (
            <p className="recettes-hint">Ton carnet est vide : écris simplement ce que tu manges ci-dessous.</p>
          ) : (
            <ul className="recettes-plan-list" aria-label="Recettes">
              {found.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`recettes-plan-option${chosen?.id === r.id ? ' on' : ''}`}
                    aria-pressed={chosen?.id === r.id}
                    onClick={() => {
                      setChosen(chosen?.id === r.id ? null : r);
                      setFree('');
                      if (chosen?.id !== r.id) setCount(r.servings);
                    }}
                  >
                    {r.favorite ? '★ ' : ''}
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="field">
            <label htmlFor="recettes-plan-free">Ou simplement</label>
            <input
              id="recettes-plan-free"
              value={free}
              maxLength={120}
              placeholder="Restes, resto, pizza…"
              onChange={(e) => {
                setFree(e.target.value);
                if (e.target.value) setChosen(null);
              }}
            />
          </div>
        </>
      )}

      <div className="field">
        <span className="recettes-label">Pour</span>
        <div className="recettes-servings" role="group" aria-label="Nombre de personnes">
          <button type="button" className="btn btn-sm" aria-label="Une personne de moins" disabled={!count || count <= 1} onClick={() => setCount((c) => (c ? c - 1 : c))}>
            −
          </button>
          <span className="recettes-servings-value">{count ? `${count} personne${count > 1 ? 's' : ''}` : 'non précisé'}</span>
          <button type="button" className="btn btn-sm" aria-label="Une personne de plus" disabled={(count ?? 0) >= 100} onClick={() => setCount((c) => (c ?? 0) + 1)}>
            +
          </button>
        </div>
      </div>
      {error && (
        <p className="recettes-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
