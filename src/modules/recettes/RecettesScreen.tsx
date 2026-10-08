import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { prepareImage } from '../../core/data/images/prepareImage';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { CookedDialog } from './components/CookedDialog';
import { Notebook } from './components/Notebook';
import { RecipeEditor, type PhotoChange } from './components/RecipeEditor';
import { forgetPhoto } from './components/RecipePhotoImg';
import { RecipeSheet } from './components/RecipeSheet';
import { recettesStore as store } from './data';
import { canImportFromLink, importFromLink } from './data/importFromLink';
import { DEFAULT_RECETTES_SETTINGS, type Cooked, type CookedInput, type Recipe, type RecipeInput, type RecipePhoto, type RecettesSettings } from './lib/types';

/** Une photo réduite dans le navigateur avant tout envoi : 1 600 px et une vignette (étude §12). */
export const PHOTO_SIZES = { full: 1600, thumb: 600 };

/**
 * Écran racine de Recettes (docs/etude-recettes.md §5, §15) : le carnet, la
 * fiche d'une recette, la fenêtre pour en ajouter une.
 */
export function RecettesScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, label, emoji }: ModuleScreenProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [photos, setPhotos] = useState<RecipePhoto[]>([]);
  const [cooked, setCooked] = useState<Cooked[]>([]);
  const [settings, setSettings] = useState<RecettesSettings>({ ...DEFAULT_RECETTES_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [cooking, setCooking] = useState(false);
  const [notice, setNotice] = useState('');
  const today = dayString();

  const refresh = useCallback(async () => {
    try {
      const [nextRecipes, nextCooked, nextSettings] = await Promise.all([store.listRecipes(), store.listCooked(), store.getSettings()]);
      setRecipes(nextRecipes);
      setCooked(nextCooked);
      setSettings(nextSettings);
      // Les photos à part : un bucket ou une table manquante n'empêche pas le carnet.
      setPhotos(await store.listPhotos().catch(() => []));
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  const open = useMemo(() => recipes.find((r) => r.id === openId) ?? null, [recipes, openId]);
  const photoOf = (id: string) => photos.find((p) => p.recipeId === id) ?? null;

  function openRecipe(r: Recipe) {
    setOpenId(r.id);
    setServings(r.servings);
    window.scrollTo?.({ top: 0 });
  }

  async function write(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
    await refresh();
  }

  /** La recette d'abord, la photo ensuite : une photo qui échoue ne fait jamais perdre la recette. */
  async function save(input: RecipeInput, photo: PhotoChange) {
    const current = editing && editing !== 'new' ? editing : null;
    let id: string;
    if (current) {
      await store.updateRecipe(current.id, input);
      id = current.id;
    } else {
      id = (await store.createRecipe(input, crypto.randomUUID())).id;
    }
    setEditing(null);
    setNotice('');
    try {
      const existing = photoOf(id);
      if (photo.file) {
        const prepared = await prepareImage(photo.file, PHOTO_SIZES);
        await store.setPhoto(id, prepared);
        if (existing) forgetPhoto(existing);
      } else if (photo.remove && existing) {
        await store.removePhoto(existing);
        forgetPhoto(existing);
      }
    } catch (err) {
      setNotice(`La recette est enregistrée, mais pas la photo : ${err instanceof Error ? err.message : 'erreur inconnue'}.`);
    }
    await refresh();
    if (!current) {
      setOpenId(id);
      setServings(input.servings ?? null);
    }
  }

  async function addCooked(input: CookedInput) {
    await store.addCooked(input, crypto.randomUUID());
    setCooking(false);
    await refresh();
  }

  return (
    <div className="layout">
      <main className="main recettes-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button className="btn topbar-settings" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span className="topbar-settings-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="topbar-settings-label">Réglages</span>
            </button>
            <button className="btn btn-primary topbar-add" onClick={() => setEditing('new')} aria-label="Nouvelle recette">
              <span aria-hidden="true">+</span>
              <span className="topbar-add-label">Recette</span>
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
        {notice && (
          <div className="notice info" role="status">
            {notice}
          </div>
        )}

        {!loaded ? null : open ? (
          <RecipeSheet
            recipe={open}
            photo={photoOf(open.id)}
            cooked={cooked}
            today={today}
            servings={servings}
            onServings={setServings}
            onBack={() => setOpenId(null)}
            onEdit={() => setEditing(open)}
            onFavorite={() => void write(() => store.updateRecipe(open.id, { favorite: !open.favorite }))}
            onDelete={() => {
              const photo = photoOf(open.id);
              setOpenId(null);
              void write(async () => {
                await store.deleteRecipe(open.id);
                if (photo) forgetPhoto(photo);
              });
            }}
            onCooked={() => setCooking(true)}
            onDeleteCooked={(c) => void write(() => store.deleteCooked(c.id))}
          />
        ) : recipes.length === 0 ? (
          <div className="recettes-empty">
            <span className="recettes-empty-emoji" aria-hidden="true">
              {emoji}
            </span>
            <h1 className="recettes-empty-title">Ton carnet est vide</h1>
            <p className="recettes-hint">Tape une recette, ou colle-la depuis un message, un PDF, Instagram : Atlas sépare les ingrédients des étapes.</p>
            <div className="recettes-empty-actions">
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                Ajouter une recette
              </button>
            </div>
          </div>
        ) : (
          <Notebook recipes={recipes} photos={photos} cooked={cooked} pantry={settings.pantry} onOpen={openRecipe} />
        )}

        {editing && (
          <RecipeEditor
            recipe={editing === 'new' ? null : editing}
            photo={editing === 'new' ? null : photoOf(editing.id)}
            onSave={save}
            onClose={() => setEditing(null)}
            onImportLink={canImportFromLink ? importFromLink : null}
          />
        )}
        {cooking && open && (
          <CookedDialog recipeId={open.id} title={open.title} today={today} servings={servings} onSave={addCooked} onClose={() => setCooking(false)} />
        )}
      </main>
    </div>
  );
}
