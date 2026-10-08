import { useMemo, useState } from 'react';
import { CATEGORY_LABELS } from '../lib/categories';
import { formatMinutes, totalMinutes } from '../lib/duration';
import { NO_FILTERS, cookedSummary, searchRecipes, withWhatIHave, type RecipeFilters } from '../lib/search';
import { RECIPE_CATEGORIES, type Cooked, type Recipe, type RecipeCategory, type RecipePhoto } from '../lib/types';
import { RecipeCover } from './RecipePhotoImg';

function RecipeCard({ recipe, photo, cooked, onOpen, found }: { recipe: Recipe; photo: RecipePhoto | null; cooked: Cooked[]; onOpen: () => void; found?: string }) {
  const total = totalMinutes(recipe);
  const summary = cookedSummary(recipe.id, cooked);
  return (
    <button type="button" className="recettes-card" onClick={onOpen}>
      <RecipeCover photo={photo} category={recipe.category} size="thumb" alt="" className="recettes-card-photo" />
      <span className="recettes-card-body">
        <span className="recettes-card-title">
          {recipe.favorite && (
            <span className="recettes-card-fav" aria-label="Favori">
              ★{' '}
            </span>
          )}
          {recipe.title}
        </span>
        <span className="recettes-card-meta">
          {total !== null && <span>⏱ {formatMinutes(total)}</span>}
          {summary.rating !== null && <span>★ {String(summary.rating).replace('.', ',')}</span>}
          {summary.count === 0 && <span>jamais faite</span>}
        </span>
        {found && <span className="recettes-card-found">{found}</span>}
      </span>
    </button>
  );
}

/**
 * Le carnet (docs/etude-recettes.md §4.4, §5) : les recettes en cartes, la
 * recherche et les filtres, et « avec ce que j'ai ».
 */
export function Notebook({ recipes, photos, cooked, pantry, onOpen }: {
  recipes: Recipe[];
  photos: RecipePhoto[];
  cooked: Cooked[];
  pantry: string[];
  onOpen: (recipe: Recipe) => void;
}) {
  const [filters, setFilters] = useState<RecipeFilters>(NO_FILTERS);
  const [have, setHave] = useState<string | null>(null);
  const photoOf = useMemo(() => new Map(photos.map((p) => [p.recipeId, p])), [photos]);
  const shown = useMemo(() => searchRecipes(recipes, filters, cooked), [recipes, filters, cooked]);
  const matches = useMemo(() => (have ? withWhatIHave(recipes, have, pantry) : []), [recipes, have, pantry]);
  const set = <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = filters !== NO_FILTERS && JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  return (
    <div className="recettes-notebook">
      <div className="recettes-search">
        {have === null ? (
          <input
            type="search"
            className="recettes-search-input"
            aria-label="Chercher une recette"
            placeholder="Chercher : titre, ingrédient, étiquette…"
            value={filters.query}
            onChange={(e) => set('query', e.target.value)}
          />
        ) : (
          <input
            type="search"
            className="recettes-search-input"
            aria-label="Ce que j’ai"
            placeholder="Ce que j’ai : courgette, feta, œufs…"
            value={have}
            autoFocus
            onChange={(e) => setHave(e.target.value)}
          />
        )}
        <button type="button" className={`recettes-chip${have !== null ? ' on' : ''}`} aria-pressed={have !== null} onClick={() => setHave(have === null ? '' : null)}>
          🧺 Avec ce que j’ai
        </button>
      </div>

      {have === null && (
        <div className="recettes-filters" role="group" aria-label="Filtres">
          <select aria-label="Catégorie" value={filters.category ?? ''} onChange={(e) => set('category', (e.target.value || null) as RecipeCategory | null)}>
            <option value="">Toutes les catégories</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button type="button" className={`recettes-chip${filters.maxMinutes === 30 ? ' on' : ''}`} aria-pressed={filters.maxMinutes === 30} onClick={() => set('maxMinutes', filters.maxMinutes === 30 ? null : 30)}>
            ⏱ 30 min ou moins
          </button>
          <button type="button" className={`recettes-chip${filters.favorites ? ' on' : ''}`} aria-pressed={filters.favorites} onClick={() => set('favorites', !filters.favorites)}>
            ★ Favoris
          </button>
          <button type="button" className={`recettes-chip${filters.neverCooked ? ' on' : ''}`} aria-pressed={filters.neverCooked} onClick={() => set('neverCooked', !filters.neverCooked)}>
            Jamais faites
          </button>
          {filtered && (
            <button type="button" className="recettes-link" onClick={() => setFilters(NO_FILTERS)}>
              Tout montrer
            </button>
          )}
        </div>
      )}

      {have !== null ? (
        have.trim() === '' ? (
          <p className="recettes-hint">Écris ce que tu as sous la main, séparé par des virgules : les recettes qui s’en servent le plus viennent en premier.</p>
        ) : matches.length === 0 ? (
          <p className="recettes-hint">Aucune recette ne s’en sert.</p>
        ) : (
          <div className="recettes-grid">
            {matches.map((m) => (
              <RecipeCard
                key={m.recipe.id}
                recipe={m.recipe}
                photo={photoOf.get(m.recipe.id) ?? null}
                cooked={cooked}
                onOpen={() => onOpen(m.recipe)}
                found={`${m.found.join(', ')}${m.missing > 0 ? ` · il manque ${m.missing} ingrédient${m.missing > 1 ? 's' : ''}` : ' · rien ne manque'}`}
              />
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <p className="recettes-hint">Aucune recette ne correspond.</p>
      ) : (
        <div className="recettes-grid">
          {shown.map((r) => (
            <RecipeCard key={r.id} recipe={r} photo={photoOf.get(r.id) ?? null} cooked={cooked} onOpen={() => onOpen(r)} />
          ))}
        </div>
      )}
    </div>
  );
}
