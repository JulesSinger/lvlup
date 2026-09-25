import { useState } from 'react';
import { kcalFromForm, validateFoodForm, type FoodFormValues } from '../lib/foodForm';
import type { FoodInput } from '../lib/types';

interface Props {
  initial: FoodFormValues;
  submitLabel: string;
  /**
   * Ce que le formulaire n'affiche pas mais qui accompagne l'aliment : son
   * code-barres et sa provenance (Open Food Facts), étape 6.
   */
  extra?: Pick<FoodInput, 'source' | 'barcode'>;
  onCancel: () => void;
  /** Rejette en cas d'échec : le formulaire reste rempli et affiche l'erreur. */
  onSubmit: (input: FoodInput) => Promise<void>;
}

const NUMBER_FIELDS = [
  { key: 'protein', label: 'Protéines (g)' },
  { key: 'carbs', label: 'Glucides (g)' },
  { key: 'fat', label: 'Lipides (g)' },
  { key: 'fiber', label: 'Fibres (g, facultatif)' },
] as const;

/**
 * Un aliment perso, tel qu'on le recopie d'une étiquette : valeurs pour
 * 100 g, virgule décimale acceptée. Sans modale autour : il s'affiche aussi
 * bien dans « Mes aliments » que dans la fenêtre d'ajout, quand la recherche
 * ne trouve rien.
 */
export function FoodForm({ initial, submitLabel, extra, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<FoodFormValues>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FoodFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: key === 'favorite' ? e.target.checked : e.target.value }));

  const suggestedKcal = kcalFromForm(values);

  async function submit() {
    const result = validateFoodForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...result.input, ...extra });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="nutrition-food-form">
      <div className="nutrition-food-form-grid">
        <div className="field nutrition-food-form-wide">
          <label htmlFor="nutrition-food-name">Nom</label>
          <input
            id="nutrition-food-name"
            type="text"
            value={values.name}
            onChange={set('name')}
            placeholder="Poulet rôti de la cantine, gâteau de mamie…"
            autoFocus
          />
        </div>
        <div className="field nutrition-food-form-wide">
          <label htmlFor="nutrition-food-brand">Marque (facultatif)</label>
          <input id="nutrition-food-brand" type="text" value={values.brand} onChange={set('brand')} />
        </div>
      </div>

      <p className="nutrition-food-form-caption">Pour 100 g, comme sur l’étiquette :</p>
      <div className="nutrition-food-form-grid">
        {NUMBER_FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`nutrition-food-${f.key}`}>{f.label}</label>
            <input
              id={`nutrition-food-${f.key}`}
              type="text"
              inputMode="decimal"
              value={values[f.key]}
              onChange={set(f.key)}
            />
          </div>
        ))}
        <div className="field">
          <label htmlFor="nutrition-food-kcal">Énergie (kcal)</label>
          <input
            id="nutrition-food-kcal"
            type="text"
            inputMode="numeric"
            value={values.kcal}
            onChange={set('kcal')}
          />
          {suggestedKcal !== null && values.kcal.trim() !== String(suggestedKcal) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm nutrition-food-kcal-suggest"
              onClick={() => setValues((v) => ({ ...v, kcal: String(suggestedKcal) }))}
              title="Calculé d’après les macros : 4 kcal par gramme de protéines ou de glucides, 9 par gramme de lipides"
            >
              ≈ {suggestedKcal} kcal d’après les macros
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="nutrition-food-serving">Portion (g, facultatif)</label>
          <input
            id="nutrition-food-serving"
            type="text"
            inputMode="numeric"
            value={values.servingGrams}
            onChange={set('servingGrams')}
            placeholder="1 pot = 125"
          />
        </div>
      </div>

      <label className="nutrition-food-favorite">
        <input type="checkbox" checked={values.favorite} onChange={set('favorite')} /> Favori — toujours proposé en premier
      </label>

      {error && <div className="notice error">{error}</div>}

      <div className="nutrition-food-form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
