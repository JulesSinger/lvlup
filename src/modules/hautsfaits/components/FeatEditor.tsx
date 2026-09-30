import { useEffect, useRef, useState } from 'react';
import { preparePhoto } from '../data/preparePhoto';
import { CATEGORY_INFO } from '../lib/categories';
import { formatFeatDate } from '../lib/dates';
import { dateDraftFrom, dateFromDraft, inputFromDraft, type FeatDraft } from '../lib/editorDraft';
import { takenDay } from '../lib/photos';
import { FEAT_CATEGORIES, FEAT_HIGHLIGHT_MAX, PHOTOS_MAX, type FeatInput, type PreparedPhoto } from '../lib/types';
import { validateFeat } from '../lib/validation';
import { DateField } from './DateField';
import { PhotoPicker } from './PhotoPicker';

interface Pending {
  key: string;
  photo: PreparedPhoto;
  preview: string;
}

/**
 * La fenêtre d'un haut fait, pour le créer ou le modifier. Un haut fait se
 * saisit rarement et à tête reposée : tout est sur une page, le titre et la
 * date d'abord, le reste facultatif ensuite.
 *
 * À la création, on peut déjà choisir ses photos : elles sont réduites tout
 * de suite (pour les montrer et lire leur date), et envoyées une fois le haut
 * fait enregistré — le haut fait d'abord, ses photos ensuite. La date de
 * prise de vue est PROPOSÉE, jamais imposée (étude §5.3).
 */
