import { useEffect, useMemo, useState } from 'react';
import { nutritionStore } from '../data';
import { CIQUAL_CREDIT, loadCiqual, type CiqualFood } from '../lib/ciqual';
import { shiftDay } from '../lib/day';
import { buildIndex, searchFoods } from '../lib/foodSearch';
import { recentFoods } from '../lib/journal';
import { formatDg, valuesForGrams, type NutrientValues } from '../lib/macros';
import { MEAL_LABELS, type Food, type Meal } from '../lib/types';

interface Props {
  day: string;
  today: string;
  meal: Meal;
  onCancel: () => void;
  /** Après un ajout réussi : l'écran relit le journal et ferme la fenêtre. */
  onAdded: () => Promise<void>;
}

/** Ce que la recherche propose : un aliment CIQUAL ou un aliment perso, sous une forme commune. */
interface Candidate {
  key: string;
  label: string;
  detail: string;
  per100g: NutrientValues;
  ciqualCode: string | null;
  foodId: string | null;
  servingGrams: number | null;
}

/** Jusqu'où remonter dans le journal pour retrouver les aliments récents. */
const RECENT_DAYS = 60;
const RECENT_SHOWN = 12;

function fromCiqual(f: CiqualFood): Candidate {
  return {
    key: `ciqual:${f.code}`,
    label: f.name,
    detail: `${f.kcal} kcal / 100 g`,
    per100g: f,
    ciqualCode: f.code,
    foodId: null,
    servingGrams: null,
  };
}

function fromFood(f: Food): Candidate {
  return {
    key: `food:${f.id}`,
    label: f.brand ? `${f.name} (${f.brand})` : f.name,
    detail: `${f.kcal} kcal / 100 g · mon aliment`,
    per100g: f,
    ciqualCode: null,
    foodId: f.id,
    servingGrams: f.servingGrams,
  };
}

/**
 * Ajouter un aliment à un repas : chercher, choisir, dire combien.
 *
 * La table CIQUAL n'est chargée qu'ici, à la première ouverture (import
 * dynamique, `lib/ciqual.ts`). Les aliments déjà mangés passent devant dans
 * la recherche et s'affichent seuls tant que rien n'est tapé, avec la
 * quantité de la dernière fois — la moitié du remède à la friction de
 * saisie (docs/etude-nutrition.md §3).
 *
 * Un échec d'enregistrement laisse la fenêtre ouverte et remplie : la file
 * hors ligne vient après la V1 (étude §12), en attendant rien de ce qui a
 * été tapé ne doit se perdre.
 */
export function AddFoodDialog({ day, today, meal, onCancel, onAdded }: Props) {
  const [table, setTable] = useState<CiqualFood[] | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recentGrams, setRecentGrams] = useState<Map<string, number>>(new Map());
  const [recentOrder, setRecentOrder] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [grams, setGrams] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCiqual(),
      nutritionStore.listFoods(),
      nutritionStore.listEntries(shiftDay(today, -RECENT_DAYS), today),
    ])
      .then(([nextTable, nextFoods, history]) => {
        if (cancelled) return;
        const recents = recentFoods(history);
        setTable(nextTable);
        setFoods(nextFoods);
        setRecentOrder(recents.map((r) => r.key));
        setRecentGrams(new Map(recents.map((r) => [r.key, r.lastGrams])));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error && /fetch|import|module/i.test(err.message)
            ? 'La table des aliments n’a pas pu être téléchargée. Vérifie la connexion et réessaie.'
            : err instanceof Error
              ? err.message
              : 'Chargement impossible.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const candidates = useMemo(() => {
    const list = foods.map(fromFood);
    for (const f of table ?? []) list.push(fromCiqual(f));
    return list;
  }, [table, foods]);

  const byKey = useMemo(() => new Map(candidates.map((c) => [c.key, c])), [candidates]);
  const index = useMemo(() => buildIndex(candidates, (c) => c.label), [candidates]);

  const results = useMemo(() => {
    if (query.trim() === '') {
      return recentOrder
        .map((key) => byKey.get(key))
        .filter((c): c is Candidate => c !== undefined)
        .slice(0, RECENT_SHOWN);
    }
    // Plus un aliment a été mangé récemment, plus il remonte.
    const rank = new Map(recentOrder.map((key, i) => [key, recentOrder.length - i]));
    return searchFoods(index, query, { priority: (c) => rank.get(c.key) ?? 0 });
  }, [query, index, byKey, recentOrder]);

  function choose(candidate: Candidate) {
    setSelected(candidate);
    setError('');
    setGrams(String(recentGrams.get(candidate.key) ?? candidate.servingGrams ?? 100));
  }

  const gramsValue = Number(grams);
  const gramsValid = Number.isInteger(gramsValue) && gramsValue >= 1 && gramsValue <= 10000;
  const preview = selected && gramsValid ? valuesForGrams(selected.per100g, gramsValue) : null;

  async function submit() {
    if (!selected) return;
    if (!gramsValid) {
      setError('Indique une quantité en grammes, entre 1 et 10 000.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await nutritionStore.createEntry({
        day,
        meal,
        foodId: selected.foodId,
        ciqualCode: selected.ciqualCode,
        label: selected.label,
        grams: gramsValue,
        ...valuesForGrams(selected.per100g, gramsValue),
      });
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal nutrition-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${MEAL_LABELS[meal]} — ajouter un aliment`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{MEAL_LABELS[meal]} — ajouter un aliment</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {selected ? (
            <div className="nutrition-quantity">
              <div className="nutrition-quantity-food">
                <b>{selected.label}</b>
                <span className="nutrition-quantity-detail">{selected.detail}</span>
              </div>
              <div className="field">
                <label htmlFor="nutrition-grams">Quantité (g)</label>
                <input
                  id="nutrition-grams"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  step={1}
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                  autoFocus
                />
              </div>
              {preview && (
                <p className="nutrition-quantity-preview">
                  <b>{preview.kcal} kcal</b> · protéines {formatDg(preview.proteinDg)} · glucides{' '}
                  {formatDg(preview.carbsDg)} · lipides {formatDg(preview.fatDg)}
                </p>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                ← Changer d’aliment
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="nutrition-search">Aliment</label>
                <input
                  id="nutrition-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="pomme, riz cuit, yaourt nature…"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {loadError ? (
                <div className="notice error">{loadError}</div>
              ) : table === null ? (
                <p className="nutrition-search-hint">Chargement de la table des aliments…</p>
              ) : results.length === 0 ? (
                <p className="nutrition-search-hint">
                  {query.trim() === ''
                    ? 'Tape le nom d’un aliment. Ceux que tu as déjà mangés apparaîtront ici.'
                    : 'Aucun aliment trouvé. Essaie un mot plus court ou sans détail (« yaourt » plutôt que « yaourt grec »).'}
                </p>
              ) : (
                <>
                  {query.trim() === '' && <h3 className="nutrition-results-title">Récents</h3>}
                  <ul className="nutrition-results">
                    {results.map((c) => (
                      <li key={c.key}>
                        <button type="button" className="nutrition-result" onClick={() => choose(c)}>
                          <span className="nutrition-result-name">{c.label}</span>
                          <span className="nutrition-result-detail">{c.detail}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="nutrition-credit">Données : {CIQUAL_CREDIT}</p>
            </>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        {selected && (
          <div className="modal-foot">
            <button className="btn" onClick={onCancel}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={saving || !gramsValid}
            >
              {saving ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
