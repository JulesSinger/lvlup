import { useState, type ReactNode } from 'react';
import { DESIGN_COLORS_MAX, inkOn, normalizeDesign, normalizeHex, referenceLines } from '../lib/design';
import { displayUrl, safeHref } from '../lib/links';
import type { ProjectDesign } from '../lib/types';
import { useSaving } from './useSaving';

interface Props {
  saved: ProjectDesign;
  onSave: (design: ProjectDesign) => Promise<void>;
  /** Le logo et les images (étape 7), posés en tête de la fiche design. */
  images?: ReactNode;
}

/**
 * La fiche design (§3.5) : de quoi développer sans rouvrir la maquette.
 * Toucher une couleur copie son code.
 */
export function DesignPanel({ saved, onSave, images }: Props) {
  const [design, setDesign] = useState(() => normalizeDesign(saved));
  const [newColor, setNewColor] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { saving, error, setError, run } = useSaving();
  const set = (patch: Partial<Required<ProjectDesign>>) => {
    setDesign((d) => ({ ...d, ...patch }));
    setDone(false);
  };

  function addColor() {
    const hex = normalizeHex(newColor);
    if (!hex) return setError('Un code couleur s’écrit #e7b7c3 (ou e7b7c3).');
    if (design.colors.includes(hex)) return setNewColor('');
    if (design.colors.length >= DESIGN_COLORS_MAX) return setError(`${DESIGN_COLORS_MAX} couleurs au plus.`);
    setError('');
    set({ colors: [...design.colors, hex] });
    setNewColor('');
  }

  function copy(hex: string) {
    void navigator.clipboard?.writeText(hex).then(
      () => setCopied(hex),
      () => {},
    );
  }

  return (
    <div className="projets-design">
      {images}
      <section aria-label="Couleurs">
        <h2 className="projets-section-title">Couleurs</h2>
        <div className="projets-swatches">
          {design.colors.map((hex) => (
            <div key={hex} className="projets-swatch">
              <button
                type="button"
                className={`projets-swatch-color ink-${inkOn(hex)}`}
                style={{ background: hex }}
                aria-label={`Copier ${hex}`}
                title="Copier le code"
                onClick={() => copy(hex)}
              >
                {copied === hex ? 'Copié' : ''}
              </button>
              <span className="projets-swatch-code">{hex}</span>
              <button type="button" className="btn btn-ghost btn-sm projets-swatch-remove" aria-label={`Retirer ${hex}`} onClick={() => set({ colors: design.colors.filter((c) => c !== hex) })}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="projets-color-add">
          <input
            type="color"
            aria-label="Choisir une couleur"
            value={normalizeHex(newColor) ?? '#888888'}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <input aria-label="Code de la couleur" value={newColor} placeholder="#e7b7c3" onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColor()} />
          <button className="btn btn-sm" onClick={addColor}>
            Ajouter
          </button>
        </div>
      </section>

      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-design-title-font">Police des titres</label>
          <input id="projets-design-title-font" value={design.titleFont} placeholder="Cormorant Garamond" onChange={(e) => set({ titleFont: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="projets-design-body-font">Police du texte</label>
          <input id="projets-design-body-font" value={design.bodyFont} placeholder="Inter" onChange={(e) => set({ bodyFont: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="projets-design-mood">Ambiance</label>
        <input id="projets-design-mood" value={design.mood} placeholder="Douce, champêtre, artisanale" onChange={(e) => set({ mood: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="projets-design-refs">Sites de référence, un par ligne</label>
        <textarea id="projets-design-refs" rows={3} value={design.references} onChange={(e) => set({ references: e.target.value })} />
      </div>
      {referenceLines(design.references).length > 0 && (
        <ul className="projets-refs">
          {referenceLines(design.references).map((line) => {
            const href = safeHref(line);
            return <li key={line}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{displayUrl(line)}</a> : line}</li>;
          })}
        </ul>
      )}
      {error && <div className="notice error">{error}</div>}
      {done && !error && (
        <div className="notice success" role="status">
          Enregistré.
        </div>
      )}
      <div className="projets-infos-actions">
        <span className="projets-spacer" />
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() =>
            void run(async () => {
              await onSave(design);
              setDone(true);
            })
          }
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