export function FeatEditor({
  initial,
  isNew,
  today,
  onSave,
  onCancel,
}: {
  initial: FeatDraft;
  isNew: boolean;
  today: string;
  onSave: (input: FeatInput, photos: PreparedPhoto[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [preparing, setPreparing] = useState(0);
  const set = (patch: Partial<FeatDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Les aperçus sont des adresses `blob:` : on les rend en fermant la fenêtre.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function pick(files: File[]) {
    const room = PHOTOS_MAX - pending.length;
    const taken = files.slice(0, room);
    setError(files.length > room ? `${PHOTOS_MAX} photos au plus : les autres n’ont pas été prises.` : '');
    setPreparing((n) => n + taken.length);
    for (const file of taken) {
      try {
        const photo = await preparePhoto(file);
        const preview = URL.createObjectURL(photo.thumb);
        previews.current.push(preview);
        setPending((list) => [...list, { key: preview, photo, preview }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Cette photo n’a pas pu être lue.');
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  }

  // La date d'une des photos, si elle dit autre chose que la date choisie.
  const photoDay = pending.map((p) => p.photo.takenAt).find(Boolean);
  const suggestedDay = photoDay ? takenDay(photoDay) : null;
  const showSuggestion = suggestedDay !== null && suggestedDay !== dateFromDraft(draft.start) && suggestedDay <= today;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const input = inputFromDraft(draft);
    const problem = typeof input === 'string' ? input : validateFeat(input, today);
    if (problem || typeof input === 'string') {
      setError(problem ?? '');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(
        input,
        pending.map((p) => p.photo),
      );
    } catch (err) {
      // Le formulaire reste rempli : rien de ce qui a été écrit n'est perdu.
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    // Un clic à côté ne ferme pas la fenêtre : il effacerait ce qui a été écrit (même règle que Flashcards).
    <div className="overlay">
      <form
        className="modal hautsfaits-editor"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nouveau haut fait' : 'Modifier le haut fait'}
        onSubmit={(e) => void submit(e)}
      >
        <div className="modal-head">
          <span className="modal-title">{isNew ? 'Nouveau haut fait' : 'Modifier le haut fait'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="hautsfaits-title">Titre</label>
            <input
              id="hautsfaits-title"
              autoFocus
              value={draft.title}
              placeholder="Semi-marathon de Paris, premier appartement…"
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          <div className="field">
            <label id="hautsfaits-category-label">Catégorie</label>
            <div className="hautsfaits-category-picker" role="group" aria-labelledby="hautsfaits-category-label">
              {FEAT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`hautsfaits-chip${draft.category === c ? ' on' : ''}`}
                  style={{ '--hautsfaits-c': CATEGORY_INFO[c].color } as React.CSSProperties}
                  aria-pressed={draft.category === c}
                  onClick={() => set({ category: c })}
                >
                  <span aria-hidden="true">{CATEGORY_INFO[c].emoji}</span> {CATEGORY_INFO[c].label}
                </button>
              ))}
            </div>
          </div>

          <DateField id="hautsfaits-start" label={draft.isPeriod ? 'Début' : 'Date'} value={draft.start} onChange={(start) => set({ start })} />
          {showSuggestion && suggestedDay && (
            <div className="hautsfaits-date-suggestion">
              <span aria-hidden="true">📷</span> Photo prise le {formatFeatDate(suggestedDay, 'day')}
              <button type="button" className="hautsfaits-link" onClick={() => set({ start: dateDraftFrom(suggestedDay, 'day') })}>
                Utiliser cette date
              </button>
            </div>
          )}

          <label className="switch hautsfaits-switch">
            <input
              type="checkbox"
              checked={draft.isPeriod}
              onChange={(e) => set({ isPeriod: e.target.checked, end: e.target.checked && !draft.isPeriod ? draft.start : draft.end })}
            />
            <span>C’est une période (six mois à l’étranger, trois ans d’école…)</span>
          </label>
          {draft.isPeriod && <DateField id="hautsfaits-end" label="Fin" value={draft.end} onChange={(end) => set({ end })} />}

          <label className="switch hautsfaits-switch">
            <input type="checkbox" checked={draft.major} onChange={(e) => set({ major: e.target.checked })} />
            <span>Un des grands : une grande carte dans la frise</span>
          </label>

          <div className="field">
            <label htmlFor="hautsfaits-highlight">Chiffre clé</label>
            <input
              id="hautsfaits-highlight"
              value={draft.highlight}
              maxLength={FEAT_HIGHLIGHT_MAX}
              placeholder="1 h 52 min, mention Bien, 42 m²…"
              onChange={(e) => set({ highlight: e.target.value })}
            />
            <div className="field-hint">Affiché en médaillon. Facultatif.</div>
          </div>

          <div className="hautsfaits-editor-pair">
            <div className="field">
              <label htmlFor="hautsfaits-place">Lieu</label>
              <input id="hautsfaits-place" value={draft.place} placeholder="Madrid" onChange={(e) => set({ place: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hautsfaits-people">Avec qui</label>
              <input id="hautsfaits-people" value={draft.people} placeholder="avec Léa et Tom" onChange={(e) => set({ people: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="hautsfaits-story">Le récit</label>
            <textarea
              id="hautsfaits-story"
              rows={4}
              value={draft.story}
              placeholder="Ce que tu ressentais, le détail que tu oublierais…"
              onChange={(e) => set({ story: e.target.value })}
            />
          </div>

          {isNew && (
            <div className="field">
              <label>Photos</label>
              {pending.length > 0 && (
                <ul className="hautsfaits-pending">
                  {pending.map((p) => (
                    <li key={p.key}>
                      <img src={p.preview} alt="" />
                      <button
                        type="button"
                        className="hautsfaits-pending-remove"
                        aria-label="Enlever cette photo"
                        onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pending.length < PHOTOS_MAX && <PhotoPicker label={pending.length ? '＋ Photos' : '＋ Choisir des photos'} disabled={saving} onPick={(files) => void pick(files)} />}
              <div className="field-hint">
                {preparing > 0
                  ? 'Préparation des photos…'
                  : 'Atlas en garde une copie allégée, sans la position GPS. L’original reste dans ton téléphone.'}
              </div>
            </div>
          )}

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || preparing > 0}>
            {isNew ? 'Graver' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
