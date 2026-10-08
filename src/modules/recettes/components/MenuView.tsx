import { MEAL_LABELS } from '../lib/calendarMarks';
import { capitalized, weekdayLabel } from '../lib/format';
import { slot, weekDays } from '../lib/menu';
import { MEALS, type Meal, type PlanEntry, type Recipe } from '../lib/types';

/**
 * Le menu de la semaine (docs/etude-recettes.md §5, §17) : sept jours, midi
 * et soir. Une case peut porter une recette du carnet (on l'ouvre d'un geste),
 * un simple titre (« Restes »), ou plusieurs choses (un plat, un dessert).
 */
export function MenuView({ day, today, entries, recipes, onWeek, onToday, onAdd, onOpen, onRemove, toolbar }: {
  /** Un jour de la semaine affichée. */
  day: string;
  today: string;
  entries: PlanEntry[];
  recipes: Recipe[];
  onWeek: (delta: number) => void;
  onToday: () => void;
  onAdd: (day: string, meal: Meal) => void;
  onOpen: (recipe: Recipe) => void;
  onRemove: (entry: PlanEntry) => void;
  /** Les gestes de la semaine (les courses, étape 6). */
  toolbar?: React.ReactNode;
}) {
  const days = weekDays(day);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const thisWeek = days.includes(today);

  return (
    <div className="recettes-menu">
      <div className="recettes-menu-head">
        <button type="button" className="btn btn-sm" aria-label="Semaine précédente" onClick={() => onWeek(-1)}>
          ‹
        </button>
        <span className="recettes-menu-title">
          {thisWeek ? 'Cette semaine' : `Semaine du ${weekdayLabel(days[0])}`}
        </span>
        <button type="button" className="btn btn-sm" aria-label="Semaine suivante" onClick={() => onWeek(1)}>
          ›
        </button>
        {!thisWeek && (
          <button type="button" className="recettes-link" onClick={onToday}>
            Revenir à cette semaine
          </button>
        )}
        <span className="recettes-spacer" />
        {toolbar}
      </div>

      <div className="recettes-menu-grid" role="table" aria-label="Menu de la semaine">
        {days.map((d) => (
          <div key={d} className={`recettes-menu-day${d === today ? ' today' : ''}${d < today ? ' past' : ''}`} role="row">
            <div className="recettes-menu-date" role="rowheader">
              {capitalized(weekdayLabel(d))}
            </div>
            {MEALS.map((meal) => (
              <div key={meal} className="recettes-menu-slot" role="cell" aria-label={`${MEAL_LABELS[meal]} du ${weekdayLabel(d)}`}>
                <span className="recettes-menu-meal">{MEAL_LABELS[meal]}</span>
                {slot(entries, d, meal).map((e) => {
                  const recipe = e.recipeId ? byId.get(e.recipeId) : undefined;
                  return (
                    <span key={e.id} className="recettes-menu-entry">
                      {recipe ? (
                        <button type="button" className="recettes-menu-recipe" onClick={() => onOpen(recipe)}>
                          {recipe.title}
                        </button>
                      ) : (
                        <span className="recettes-menu-free">{e.title}</span>
                      )}
                      {e.servings && <span className="recettes-menu-servings">×{e.servings}</span>}
                      <button type="button" className="recettes-menu-remove" aria-label={`Retirer ${recipe?.title ?? e.title} du menu`} onClick={() => onRemove(e)}>
                        ✕
                      </button>
                    </span>
                  );
                })}
                <button type="button" className="recettes-menu-add" aria-label={`Ajouter au ${MEAL_LABELS[meal].toLowerCase()} du ${weekdayLabel(d)}`} onClick={() => onAdd(d, meal)}>
                  +
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
