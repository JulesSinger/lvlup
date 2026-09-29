/**
 * Le thème de l'interface : sombre, clair, ou celui de l'appareil.
 *
 * Préférence de l'appareil, pas du compte — comme le son (`zenith.muted`) :
 * on peut vouloir du clair sur l'ordinateur du bureau et du sombre sur son
 * téléphone le soir. Elle vit donc dans `localStorage`, jamais en base.
 *
 * Le thème s'applique par `data-theme` sur `<html>` : les variables de
 * couleur de `core/styles/base.css` en dépendent. Un petit script dans
 * `index.html` fait la même chose avant le premier rendu, pour ne pas voir
 * l'app s'afficher en sombre puis basculer en clair — il recopie la règle
 * de `resolveTheme` et la clé : les deux doivent changer ensemble.
 */

/** Clé de stockage : un identifiant, jamais renommé (voir CLAUDE.md §4). */
export const THEME_KEY = 'atlas.theme.v1';

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = 'light' | 'dark';

/** Couleur de la barre du navigateur (`theme-color`), égale au fond `--bg`. */
export const THEME_BAR_COLORS: Record<Theme, string> = {
  dark: '#0b0e14',
  light: '#f4f5f9',
};

/**
 * Sans choix enregistré : sombre, le thème d'origine d'Atlas. Pas « Système »
 * tant que les modules n'ont pas tous été repris en clair (étape 2 du mode
 * clair) : un téléphone réglé en clair aurait basculé d'office sur des écrans
 * pas encore prêts. Le script d'`index.html` recopie ce défaut.
 */
export const DEFAULT_THEME_CHOICE: ThemeChoice = 'dark';

/** Une valeur inconnue ou absente revient au défaut. */
export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return (THEME_CHOICES as readonly string[]).includes(value ?? '')
    ? (value as ThemeChoice)
    : DEFAULT_THEME_CHOICE;
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME_CHOICE;
  }
}

export function saveThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Navigation privée : le choix vaut pour la session, sans plus.
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Pose le thème sur la page. `forced` l'impose, quel que soit le choix. */
export function applyTheme(choice: ThemeChoice = readThemeChoice(), forced?: Theme) {
  const theme = forced ?? resolveTheme(choice, systemPrefersDark());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLORS[theme]);
}

/**
 * Suit le réglage de l'appareil tant que le choix est « Système » : passer
 * l'iPhone en mode sombre le soir change l'app sans la recharger.
 */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (readThemeChoice() === 'system' && !document.documentElement.dataset.themeForced) applyTheme();
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
