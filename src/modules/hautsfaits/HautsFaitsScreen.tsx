import { useCallback, useEffect, useMemo, useState } from 'react';
import { newId } from '../../core/data/coreStore';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { FeatEditor } from './components/FeatEditor';
import { FeatSheet } from './components/FeatSheet';
import { Timeline } from './components/Timeline';
import { hautsFaitsStore } from './data';
import { onSettingsChange } from './data/settingsSignal';
import { CATEGORY_INFO } from './lib/categories';
import { featYear } from './lib/dates';
import { draftFromFeat, emptyDraft, type FeatDraft } from './lib/editorDraft';
import { onThisDay, onThisDayLabel } from './lib/onThisDay';
import { remainingSuggestions, type Suggestion } from './lib/suggestions';
import { buildTimeline } from './lib/timeline';
import { DEFAULT_HAUTSFAITS_SETTINGS, FEAT_CATEGORIES, type Feat, type FeatCategory, type FeatInput, type HautsFaitsSettings } from './lib/types';

type Editing = { feat: Feat | null; draft: FeatDraft };

/**
 * Écran racine de Hauts faits : la frise (étape 3, docs/etude-hauts-faits.md
 * §4). Le plus récent en haut (décision du 29/09/2026). Les photos, la vie en
 * semaines et la vitrine viendront aux étapes 4 et 5.
 */
export function HautsFaitsScreen({ label, emoji, error, onError, onOpenSettings, onBackToHub, reloadToken }: ModuleScreenProps) {
  const [feats, setFeats] = useState<Feat[] | null>(null);
  const [settings, setSettings] = useState<HautsFaitsSettings>(DEFAULT_HAUTSFAITS_SETTINGS);
  const [category, setCategory] = useState<FeatCategory | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const today = dayString();

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
  }, [refresh, reloadToken]);

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
  const open = list.find((f) => f.id === openId) ?? null;
  const firstYear = list.length ? Math.min(...list.map(featYear)) : null;

  const startNew = (seed: Partial<Suggestion> = {}) => {
    setOpenId(null);
    setEditing({ feat: null, draft: emptyDraft(today, seed) });
  };

  async function save(input: FeatInput) {
    if (!editing) return;
    if (editing.feat) {
      await hautsFaitsStore.updateFeat(editing.feat.id, input);
      setOpenId(editing.feat.id);
    } else {
      const created = await hautsFaitsStore.createFeat(input, newId());
      setCategory(null);
      setJustAdded(created.id);
    }
    setEditing(null);
    await refresh();
  }

  async function remove(feat: Feat) {
    try {
      await hautsFaitsStore.deleteFeat(feat.id);
      setOpenId(null);
      await refresh();
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

            <Timeline rows={rows} birthDate={settings.birthDate} justAdded={justAdded} onOpen={(f) => setOpenId(f.id)} />
          </>
        )}
      </main>

      {open && !editing && (
        <FeatSheet
          feat={open}
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
    </div>
  );
}
