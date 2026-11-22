import { capitalized, weekdayLabel } from '../lib/format';
import { slot, weekDays } from '../lib/menu';
import type { Meal, PlanEntry, Recipe } from '../lib/types';
import { MealGrid, type GridEntry } from './MealGrid';

/**
 * Le menu de la semaine (docs/etude-recettes.md §5, §17, §22) : sept jours,
 * midi et soir. Une case peut porter une recette du carnet (on l'ouvre d'un
 * geste), un simple titre (« Restes »), ou plusieurs choses (un plat, un
 * dessert) ; chacune dit s'il faut cuisiner ou sortir des restes. Deux repas
 * s'échangent en glissant l'un sur l'autre.
 */
export function MenuView({ day, today, entries, recipes, onWeek, onToday, onAdd, onOpen, onRemove, onToggleLeftovers, onSwap, template, toolbar }: {
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
  onToggleLeftovers: (entry: PlanEntry) => void;
  onSwap: (from: { day: string; meal: Meal }, to: { day: string; meal: Meal }) => void;
  /** La semaine type : combien de cases elle remplirait ici, et comment les remplir (§22). */
  template?: { fills: number; onApply: () => void; onEdit: () => void };
  /** Les gestes de la semaine (les courses, étape 6). */
  toolbar?: React.ReactNode;
}) {
  const days = weekDays(day);
  const thisWeek = days.includes(today);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const empty = days.every((d) => d < today) ? false : entries.filter((e) => e.day >= today).length === 0;

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
        {template && template.fills > 0 && !empty && (
          <button type="button" className="btn btn-sm" onClick={template.onApply}>
            📋 Compléter avec la semaine type
          </button>
        )}
        {toolbar}
      </div>

      {template && empty && (
        <div className="recettes-menu-offer" role="status">
          {template.fills > 0 ? (
            <>
              <span>Rien de prévu : ta semaine type remplit {template.fills} repas d’un geste.</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={template.onApply}>
                📋 Remplir avec la semaine type
              </button>
            </>
          ) : (
            <>
              <span>Rien de prévu. Une semaine type, décidée une fois, remplirait chaque semaine d’un geste.</span>
              <button type="button" className="btn btn-sm" onClick={template.onEdit}>
                Préparer ma semaine type
              </button>
            </>
          )}
        </div>
      )}

      <MealGrid
        label="Menu de la semaine"
        removeSuffix="du menu"
        rows={days.map((d) => ({ key: d, label: capitalized(weekdayLabel(d)), of: `du ${weekdayLabel(d)}`, tone: d === today ? 'today' : d < today ? 'past' : undefined }))}
        entriesOf={(d, meal) => slot(entries, d, meal)}
        recipes={recipes}
        onAdd={onAdd}
        onOpen={onOpen}
        onRemove={(e: GridEntry) => onRemove(byId.get(e.id)!)}
        onToggleLeftovers={(e: GridEntry) => onToggleLeftovers(byId.get(e.id)!)}
        onSwap={(from, to) => onSwap({ day: from.row, meal: from.meal }, { day: to.row, meal: to.meal })}
      />
    </div>
  );
}
