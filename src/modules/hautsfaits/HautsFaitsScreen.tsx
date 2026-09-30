import { useCallback, useEffect, useMemo, useState } from 'react';
import { newId } from '../../core/data/coreStore';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { FeatEditor } from './components/FeatEditor';
import { FeatSheet } from './components/FeatSheet';
import { Timeline } from './components/Timeline';
import { forgetPhoto } from './components/PhotoImg';
import { hautsFaitsStore } from './data';
import { preparePhoto } from './data/preparePhoto';
import { onSettingsChange } from './data/settingsSignal';
import { CATEGORY_INFO } from './lib/categories';
import { featYear } from './lib/dates';
import { draftFromFeat, emptyDraft, type FeatDraft } from './lib/editorDraft';
import { onThisDay, onThisDayLabel } from './lib/onThisDay';
import { coverPositions, photosByFeat } from './lib/photos';
import { remainingSuggestions, type Suggestion } from './lib/suggestions';
import { buildTimeline } from './lib/timeline';
import {
  DEFAULT_HAUTSFAITS_SETTINGS,
  FEAT_CATEGORIES,
  PHOTOS_MAX,
  type Feat,
  type FeatCategory,
  type FeatInput,
  type FeatPhoto,
  type HautsFaitsSettings,
  type PreparedPhoto,
} from './lib/types';

type Editing = { feat: Feat | null; draft: FeatDraft };

/**
 * Écran racine de Hauts faits : la frise (étape 3, docs/etude-hauts-faits.md
 * §4), avec ses photos depuis l'étape 4. Le plus récent en haut (décision du
 * 29/09/2026). La vie en semaines et la vitrine viendront à l'étape 5.
 */
