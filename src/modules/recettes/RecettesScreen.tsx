import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { prepareImage } from '../../core/data/images/prepareImage';
import { dayString, shiftDay } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { CookedDialog } from './components/CookedDialog';
import { MenuView } from './components/MenuView';
import { PlanPicker } from './components/PlanPicker';
import { Notebook } from './components/Notebook';
import { RecipeEditor, type PhotoChange } from './components/RecipeEditor';
import { forgetPhoto } from './components/RecipePhotoImg';
import { RecipeSheet } from './components/RecipeSheet';
import { recettesStore as store } from './data';
import { canImportFromLink, importFromLink } from './data/importFromLink';
import { MEAL_LABELS } from './lib/calendarMarks';
import { weekdayLabel } from './lib/format';
import { nextPosition, weekDays } from './lib/menu';
import { DEFAULT_RECETTES_SETTINGS, type Cooked, type CookedInput, type Meal, type PlanEntry, type PlanEntryInput, type Recipe, type RecipeInput, type RecipePhoto, type RecettesSettings } from './lib/types';

/** Une photo réduite dans le navigateur avant tout envoi : 1 600 px et une vignette (étude §12). */
export const PHOTO_SIZES = { full: 1600, thumb: 600 };

type View = 'carnet' | 'menu';

/** La dernière vue ouverte, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'recettes.view.v1';

function savedView(): View {
  try {
    if (localStorage.getItem(VIEW_KEY) === 'menu') return 'menu';
  } catch {
    // Stockage refusé : le carnet suffit.
  }
  return 'carnet';
}

/**
 * Écran racine de Recettes (docs/etude-recettes.md §5, §15, §17) : le carnet,
 * le menu de la semaine, la fiche d'une recette, la fenêtre pour en ajouter.
 */
export function RecettesScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, label, emoji, intent }: ModuleScreenProps) {
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
  const [view, setViewState] = useState<View>(savedView);
  const [menuDay, setMenuDay] = useState(dayString());
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [picking, setPicking] = useState<{ day: string; meal: Meal } | 'recipe' | null>(null);
  const today = dayString();
  const week = weekDays(menuDay);

  const refresh = useCallback(async () => {
    try {
      const [nextRecipes, nextCooked, nextSettings, nextPlan] = await Promise.all([
        store.listRecipes(),
        store.listCooked(),
        store.getSettings(),
        store.listPlan(week[0], week[6]),
      ]);
      setRecipes(nextRecipes);
      setPlan(nextPlan);
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
    // La semaine affichée fait partie de ce qu'on relit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError, week[0]]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  function setView(next: View) {
    setViewState(next);
    setOpenId(null);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Sans stockage, la vue vaut pour cette visite.
    }
  }

  /**
   * Ouvert depuis Calendar (`onOpenModule('recettes', …)`) : « recipe:<id> »
   * la fiche, « menu » le menu. Une seule fois par intention.
   */
  const [intentDone, setIntentDone] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded || !intent || intentDone === intent) return;
    setIntentDone(intent);
    if (intent.startsWith('recipe:')) {
      const r = recipes.find((x) => x.id === intent.slice(7));
      if (r) {
        setOpenId(r.id);
        setServings(r.servings);
      }
    } else if (intent === 'menu') {
      setViewState('menu');
      setOpenId(null);
    }
  }, [loaded, intent, intentDone, recipes]);

  async function addToMenu(input: Omit<PlanEntryInput, 'position'>) {
    const sameDay = await store.listPlan(input.day, input.day);
    await store.addPlanEntry({ ...input, position: nextPosition(sameDay, input.day, input.meal) }, crypto.randomUUID());
    setPicking(null);
    if (input.day < week[0] || input.day > week[6]) setMenuDay(input.day);
    const what = input.recipeId ? (recipes.find((r) => r.id === input.recipeId)?.title ?? '') : input.title;
    setNotice(`Au menu : ${what}, ${MEAL_LABELS[input.meal].toLowerCase()} du ${weekdayLabel(input.day)}.`);
    await refresh();
  }

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

        {loaded && !open && (
          <nav className="recettes-nav" aria-label="Vues">
            {(
              [
                ['carnet', 'Carnet', recipes.length],
                ['menu', 'Menu de la semaine', 0],
              ] as const
            ).map(([id, text, n]) => (
              <button key={id} type="button" className={`recettes-nav-item${view === id ? ' on' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
                {text}
                {n > 0 && <span className="recettes-count">{n}</span>}
              </button>
            ))}
          </nav>
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
            actions={
              <button type="button" className="btn btn-sm" onClick={() => setPicking('recipe')}>
                📅 Au menu
              </button>
            }
          />
        ) : view === 'menu' ? (
          <MenuView
            day={menuDay}
            today={today}
            entries={plan}
            recipes={recipes}
            onWeek={(delta) => setMenuDay((d) => shiftDay(d, 7 * delta))}
            onToday={() => setMenuDay(today)}
            onAdd={(day, meal) => setPicking({ day, meal })}
            onOpen={openRecipe}
            onRemove={(e) => void write(() => store.deletePlanEntry(e.id))}
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
        {picking && (
          <PlanPicker
            recipes={recipes}
            recipe={picking === 'recipe' && open ? open : undefined}
            slot={picking !== 'recipe' ? picking : undefined}
            today={today}
            servings={picking === 'recipe' ? servings : null}
            onAdd={addToMenu}
            onClose={() => setPicking(null)}
          />
        )}
        {cooking && open && (
          <CookedDialog recipeId={open.id} title={open.title} today={today} servings={servings} onSave={addCooked} onClose={() => setCooking(false)} />
        )}
      </main>
    </div>
  );
}
