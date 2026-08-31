import { useCallback, useEffect, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import { CategoryEditor } from './components/CategoryEditor';
import { EnvelopesScreen } from './components/EnvelopesScreen';
import { ImportScreen } from './components/ImportScreen';
import { MonthScreen } from './components/MonthScreen';
import { budgetStore } from './data';
import { BUDGET_CATEGORY_KINDS, CATEGORY_KIND_LABELS } from './lib/types';
import type { BudgetCategory, BudgetCategoryInput, BudgetCategoryKind } from './lib/types';
import { STARTER_CATEGORIES } from './lib/starterCategories';

/** Ordre des groupes — voir docs/etude-astra.md §2 pour le rôle de `kind`. */
const GROUPS: { kind: BudgetCategoryKind; label: string }[] = BUDGET_CATEGORY_KINDS.map((kind) => ({
  kind,
  label: CATEGORY_KIND_LABELS[kind],
}));

type View = 'categories' | 'month' | 'import' | 'epargne';

/**
 * Écran racine d'Astra. Depuis l'étape 4 (docs/etude-astra.md §7), « la V1
 * est atteinte » : l'onglet Opérations de l'étape 3 devient l'onglet
 * « Aperçu » — camembert, total et sélecteur de mois, avec la liste des
 * opérations toujours en dessous (§5). « Mois » nommait bien son contenu
 * mais rien de sa fonction ; « Aperçu » dit que c'est l'écran qu'on regarde
 * d'abord — et c'est l'onglet par défaut, en premier dans la barre : c'est
 * lui qui répond à la question qu'on se pose en ouvrant Astra (« où en est
 * mon mois ? »). Depuis l'étape 5, un onglet « Importer » : « l'usage
 * devient tenable dans la durée » (§7) une fois que le relevé mensuel se
 * dépose en quelques clics plutôt que de se ressaisir ligne à ligne. Un
 * onglet « Épargne » porte le chantier des enveloppes
 * (docs/etude-astra-epargne.md) : le total mis de côté, réparti sur des
 * enveloppes dynamiques.
 *
 * Ordre des onglets réajusté après la V1 (retour de Jules, voir CLAUDE.md
 * §8) : Épargne passe en deuxième position — un usage régulier, à côté
 * d'Aperçu — et Catégories, un réglage qu'on ne rouvre qu'occasionnellement
 * une fois les catégories de départ chargées, passe en dernier.
 */
export function BudgetScreen({ error, onError, onOpenSettings, onBackToHub, reloadToken }: ModuleScreenProps) {
  const [view, setView] = useState<View>('month');
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStarter, setLoadingStarter] = useState(false);
  /** `null` = fermé, `'new'` = création, une catégorie = édition. */
  const [editing, setEditing] = useState<BudgetCategory | 'new' | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCategories(await budgetStore.listCategories());
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken) : le
  // hub ne sait pas relire les données d'un module, c'est à lui de le faire.
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, reloadToken]);

  async function loadStarterCategories() {
    setLoadingStarter(true);
    try {
      for (const input of STARTER_CATEGORIES) {
        await budgetStore.createCategory(input);
      }
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoadingStarter(false);
    }
  }

  async function saveCategory(input: BudgetCategoryInput) {
    if (editing !== null && editing !== 'new') {
      await budgetStore.updateCategory(editing.id, input);
    } else {
      await budgetStore.createCategory(input);
    }
    setEditing(null);
    await refresh();
  }

  async function removeCategory(category: BudgetCategory) {
    if (!window.confirm(`Supprimer « ${category.name} » ? Les écritures déjà rangées dedans redeviendront « à classer ».`))
      return;
    try {
      await budgetStore.deleteCategory(category.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  const byKind = (kind: BudgetCategoryKind) =>
    categories.filter((c) => c.kind === kind).sort((a, b) => a.position - b.position);

  return (
    <div className="layout">
      <main className="main budget-main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">✦</span>
            <span className="brand-name">Astra</span>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={onBackToHub}>
              ← Modules
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
              ⚙ Réglages
            </button>
          </div>
        </header>

        <nav className="budget-tabs" aria-label="Sections d'Astra">
          <button
            className={`budget-tab${view === 'month' ? ' active' : ''}`}
            onClick={() => setView('month')}
          >
            Aperçu
          </button>
          <button
            className={`budget-tab${view === 'epargne' ? ' active' : ''}`}
            onClick={() => setView('epargne')}
          >
            Épargne
          </button>
          <button
            className={`budget-tab${view === 'import' ? ' active' : ''}`}
            onClick={() => setView('import')}
          >
            Importer
          </button>
          <button
            className={`budget-tab${view === 'categories' ? ' active' : ''}`}
            onClick={() => setView('categories')}
          >
            Catégories
          </button>
        </nav>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        {view === 'import' ? null : view === 'month' ? (
          <MonthScreen categories={categories} onError={onError} reloadToken={reloadToken} />
        ) : view === 'epargne' ? (
          <EnvelopesScreen categories={categories} onError={onError} reloadToken={reloadToken} />
        ) : loading ? (
          <p>Chargement…</p>
        ) : categories.length === 0 ? (
          <div className="empty">
            <h3>Aucune catégorie pour l'instant</h3>
            <p>
              Une catégorie porte un nom, un emoji, une couleur et une nature — fixe, variable,
              revenu ou transfert. C'est elle qui range chaque écriture et compose le camembert du
              mois.
            </p>
            <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                Créer ma première catégorie
              </button>
              <button className="btn" onClick={() => void loadStarterCategories()} disabled={loadingStarter}>
                {loadingStarter ? 'Chargement…' : 'Charger les catégories de départ'}
              </button>
            </div>
          </div>
        ) : (
          <div className="budget-categories">
            {GROUPS.map(({ kind, label }) => {
              const items = byKind(kind);
              if (items.length === 0) return null;
              return (
                <section key={kind} className="budget-group">
                  <h2 className="budget-group-title">{label}</h2>
                  <ul className="budget-list">
                    {items.map((category) => (
                      <li key={category.id} className="budget-row budget-category-row">
                        <span
                          className="budget-row-swatch"
                          style={{ background: category.color }}
                          aria-hidden="true"
                        >
                          {category.emoji}
                        </span>
                        <span className="budget-row-name">{category.name}</span>
                        <span className="budget-row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(category)}>
                            Modifier
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-danger"
                            onClick={() => void removeCategory(category)}
                          >
                            Supprimer
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            <button
              className="btn btn-primary budget-add"
              onClick={() => setEditing('new')}
              title="Nouvelle catégorie"
              aria-label="Nouvelle catégorie"
            >
              <span className="budget-add-icon" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Toujours monté, simplement masqué en dehors de l'onglet Importer —
            contrairement à Aperçu et Catégories, l'écran d'import porte un
            aperçu en cours (choix de catégorie par ligne, case « créer une
            règle ») ou une confirmation qui n'ont pas de source de vérité
            ailleurs que dans ImportScreen : le démonter en changeant d'onglet
            effaçait tout ce travail. Rapporté par l'utilisateur. */}
        <div hidden={view !== 'import'}>
          <ImportScreen categories={categories} onError={onError} />
        </div>

        {editing !== null && (
          <CategoryEditor
            category={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={saveCategory}
          />
        )}
      </main>
    </div>
  );
}
