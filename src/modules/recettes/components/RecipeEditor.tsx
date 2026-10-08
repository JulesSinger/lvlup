import { useEffect, useState, type ReactNode } from 'react';
import { CATEGORY_LABELS } from '../lib/categories';
import { ingredientsToText, readMinutesField, stepsToText, textToIngredients, textToSteps, textToTags } from '../lib/editorText';
import { parsePastedRecipe } from '../lib/pasteText';
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory, type RecipeInput, type RecipePhoto } from '../lib/types';
import { validateRecipe } from '../lib/validation';
import { Modal } from './Modal';
import { RecipeCover } from './RecipePhotoImg';

export interface PhotoChange {
  /** Une nouvelle photo choisie ; null : aucun changement. */
  file: File | null;
  /** Retirer la photo existante. */
  remove: boolean;
}

interface Fields {
  title: string;
  category: RecipeCategory;
  servings: string;
  yieldLabel: string;
  prep: string;
  cook: string;
  rest: string;
  ingredients: string;
  steps: string;
  tags: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
  note: string;
}

const EMPTY: Fields = {
  title: '',
  category: 'plat',
  servings: '4',
  yieldLabel: 'personnes',
  prep: '',
  cook: '',
  rest: '',
  ingredients: '',
  steps: '',
  tags: '',
  sourceUrl: '',
  sourceName: '',
  description: '',
  note: '',
};

const minutesText = (m: number | null) => (m === null ? '' : String(m));

export function fieldsOf(r: Partial<RecipeInput>): Fields {
  return {
    title: r.title ?? '',
    category: r.category ?? 'plat',
    servings: r.servings ? String(r.servings) : '',
    yieldLabel: r.yieldLabel ?? 'personnes',
    prep: minutesText(r.prepMinutes ?? null),
    cook: minutesText(r.cookMinutes ?? null),
    rest: minutesText(r.restMinutes ?? null),
    ingredients: ingredientsToText(r.ingredients ?? []),
    steps: stepsToText(r.steps ?? []),
    tags: (r.tags ?? []).join(', '),
    sourceUrl: r.sourceUrl ?? '',
    sourceName: r.sourceName ?? '',
    description: r.description ?? '',
    note: r.note ?? '',
  };
}

/** Les champs vers une recette ; le message d'erreur quand quelque chose ne va pas. */
function toInput(f: Fields): RecipeInput | string {
  const servings = f.servings.trim() ? Number(f.servings.replace(',', '.')) : null;
  if (servings !== null && !Number.isInteger(servings)) return 'Le nombre de personnes est un nombre entier.';
  const minutes: Record<string, number | null> = {};
  for (const [key, label] of [
    ['prep', 'préparation'],
    ['cook', 'cuisson'],
    ['rest', 'repos'],
  ] as const) {
    const v = readMinutesField(f[key]);
    if (v === undefined) return `Le temps de ${label} s’écrit « 25 », « 45 min » ou « 1 h 30 ».`;
    minutes[key] = v;
  }
  const url = f.sourceUrl.trim();
  const input: RecipeInput = {
    title: f.title.trim(),
    category: f.category,
    servings,
    yieldLabel: f.yieldLabel.trim() || 'personnes',
    prepMinutes: minutes.prep,
    cookMinutes: minutes.cook,
    restMinutes: minutes.rest,
    ingredients: textToIngredients(f.ingredients),
    steps: textToSteps(f.steps),
    tags: textToTags(f.tags),
    sourceUrl: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : null,
    sourceName: f.sourceName.trim(),
    description: f.description.trim(),
    note: f.note.trim(),
  };
  return validateRecipe(input) ?? input;
}

/**
 * La fenêtre d'une recette (docs/etude-recettes.md §3.2, §3.3, §15) : la taper
 * à la main, ou coller un texte qu'Atlas découpe en brouillon à relire.
 * `extraSource` : d'autres façons de commencer (le lien, étape 4).
 */
