import { useCallback, useEffect, useState } from 'react';
import { nutritionStore } from '../data';
import { EMPTY_FOOD_FORM, foodToForm } from '../lib/foodForm';
import type { Food, FoodInput } from '../lib/types';
import { FoodForm } from './FoodForm';

interface Props {
  onClose: () => void;
}

/**
 * « Mes aliments » : ce que la table CIQUAL ne connaît pas — le plat de la
 * cantine, une recette de famille, un produit de marque. Créer, corriger,
 * marquer en favori, supprimer.
 *
 * Corriger ou supprimer un aliment ne touche jamais le journal : les repas
 * déjà notés gardent les valeurs figées à la saisie (étude §6), et une
 * suppression ne fait que leur retirer la référence.
 */
export function MyFoodsDialog({ onClose }: Props) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** `null` = liste, `'new'` = création, un aliment = modification. */
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const list = await nutritionStore.listFoods();
      setFoods(list.slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'fr')));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Échap referme d'abord le formulaire, puis la fenêtre.
      if (editing !== null) setEditing(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  async function save(input: FoodInput) {
    if (editing !== null && editing !== 'new') await nutritionStore.updateFood(editing.id, input);
    else await nutritionStore.createFood(input);
    setEditing(null);
    await refresh();
  }

  async function toggleFavorite(food: Food) {
    try {
      await nutritionStore.updateFood(food.id, { favorite: !food.favorite });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function remove(food: Food) {
    if (!window.confirm(`Supprimer « ${food.name} » ? Les repas déjà notés le gardent.`)) return;
    try {
      await nutritionStore.deleteFood(food.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal nutrition-foods-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Mes aliments"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">
            {editing === null ? 'Mes aliments' : editing === 'new' ? 'Nouvel aliment' : `Modifier « ${editing.name} »`}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {editing !== null ? (
            <FoodForm
              initial={editing === 'new' ? EMPTY_FOOD_FORM : foodToForm(editing)}
              submitLabel={editing === 'new' ? 'Créer' : 'Enregistrer'}
              onCancel={() => setEditing(null)}
              onSubmit={save}
            />
          ) : (
            <>
              <p className="field-hint">
                Ce que la table des aliments ne connaît pas : un plat de cantine, une recette, un
                produit de marque. Ils apparaissent ensuite dans la recherche comme les autres.
              </p>
              {!loaded ? (
                <p className="nutrition-search-hint">Chargement…</p>
              ) : foods.length === 0 ? (
                <p className="nutrition-search-hint">Aucun aliment perso pour l’instant.</p>
              ) : (
                <ul className="nutrition-foods-list">
                  {foods.map((food) => (
                    <li key={food.id} className="nutrition-food-row">
                      <button
                        type="button"
                        className={`nutrition-favorite-toggle${food.favorite ? ' on' : ''}`}
                        onClick={() => void toggleFavorite(food)}
                        aria-pressed={food.favorite}
                        aria-label={food.favorite ? `Retirer « ${food.name} » des favoris` : `Mettre « ${food.name} » en favori`}
                        title={food.favorite ? 'Retirer des favoris' : 'Mettre en favori'}
                      >
                        {food.favorite ? '★' : '☆'}
                      </button>
                      <span className="nutrition-food-row-name">
                        {food.name}
                        {food.brand && <span className="nutrition-food-row-brand"> · {food.brand}</span>}
                      </span>
                      <span className="nutrition-food-row-kcal">{food.kcal} kcal / 100 g</span>
                      <span className="nutrition-food-row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(food)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-danger"
                          onClick={() => void remove(food)}
                        >
                          Supprimer
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {error && <div className="notice error">{error}</div>}
              <button type="button" className="btn btn-primary nutrition-foods-new" onClick={() => setEditing('new')}>
                + Nouvel aliment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
