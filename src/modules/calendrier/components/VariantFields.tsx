import { COLOR_LABELS } from '../lib/calendarBridge';
import { EVENT_COLORS, type EventColor } from '../lib/types';
import { VARIANTS_MAX, VARIANT_NAME_MAX, defaultVariantId, newVariantId, type EventVariant } from '../lib/variants';
import { WEEKDAYS } from './RecurrenceFields';

interface Props {
  variants: EventVariant[];
  onChange: (variants: EventVariant[]) => void;
  /** Le jour de l'occurrence touchée, pour choisir sa variante ; absent pour une série nouvelle */
  occurrenceDay: string | null;
  /** La variante de ce jour-là (`null` : aucune) */
  variantId: string | null;
  onChooseVariant: (id: string | null) => void;
}

/**
 * Les variantes d'une série (26/10/2026) : « Bureau », « 🏠 Télétravail »…
 * Le même événement, autrement certains jours. Chaque variante peut avoir ses
 * jours (choisie d'office ces jours-là) et sa couleur. Pour une occurrence
 * touchée, « Ce jour-là » choisit la sienne — pour ce jour seulement.
 */
export function VariantFields({ variants, onChange, occurrenceDay, variantId, onChooseVariant }: Props) {
  const update = (id: string, patch: Partial<EventVariant>) => onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  function toggleDay(id: string, day: number) {
    // Un jour n'est d'office que dans une variante : le prendre l'ôte aux autres.
    onChange(
      variants.map((v) =>
        v.id === id
          ? { ...v, weekdays: v.weekdays.includes(day) ? v.weekdays.filter((d) => d !== day) : [...v.weekdays, day].sort() }
          : { ...v, weekdays: v.weekdays.filter((d) => d !== day) },
      ),
    );
  }

  function remove(id: string) {
    const next = variants.filter((v) => v.id !== id);
    onChange(next);
    if (occurrenceDay && variantId === id) onChooseVariant(defaultVariantId(next, occurrenceDay));
  }

  const add = () => onChange([...variants, { id: newVariantId(), name: '', color: null, weekdays: [] }]);

  return (
    <div className="field calendrier-variants">
      <label>Variantes (facultatif)</label>
      {variants.length === 0 && (
        <p className="field-hint">Le même événement, autrement certains jours : au bureau ou en télétravail, par exemple.</p>
      )}

      {occurrenceDay && variants.length > 0 && (
        <div className="calendrier-variant-day">
          <span className="calendrier-variant-day-label">Ce jour-là</span>
          <div className="calendrier-variant-choices" role="radiogroup" aria-label="Variante de ce jour-là">
            {[{ id: null, name: 'Sans variante' }, ...variants].map((v) => (
              <button
                key={v.id ?? 'none'}
                type="button"
                role="radio"
                aria-checked={variantId === v.id}
                className={`calendrier-variant-choice${variantId === v.id ? ' on' : ''}`}
                onClick={() => onChooseVariant(v.id)}
              >
                {v.name.trim() || 'Sans nom'}
              </button>
            ))}
          </div>
        </div>
      )}

      {variants.map((v, i) => (
        <div key={v.id} className="calendrier-variant">
          <div className="calendrier-variant-head">
            <input
              type="text"
              value={v.name}
              maxLength={VARIANT_NAME_MAX}
              aria-label={`Nom de la variante ${i + 1}`}
              placeholder={i === 0 ? 'Bureau' : '🏠 Télétravail'}
              onChange={(e) => update(v.id, { name: e.target.value })}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(v.id)} aria-label={`Retirer la variante ${v.name || i + 1}`}>
              Retirer
            </button>
          </div>
          <div className="calendrier-variant-row">
            <span className="calendrier-variant-row-label">D’office le</span>
            <div className="calendrier-weekdays" role="group" aria-label={`Jours de la variante ${v.name || i + 1}`}>
              {WEEKDAYS.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={v.weekdays.includes(d.day)}
                  aria-label={d.name}
                  title={d.name}
                  className={`calendrier-weekday${v.weekdays.includes(d.day) ? ' on' : ''}`}
                  onClick={() => toggleDay(v.id, d.day)}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </div>
          <div className="calendrier-variant-row">
            <span className="calendrier-variant-row-label">Couleur</span>
            <div className="calendrier-colors" role="radiogroup" aria-label={`Couleur de la variante ${v.name || i + 1}`}>
              <button
                type="button"
                role="radio"
                aria-checked={v.color === null}
                aria-label="Celle de l’événement"
                title="Celle de l’événement"
                className={`calendrier-color calendrier-color-same${v.color === null ? ' on' : ''}`}
                onClick={() => update(v.id, { color: null })}
              />
              {EVENT_COLORS.map((c: EventColor) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={v.color === c}
                  aria-label={COLOR_LABELS[c]}
                  title={COLOR_LABELS[c]}
                  className={`calendrier-color calendrier-color-${c}${v.color === c ? ' on' : ''}`}
                  onClick={() => update(v.id, { color: c })}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      {variants.length < VARIANTS_MAX && (
        <button type="button" className="btn btn-ghost btn-sm calendrier-variant-add" onClick={add}>
          + Ajouter une variante
        </button>
      )}
    </div>
  );
}
