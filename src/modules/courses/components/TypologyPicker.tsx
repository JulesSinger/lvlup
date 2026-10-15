import { FOOD_KIND_LABELS, FOOD_KINDS, guessTypology, TYPOLOGIES, TYPOLOGY_EMOJIS, TYPOLOGY_LABELS, type FoodKind, type Typology } from '../lib/typology';
import type { Aisle } from '../lib/types';

export interface TypologyValue {
  typology: Typology | null;
  foodKind: FoodKind | null;
}

interface Props {
  value: TypologyValue;
  onChange(next: TypologyValue): void;
  /** Pour dire ce que la devinette propose : le nom et le rayon de l'article */
  name: string;
  aisle: Aisle;
  idPrefix: string;
}

const AUTO = '';

/**
 * Le classement d'un article dans le contenu des courses (docs/etude-courses-typologies.md) :
 * « deviné » par défaut, ou une typologie choisie — et pour l'alimentation, essentiel, plaisir
 * ou alcool. Ses courses passées suivent le choix.
 */
export function TypologyPicker({ value, onChange, name, aisle, idPrefix }: Props) {
  const guess = guessTypology(name, aisle);
  const guessText = `${TYPOLOGY_LABELS[guess.typology]}${guess.foodKind ? ` · ${FOOD_KIND_LABELS[guess.foodKind]}` : ''}`;
  return (
    <div className="courses-editor-grid">
      <div className="field">
        <label htmlFor={`${idPrefix}-typology`}>Dans les dépenses</label>
        <select
          id={`${idPrefix}-typology`}
          value={value.typology ?? AUTO}
          onChange={(e) => {
            const typology = e.target.value === AUTO ? null : (e.target.value as Typology);
            onChange({ typology, foodKind: typology === 'alimentation' ? (value.foodKind ?? guess.foodKind ?? 'essentiel') : null });
          }}
        >
          <option value={AUTO}>Deviné : {guessText}</option>
          {TYPOLOGIES.map((t) => (
            <option key={t} value={t}>
              {TYPOLOGY_EMOJIS[t]} {TYPOLOGY_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {value.typology === 'alimentation' && (
        <div className="field">
          <label htmlFor={`${idPrefix}-food-kind`}>Sorte</label>
          <select id={`${idPrefix}-food-kind`} value={value.foodKind ?? 'essentiel'} onChange={(e) => onChange({ typology: 'alimentation', foodKind: e.target.value as FoodKind })}>
            {FOOD_KINDS.map((k) => (
              <option key={k} value={k}>
                {FOOD_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
