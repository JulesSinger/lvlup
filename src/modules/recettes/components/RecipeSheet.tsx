import { useState, type ReactNode } from 'react';
import { CATEGORY_LABELS } from '../lib/categories';
import { formatMinutes, totalMinutes } from '../lib/duration';
import { hostOf, shortDay } from '../lib/format';
import { isSectionHeading, scaleIngredient } from '../lib/ingredients';
import { cookedSummary } from '../lib/search';
import type { Cooked, Ingredient, Recipe, RecipePhoto } from '../lib/types';
import { RecipeCover } from './RecipePhotoImg';

/** Les ingrédients groupés par section, dans leur ordre. */
function groups(ingredients: Ingredient[]): { section: string | null; items: Ingredient[] }[] {
  const out: { section: string | null; items: Ingredient[] }[] = [];
  for (const i of ingredients) {
    if (isSectionHeading(i.text)) continue;
    const last = out[out.length - 1];
    if (last && last.section === i.section) last.items.push(i);
    else out.push({ section: i.section, items: [i] });
  }
  return out;
}

/**
 * La fiche d'une recette (docs/etude-recettes.md §5) : photo, temps, nombre
 * de personnes réglable (les quantités suivent), ingrédients, étapes,
 * historique. `actions` : les gestes des étapes suivantes (cuisiner, menu,
 * courses), posés à côté de ceux de la fiche.
 */
export function RecipeSheet({ recipe, photo, cooked, today, servings, onServings, onBack, onEdit, onFavorite, onDelete, onCooked, onDeleteCooked, actions }: {
  recipe: Recipe;
  photo: RecipePhoto | null;
  cooked: Cooked[];
  today: string;
  /** Le nombre de personnes choisi (gardé par l'écran pour les autres gestes). */
  servings: number | null;
  onServings: (n: number) => void;
  onBack: () => void;
  onEdit: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onCooked: () => void;
  onDeleteCooked: (c: Cooked) => void;
  actions?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const factor = recipe.servings && servings ? servings / recipe.servings : 1;
  const total = totalMinutes(recipe);
  const history = cooked.filter((c) => c.recipeId === recipe.id).sort((a, b) => b.day.localeCompare(a.day));
  const summary = cookedSummary(recipe.id, cooked);

  return (
    <article className="recettes-sheet">
      <div className="recettes-sheet-top">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          ← Carnet
        </button>
        <span className="recettes-spacer" />
        <button
          type="button"
          className={`btn btn-sm recettes-favorite${recipe.favorite ? ' on' : ''}`}
          aria-pressed={recipe.favorite}
          aria-label={recipe.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={onFavorite}
        >
          {recipe.favorite ? '★' : '☆'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onEdit}>
          Modifier
        </button>
      </div>

      <div className="recettes-sheet-head">
        <RecipeCover photo={photo} category={recipe.category} size="full" alt={recipe.title} className="recettes-sheet-photo" />
        <div className="recettes-sheet-title">
          <h1>{recipe.title}</h1>
          <p className="recettes-sheet-meta">
            <span>{CATEGORY_LABELS[recipe.category]}</span>
            {total !== null && <span>⏱ {formatMinutes(total)}</span>}
            {recipe.prepMinutes !== null && <span>Préparation {formatMinutes(recipe.prepMinutes)}</span>}
            {recipe.cookMinutes !== null && <span>Cuisson {formatMinutes(recipe.cookMinutes)}</span>}
            {recipe.restMinutes !== null && <span>Repos {formatMinutes(recipe.restMinutes)}</span>}
          </p>
          {recipe.description && <p className="recettes-sheet-description">{recipe.description}</p>}
          {(recipe.sourceName || recipe.sourceUrl) && (
            <p className="recettes-sheet-source">
              Source :{' '}
              {recipe.sourceUrl ? (
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {recipe.sourceName || hostOf(recipe.sourceUrl)}
                </a>
              ) : (
                recipe.sourceName
              )}
            </p>
          )}
          {recipe.tags.length > 0 && (
            <p className="recettes-tags">
              {recipe.tags.map((t) => (
                <span key={t} className="recettes-tag">
                  {t}
                </span>
              ))}
            </p>
          )}
          <p className="recettes-sheet-history-line">
            {summary.count === 0
              ? 'Jamais faite'
              : `Faite ${summary.count} fois, la dernière le ${shortDay(summary.last!, today)}${summary.rating !== null ? ` · ${String(summary.rating).replace('.', ',')}/5` : ''}`}
          </p>
          <div className="recettes-sheet-actions">
            {actions}
            <button type="button" className="btn btn-sm" onClick={onCooked}>
              ✓ Je l’ai faite
            </button>
          </div>
        </div>
      </div>

      {recipe.note && (
        <p className="recettes-sheet-note">
          <b>Ma note :</b> {recipe.note}
        </p>
      )}

      <div className="recettes-sheet-body">
        <section className="recettes-panel recettes-ingredients">
          <div className="recettes-panel-head">
            <h2 className="recettes-panel-title">Ingrédients</h2>
            {recipe.servings !== null && servings !== null && (
              <div className="recettes-servings" role="group" aria-label="Nombre de personnes">
                <button type="button" className="btn btn-sm" aria-label="Une personne de moins" disabled={servings <= 1} onClick={() => onServings(servings - 1)}>
                  −
                </button>
                <span className="recettes-servings-value">
                  {servings} {recipe.yieldLabel}
                </span>
                <button type="button" className="btn btn-sm" aria-label="Une personne de plus" disabled={servings >= 100} onClick={() => onServings(servings + 1)}>
                  +
                </button>
              </div>
            )}
          </div>
          {recipe.ingredients.length === 0 ? (
            <p className="recettes-hint">Aucun ingrédient noté.</p>
          ) : (
            groups(recipe.ingredients).map((g, gi) => (
              <div key={gi} className="recettes-ingredient-group">
                {g.section && <h3 className="recettes-group-title">{g.section}</h3>}
                <ul className="recettes-ingredient-list">
                  {g.items.map((i, ii) => (
                    <li key={ii}>{scaleIngredient(i.text, factor)}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {factor !== 1 && <p className="recettes-hint">Quantités ajustées pour {servings} {recipe.yieldLabel} (recette pour {recipe.servings}).</p>}
        </section>

        <section className="recettes-panel recettes-steps">
          <h2 className="recettes-panel-title">Préparation</h2>
          {recipe.steps.length === 0 ? (
            <p className="recettes-hint">Aucune étape notée.</p>
          ) : (
            <ol className="recettes-step-list">
              {recipe.steps.map((s, i) => (
                <li key={i}>{s.text}</li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {history.length > 0 && (
        <section className="recettes-panel recettes-history">
          <h2 className="recettes-panel-title">Historique</h2>
          <ul className="recettes-history-list">
            {history.map((c) => (
              <li key={c.id}>
                <span className="recettes-history-day">{shortDay(c.day, today)}</span>
                {c.servings !== null && <span>pour {c.servings}</span>}
                {c.rating !== null && <span className="recettes-history-rating">{'★'.repeat(c.rating)}</span>}
                {c.comment && <span className="recettes-history-comment">« {c.comment} »</span>}
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Retirer de l’historique" onClick={() => onDeleteCooked(c)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="recettes-sheet-danger">
        {confirming ? (
          <>
            <span>Supprimer « {recipe.title} », sa photo et son historique ?</span>
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              Supprimer
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(true)}>
            Supprimer la recette
          </button>
        )}
      </div>
    </article>
  );
}
