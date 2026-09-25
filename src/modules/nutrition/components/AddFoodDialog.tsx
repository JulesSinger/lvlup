import { useEffect, useMemo, useState } from 'react';
import { nutritionStore } from '../data';
import { CIQUAL_CREDIT, loadCiqual, type CiqualFood } from '../lib/ciqual';
import { shiftDay } from '../lib/day';
import { buildIndex, searchFoods } from '../lib/foodSearch';
import { recentFoods } from '../lib/journal';
import { EMPTY_FOOD_FORM } from '../lib/foodForm';
import { formatDg, valuesForGrams, type NutrientValues } from '../lib/macros';
import { MEAL_LABELS, type Food, type FoodInput, type Meal } from '../lib/types';
import { BarcodeLookup, type BarcodeResult } from './BarcodeLookup';
import { FoodForm } from './FoodForm';

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
  favorite: boolean;
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
    favorite: false,
  };
}

function fromFood(f: Food): Candidate {
  return {
    key: `food:${f.id}`,
    label: f.brand ? `${f.name} (${f.brand})` : f.name,
    detail: `${f.kcal} kcal / 100 g · mon aliment${f.favorite ? ' ★' : ''}`,
    per100g: f,
    ciqualCode: null,
    foodId: f.id,
    servingGrams: f.servingGrams,
    favorite: f.favorite,
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
 * Le code-barres (étape 6) passe par `BarcodeLookup` : un produit déjà
 * recopié est repris directement, un produit d'Open Food Facts s'affiche en
 * formulaire pré-rempli à relire, un produit inconnu en formulaire vide.
 *
 * Les favoris (étape 5) s'affichent en tête et passent devant dans la
 * recherche ; un aliment introuvable se crée sur place, sans quitter la
 * fenêtre, puis se choisit aussitôt.
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
  /** La recherche n'a rien trouvé : on crée l'aliment sur place (étape 5). */
  const [creating, setCreating] = useState(false);
  /** Le scanner est ouvert (étape 6). */
  const [scanning, setScanning] = useState(false);
  /** Un code lu, pas encore recopié : son formulaire à relire (étape 6). */
  const [scanned, setScanned] = useState<Exclude<BarcodeResult, { kind: 'known' }> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Échap referme d'abord le formulaire ou le scanner, puis la fenêtre.
      if (scanned) setScanned(null);
      else if (creating) setCreating(false);
      else if (scanning) setScanning(false);
      else onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, creating, scanning, scanned]);

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

  const favorites = useMemo(
    () => candidates.filter((c) => c.favorite).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [candidates],
  );

  /** Sans rien taper : les récents, hors favoris (déjà affichés au-dessus). */
  const recents = useMemo(
    () =>
      recentOrder
        .map((key) => byKey.get(key))
        .filter((c): c is Candidate => c !== undefined && !c.favorite)
        .slice(0, RECENT_SHOWN),
    [recentOrder, byKey],
  );

  const results = useMemo(() => {
    if (query.trim() === '') return [];
    // Les favoris d'abord, puis plus un aliment a été mangé récemment, plus il remonte.
    const rank = new Map(recentOrder.map((key, i) => [key, recentOrder.length - i]));
    const favoriteBoost = recentOrder.length + 1;
    return searchFoods(index, query, {
      priority: (c) => (c.favorite ? favoriteBoost : 0) + (rank.get(c.key) ?? 0),
    });
  }, [query, index, recentOrder]);

  async function createFood(input: FoodInput) {
    const food = await nutritionStore.createFood(input);
    setFoods((list) => [...list, food]);
    setCreating(false);
    setScanning(false);
    setScanned(null);
    choose(fromFood(food));
  }

  function onBarcode(result: BarcodeResult) {
    if (result.kind === 'known') {
      // Déjà recopié : ni appel réseau, ni formulaire — directement la quantité.
      setScanning(false);
      choose(fromFood(result.food));
    } else {
      setScanned(result);
    }
  }

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
          {scanned ? (
            <>
              {scanned.kind === 'off' ? (
                <p className="nutrition-barcode-notice">
                  Trouvé sur Open Food Facts. Ces données sont participatives :{' '}
                  <b>relis-les avec l’étiquette</b> avant d’enregistrer
                  {scanned.missing.length > 0 && <>, et complète {scanned.missing.join(', ')}</>}.
                </p>
              ) : (
                <p className="nutrition-barcode-notice">
                  Produit inconnu d’Open Food Facts ({scanned.barcode}). Recopie l’étiquette : le
                  prochain scan le retrouvera.
                </p>
              )}
              <FoodForm
                initial={scanned.kind === 'off' ? scanned.values : EMPTY_FOOD_FORM}
                submitLabel="Enregistrer et choisir"
                extra={{ source: scanned.kind === 'off' ? 'off' : 'custom', barcode: scanned.barcode }}
                onCancel={() => setScanned(null)}
                onSubmit={createFood}
              />
            </>
          ) : scanning && !selected ? (
            <BarcodeLookup foods={foods} onResult={onBarcode} onBack={() => setScanning(false)} />
          ) : creating ? (
            <FoodForm
              initial={{ ...EMPTY_FOOD_FORM, name: query.trim() }}
              submitLabel="Créer et choisir"
              onCancel={() => setCreating(false)}
              onSubmit={createFood}
            />
          ) : selected ? (
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
              ) : query.trim() === '' ? (
                favorites.length === 0 && recents.length === 0 ? (
                  <p className="nutrition-search-hint">
                    Tape le nom d’un aliment. Ceux que tu as déjà mangés apparaîtront ici.
                  </p>
                ) : (
                  <>
                    {favorites.length > 0 && (
                      <>
                        <h3 className="nutrition-results-title">Favoris</h3>
                        <ResultList items={favorites} onChoose={choose} />
                      </>
                    )}
                    {recents.length > 0 && (
                      <>
                        <h3 className="nutrition-results-title">Récents</h3>
                        <ResultList items={recents} onChoose={choose} />
                      </>
                    )}
                  </>
                )
              ) : results.length === 0 ? (
                <p className="nutrition-search-hint">
                  Aucun aliment trouvé. Essaie un mot plus court (« yaourt » plutôt que « yaourt
                  grec »), ou crée-le.
                </p>
              ) : (
                <ResultList items={results} onChoose={choose} />
              )}
              {table !== null && (
                <div className="nutrition-add-extra">
                  <button type="button" className="btn btn-sm" onClick={() => setScanning(true)}>
                    📷 Code-barres
                  </button>
                  <button type="button" className="btn btn-sm nutrition-create-food" onClick={() => setCreating(true)}>
                    {query.trim() ? `+ Créer « ${query.trim()} »` : '+ Créer un aliment'}
                  </button>
                </div>
              )}
              <p className="nutrition-credit">Données : {CIQUAL_CREDIT}</p>
            </>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        {selected && !creating && !scanned && (
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

function ResultList({ items, onChoose }: { items: Candidate[]; onChoose: (c: Candidate) => void }) {
  return (
    <ul className="nutrition-results">
      {items.map((c) => (
        <li key={c.key}>
          <button type="button" className="nutrition-result" onClick={() => onChoose(c)}>
            <span className="nutrition-result-name">{c.label}</span>
            <span className="nutrition-result-detail">{c.detail}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
