import { MEAL_LABELS } from '../lib/calendarMarks';
import { WEEKDAYS, type Meal, type Recipe, type TemplateEntry, type Weekday } from '../lib/types';
import { consecutiveRepeats, cookingSummary, templateSlot, WEEKDAY_NAMES } from '../lib/weekTemplate';
import { MealGrid, type GridEntry } from './MealGrid';

/**
 * La semaine type (docs/etude-recettes.md §22) : décidée une fois, jour par
 * jour, midi et soir ; chaque repas dit s'il faut cuisiner (pour combien de
 * parts) ou sortir des restes. Elle se recopie ensuite dans le menu de
 * n'importe quelle semaine, où l'on échange ce qu'on veut.
 */
export function TemplateView({ entries, recipes, onAdd, onOpen, onRemove, onToggleLeftovers, onSwap, onApply }: {
  entries: TemplateEntry[];
  recipes: Recipe[];
  onAdd: (weekday: Weekday, meal: Meal) => void;
  onOpen: (recipe: Recipe) => void;
  onRemove: (entry: TemplateEntry) => void;
  onToggleLeftovers: (entry: TemplateEntry) => void;
  onSwap: (from: { weekday: Weekday; meal: Meal }, to: { weekday: Weekday; meal: Meal }) => void;
  /** Recopier dans le menu de cette semaine. */
  onApply: () => void;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const titles = new Map(recipes.map((r) => [r.id, r.title]));
  const { cook, leftovers } = cookingSummary(entries);
  const repeats = consecutiveRepeats(entries);
  const filled = WEEKDAYS.reduce((n, wd) => n + (['midi', 'soir'] as const).filter((m) => templateSlot(entries, wd, m).length > 0).length, 0);

  return (
    <div className="recettes-menu recettes-template">
      <div className="recettes-menu-head">
        <span className="recettes-template-summary">
          {entries.length === 0
            ? 'Ta semaine type est vide.'
            : `${filled} repas sur 14 · ${cook} fois en cuisine · ${leftovers} repas de restes`}
        </span>
        <span className="recettes-spacer" />
        <button type="button" className="btn btn-sm btn-primary" onClick={onApply} disabled={entries.length === 0}>
          📋 Mettre au menu de cette semaine
        </button>
      </div>
      <p className="recettes-hint">
        La même semaine, chaque semaine. 🍳 : tu cuisines, pour plusieurs repas ; ♻️ : tu ressors ce qui reste (frigo, congélateur). Glisse un repas sur un autre
        pour les échanger.
      </p>
      {repeats.length > 0 && (
        <div className="notice info recettes-template-repeats" role="status">
          Deux repas de suite pareils :{' '}
          {repeats
            .map((r) => `${r.entry.recipeId ? (titles.get(r.entry.recipeId) ?? r.entry.title) : r.entry.title} au ${MEAL_LABELS[r.meal].toLowerCase()} du ${WEEKDAY_NAMES[r.weekday].toLowerCase()}`)
            .join(', ')}
          .
        </div>
      )}
      <MealGrid
        label="Semaine type"
        removeSuffix="de la semaine type"
        rows={WEEKDAYS.map((wd) => ({ key: String(wd), label: WEEKDAY_NAMES[wd], of: `du ${WEEKDAY_NAMES[wd].toLowerCase()}` }))}
        entriesOf={(row, meal) => templateSlot(entries, Number(row) as Weekday, meal)}
        recipes={recipes}
        onAdd={(row, meal) => onAdd(Number(row) as Weekday, meal)}
        onOpen={onOpen}
        onRemove={(e: GridEntry) => onRemove(byId.get(e.id)!)}
        onToggleLeftovers={(e: GridEntry) => onToggleLeftovers(byId.get(e.id)!)}
        onSwap={(from, to) => onSwap({ weekday: Number(from.row) as Weekday, meal: from.meal }, { weekday: Number(to.row) as Weekday, meal: to.meal })}
      />
    </div>
  );
}