export function HautsFaitsScreen({ label, emoji, error, onError, onOpenSettings, onBackToHub, reloadToken }: ModuleScreenProps) {
  const [feats, setFeats] = useState<Feat[] | null>(null);
  const [settings, setSettings] = useState<HautsFaitsSettings>(DEFAULT_HAUTSFAITS_SETTINGS);
  const [category, setCategory] = useState<FeatCategory | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [photos, setPhotos] = useState<FeatPhoto[]>([]);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const today = dayString();

  // Les photos se chargent à part : si elles échouent (migration pas encore
  // appliquée, stockage indisponible), la frise, elle, s'affiche quand même.
  const refreshPhotos = useCallback(async () => {
    try {
      setPhotos(await hautsFaitsStore.listPhotos());
    } catch (err) {
      onError(`Les photos n’ont pas pu être chargées${err instanceof Error ? ` : ${err.message}` : '.'}`);
    }
  }, [onError]);

  const refresh = useCallback(async () => {
    try {
      const [list, loaded] = await Promise.all([hautsFaitsStore.listFeats(), hautsFaitsStore.getSettings()]);
      setFeats(list);
      setSettings(loaded);
    } catch (err) {
      setFeats((current) => current ?? []);
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
    void refreshPhotos();
  }, [refresh, refreshPhotos, reloadToken]);

  // La date de naissance se règle dans le panneau commun, l'écran restant ouvert derrière.
  useEffect(() => onSettingsChange(setSettings), []);

  // Le haut fait tout juste gravé : on l'amène à l'écran, puis l'éclat retombe.
  useEffect(() => {
    if (!justAdded) return;
    document.querySelector(`[data-feat="${justAdded}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setJustAdded(null), 2600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const list = feats ?? [];
  const presentCategories = useMemo(() => FEAT_CATEGORIES.filter((c) => list.some((f) => f.category === c)), [list]);
  const shownCategory = category && presentCategories.includes(category) ? category : null;
  const rows = useMemo(() => buildTimeline(list, { birthDate: settings.birthDate, category: shownCategory }), [list, settings.birthDate, shownCategory]);
  const memories = useMemo(() => onThisDay(list, today), [list, today]);
  const suggestions = useMemo(() => remainingSuggestions(list.map((f) => f.title)), [list]);
  const byFeat = useMemo(() => photosByFeat(photos), [photos]);
  const open = list.find((f) => f.id === openId) ?? null;
  const firstYear = list.length ? Math.min(...list.map(featYear)) : null;

  const startNew = (seed: Partial<Suggestion> = {}) => {
    setOpenId(null);
    setEditing({ feat: null, draft: emptyDraft(today, seed) });
  };

  async function save(input: FeatInput, prepared: PreparedPhoto[]) {
    if (!editing) return;
    if (editing.feat) {
      await hautsFaitsStore.updateFeat(editing.feat.id, input);
      setOpenId(editing.feat.id);
      setEditing(null);
      await refresh();
      return;
    }
    // Le haut fait d'abord, enregistré et montré ; ses photos partent ensuite.
    const created = await hautsFaitsStore.createFeat(input, newId());
    setCategory(null);
    setJustAdded(created.id);
    setEditing(null);
    await refresh();
    if (prepared.length) await sendPhotos(created.id, prepared, 0);
  }

  /**
   * Envoie des photos une à une, en disant où on en est. Une photo qui échoue
   * n'arrête pas les suivantes ; le message dit combien sont restées.
   */
  async function sendPhotos(featId: string, prepared: PreparedPhoto[], firstPosition: number) {
    setUpload({ done: 0, total: prepared.length });
    let failed = 0;
    let reason = '';
    for (const [i, photo] of prepared.entries()) {
      try {
        await hautsFaitsStore.addPhoto(featId, photo, firstPosition + i, newId());
      } catch (err) {
        failed++;
        reason = err instanceof Error ? err.message : '';
      }
      setUpload({ done: i + 1, total: prepared.length });
    }
    setUpload(null);
    await refreshPhotos();
    if (failed) onError(`${failed} photo${failed > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${failed > 1 ? 's' : ''}. ${reason}`.trim());
  }

  async function addFiles(feat: Feat, files: File[]) {
    const existing = byFeat.get(feat.id) ?? [];
    const room = PHOTOS_MAX - existing.length;
    const prepared: PreparedPhoto[] = [];
    setUpload({ done: 0, total: Math.min(room, files.length) });
    for (const file of files.slice(0, room)) {
      try {
        prepared.push(await preparePhoto(file));
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Une photo n’a pas pu être lue.');
      }
    }
    if (files.length > room) onError(`${PHOTOS_MAX} photos au plus par haut fait : les autres n’ont pas été prises.`);
    const next = existing.length ? Math.max(...existing.map((p) => p.position)) + 1 : 0;
    if (prepared.length) await sendPhotos(feat.id, prepared, next);
    else setUpload(null);
  }

  async function makeCover(photo: FeatPhoto) {
    try {
      await hautsFaitsStore.setPhotoPositions(coverPositions(byFeat.get(photo.featId) ?? [], photo.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'La couverture n’a pas pu changer.');
    }
    await refreshPhotos();
  }

  async function removePhoto(photo: FeatPhoto) {
    try {
      await hautsFaitsStore.removePhoto(photo);
      forgetPhoto(photo);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'La photo n’a pas pu être retirée.');
    }
    await refreshPhotos();
  }

  async function remove(feat: Feat) {
    try {
      await hautsFaitsStore.deleteFeat(feat.id);
      for (const photo of byFeat.get(feat.id) ?? []) forgetPhoto(photo);
      setOpenId(null);
      await Promise.all([refresh(), refreshPhotos()]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="layout">
      <main className="main hautsfaits-main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">{emoji}</span>
            <span className="brand-name">{label}</span>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm hautsfaits-topbar-btn" onClick={onBackToHub} title="Modules" aria-label="Modules">
              <span aria-hidden="true">←</span>
              <span className="hautsfaits-topbar-label">Modules</span>
            </button>
            <button className="btn btn-ghost btn-sm hautsfaits-topbar-btn" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span aria-hidden="true">⚙</span>
              <span className="hautsfaits-topbar-label">Réglages</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        {feats === null ? null : list.length === 0 ? (
          <section className="hautsfaits-empty">
            <span className="hautsfaits-empty-emblem" aria-hidden="true">
              {emoji}
            </span>
            <h1 className="hautsfaits-empty-title">Tes grands moments, en frise</h1>
            <p className="hautsfaits-empty-text">
              Le brevet, un premier semi, six mois à l’étranger… Commence par ce qui te vient, même d’il y a longtemps : l’année
              suffit quand on ne sait plus le jour.
            </p>
            <div className="hautsfaits-ideas" aria-label="Des idées pour commencer">
              {suggestions.map((s) => (
                <button key={s.title} className="hautsfaits-idea" onClick={() => startNew(s)}>
                  <span aria-hidden="true">{CATEGORY_INFO[s.category].emoji}</span> {s.title}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => startNew()}>
              ＋ Autre chose
            </button>
          </section>
        ) : (
          <>
            <div className="hautsfaits-head">
              <p className="hautsfaits-count">
                {list.length} haut{list.length > 1 ? 's' : ''} fait{list.length > 1 ? 's' : ''}
                {firstYear !== null && <> · depuis {firstYear}</>}
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => startNew()}>
                ＋ Haut fait
              </button>
            </div>

            {memories.length > 0 && (
              <button className="hautsfaits-memory" onClick={() => setOpenId(memories[0].feat.id)}>
                <span className="hautsfaits-memory-spark" aria-hidden="true">
                  ✨
                </span>
                <span>
                  <small>
                    Ce jour-là · {onThisDayLabel(memories[0])}
                    {memories.length > 1 && ` · et ${memories.length - 1} autre${memories.length > 2 ? 's' : ''}`}
                  </small>
                  <strong>{memories[0].feat.title}</strong>
                </span>
              </button>
            )}

            {presentCategories.length > 1 && (
              <div className="hautsfaits-filters" role="group" aria-label="Filtrer par catégorie">
                <button className={`hautsfaits-chip${shownCategory === null ? ' on' : ''}`} aria-pressed={shownCategory === null} onClick={() => setCategory(null)}>
                  Tout
                </button>
                {presentCategories.map((c) => (
                  <button
                    key={c}
                    className={`hautsfaits-chip${shownCategory === c ? ' on' : ''}`}
                    style={{ '--hautsfaits-c': CATEGORY_INFO[c].color } as React.CSSProperties}
                    aria-pressed={shownCategory === c}
                    onClick={() => setCategory(shownCategory === c ? null : c)}
                  >
                    <span aria-hidden="true">{CATEGORY_INFO[c].emoji}</span> {CATEGORY_INFO[c].label}
                  </button>
                ))}
              </div>
            )}

            <Timeline rows={rows} photos={byFeat} birthDate={settings.birthDate} justAdded={justAdded} onOpen={(f) => setOpenId(f.id)} />
          </>
        )}
      </main>

      {open && !editing && (
        <FeatSheet
          feat={open}
          photos={byFeat.get(open.id) ?? []}
          uploading={upload !== null}
          onAddPhotos={(files) => void addFiles(open, files)}
          onMakeCover={(photo) => void makeCover(photo)}
          onRemovePhoto={(photo) => void removePhoto(photo)}
          birthDate={settings.birthDate}
          today={today}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing({ feat: open, draft: draftFromFeat(open) })}
          onDelete={() => remove(open)}
          onAddBirthDate={() => {
            setOpenId(null);
            onOpenSettings();
          }}
        />
      )}

      {editing && (
        <FeatEditor
          initial={editing.draft}
          isNew={editing.feat === null}
          today={today}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {upload && (
        <div className="hautsfaits-toast" role="status">
          <span className="hautsfaits-toast-spinner" aria-hidden="true" />
          {upload.done < upload.total ? `Ajout des photos : ${upload.done} / ${upload.total}` : 'Photos ajoutées'}
        </div>
      )}
    </div>
  );
}