export function RecipeEditor({ recipe, photo, draft, onSave, onClose, extraSource }: {
  recipe: Recipe | null;
  photo: RecipePhoto | null;
  /** Un brouillon venu d'ailleurs (un lien) : les champs s'en remplissent. */
  draft?: Partial<RecipeInput> | null;
  onSave: (input: RecipeInput, photo: PhotoChange) => Promise<void>;
  onClose: () => void;
  extraSource?: (fill: (draft: Partial<RecipeInput>, photoFile: File | null) => void) => ReactNode;
}) {
  const [f, setF] = useState<Fields>(() => (recipe ? fieldsOf(recipe) : draft ? fieldsOf(draft) : EMPTY));
  const [mode, setMode] = useState<'form' | 'paste'>('form');
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }));

  function readPasted() {
    const r = parsePastedRecipe(pasted);
    if (r.ingredients.length === 0 && r.steps.length === 0) {
      setError('Rien de lisible dans ce texte : colle la recette entière, ingrédients et étapes.');
      return;
    }
    setF((prev) => ({
      ...prev,
      title: r.title || prev.title,
      servings: r.servings ? String(r.servings) : prev.servings,
      yieldLabel: r.servings ? r.yieldLabel : prev.yieldLabel,
      ingredients: ingredientsToText(r.ingredients),
      steps: stepsToText(r.steps),
    }));
    setError('');
    setMode('form');
  }

  function fill(d: Partial<RecipeInput>, photoFile: File | null) {
    setF(fieldsOf(d));
    if (photoFile) setFile(photoFile);
    setError('');
    setMode('form');
  }

  async function save() {
    const input = toInput(f);
    if (typeof input === 'string') return setError(input);
    setSaving(true);
    setError('');
    try {
      await onSave(input, { file, remove: removePhoto && !file });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  const showPhoto = file ? null : removePhoto ? null : photo;

  return (
    <Modal
      title={recipe ? 'Modifier la recette' : 'Nouvelle recette'}
      onClose={onClose}
      className="recettes-editor"
      footer={
        mode === 'form' ? (
          <>
            <span className="recettes-spacer" />
            <button className="btn" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              Enregistrer
            </button>
          </>
        ) : (
          <>
            <span className="recettes-spacer" />
            <button className="btn" onClick={() => setMode('form')}>
              Retour
            </button>
            <button className="btn btn-primary" onClick={readPasted} disabled={!pasted.trim()}>
              Lire le texte
            </button>
          </>
        )
      }
    >
      {!recipe && (
        <div className="recettes-choice" role="group" aria-label="Commencer">
          <button type="button" className={`recettes-choice-item${mode === 'form' ? ' on' : ''}`} onClick={() => setMode('form')}>
            Saisir
          </button>
          <button type="button" className={`recettes-choice-item${mode === 'paste' ? ' on' : ''}`} onClick={() => setMode('paste')}>
            Coller un texte
          </button>
        </div>
      )}
      {!recipe && mode === 'form' && extraSource?.(fill)}

      {mode === 'paste' ? (
        <div className="field">
          <label htmlFor="recettes-paste">La recette, telle quelle</label>
          <textarea
            id="recettes-paste"
            rows={12}
            value={pasted}
            placeholder={'Crêpes\nPour 4 personnes\nIngrédients :\n- 250 g de farine\n- 4 oeufs\nPréparation :\n1. Mélanger…'}
            onChange={(e) => setPasted(e.target.value)}
          />
          <p className="recettes-hint">Depuis Instagram, un message, un PDF : Atlas sépare les ingrédients des étapes, tu relis ensuite.</p>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="recettes-title">Titre</label>
            <input id="recettes-title" value={f.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Lasagnes à la bolognaise" />
          </div>
          <div className="recettes-field-row">
            <div className="field">
              <label htmlFor="recettes-category">Catégorie</label>
              <select id="recettes-category" value={f.category} onChange={(e) => set('category', e.target.value as RecipeCategory)}>
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="recettes-servings">Pour</label>
              <input id="recettes-servings" inputMode="numeric" value={f.servings} onChange={(e) => set('servings', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="recettes-yield">&nbsp;</label>
              <input id="recettes-yield" aria-label="Ce que donne la recette" value={f.yieldLabel} maxLength={40} onChange={(e) => set('yieldLabel', e.target.value)} />
            </div>
          </div>
          <div className="recettes-field-row">
            <div className="field">
              <label htmlFor="recettes-prep">Préparation</label>
              <input id="recettes-prep" value={f.prep} placeholder="20 min" onChange={(e) => set('prep', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="recettes-cook">Cuisson</label>
              <input id="recettes-cook" value={f.cook} placeholder="1 h 30" onChange={(e) => set('cook', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="recettes-rest">Repos</label>
              <input id="recettes-rest" value={f.rest} placeholder="—" onChange={(e) => set('rest', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="recettes-ingredients">Ingrédients</label>
            <textarea id="recettes-ingredients" rows={8} value={f.ingredients} placeholder={'600 g de boeuf haché\n3 oignons\nPour la béchamel :\n1 l de lait'} onChange={(e) => set('ingredients', e.target.value)} />
            <p className="recettes-hint">Un par ligne. Une ligne qui finit par « : » ouvre un groupe (« Pour la béchamel : »).</p>
          </div>
          <div className="field">
            <label htmlFor="recettes-steps">Étapes</label>
            <textarea id="recettes-steps" rows={8} value={f.steps} placeholder={'Faire revenir les oignons.\nAjouter la viande, cuire 20 minutes.'} onChange={(e) => set('steps', e.target.value)} />
            <p className="recettes-hint">Une par ligne ; Atlas les numérote.</p>
          </div>

          <div className="field">
            <span className="recettes-label">Photo</span>
            <div className="recettes-photo-field">
              {preview ? (
                <img className="recettes-cover recettes-photo-preview" src={preview} alt="Nouvelle photo" />
              ) : (
                <RecipeCover photo={showPhoto} category={f.category} size="thumb" alt="Photo de la recette" className="recettes-photo-preview" />
              )}
              <div className="recettes-photo-actions">
                <label className="btn btn-sm recettes-file">
                  {photo || file ? 'Changer la photo' : 'Ajouter une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setRemovePhoto(false);
                      e.target.value = '';
                    }}
                  />
                </label>
                {(file || (photo && !removePhoto)) && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setFile(null);
                      setRemovePhoto(!!photo);
                    }}
                  >
                    Retirer la photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <details className="recettes-more" open={!!(recipe?.note || recipe?.sourceUrl || recipe?.tags.length || draft?.sourceUrl)}>
            <summary>Source, étiquettes, note</summary>
            <div className="recettes-field-row">
              <div className="field">
                <label htmlFor="recettes-source-name">Source</label>
                <input id="recettes-source-name" value={f.sourceName} placeholder="Marmiton, un livre, Maman…" onChange={(e) => set('sourceName', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="recettes-source-url">Lien</label>
                <input id="recettes-source-url" value={f.sourceUrl} inputMode="url" placeholder="https://…" onChange={(e) => set('sourceUrl', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="recettes-tags">Étiquettes</label>
              <input id="recettes-tags" value={f.tags} placeholder="rapide, végétarien, batch cooking" onChange={(e) => set('tags', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="recettes-description">Description</label>
              <textarea id="recettes-description" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="recettes-note">Ma note</label>
              <textarea id="recettes-note" rows={2} value={f.note} placeholder="Doubler l’ail, moins de sel." onChange={(e) => set('note', e.target.value)} />
            </div>
          </details>
        </>
      )}
      {error && (
        <p className="recettes-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
