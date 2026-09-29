import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME_CHOICE, THEME_BAR_COLORS, THEME_KEY, parseThemeChoice, resolveTheme } from './theme';

describe('parseThemeChoice', () => {
  test('garde un choix connu', () => {
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('system')).toBe('system');
  });

  test('revient au défaut, sombre, pour une valeur absente ou inconnue', () => {
    expect(DEFAULT_THEME_CHOICE).toBe('dark');
    expect(parseThemeChoice(null)).toBe('dark');
    expect(parseThemeChoice('sepia')).toBe('dark');
  });
});

describe('resolveTheme', () => {
  test('« Système » suit l’appareil', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  test('un choix explicite l’emporte sur l’appareil', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

// Le script d'index.html recopie la clé et la couleur de barre : s'ils
// divergent, l'app s'affiche d'abord dans le mauvais thème.
describe('le script de démarrage d’index.html', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

  test('lit la même clé', () => {
    expect(html).toContain(`'${THEME_KEY}'`);
  });

  test('a le même défaut', () => {
    expect(html).toContain(`|| '${DEFAULT_THEME_CHOICE}'`);
  });

  test('pose les mêmes couleurs de barre', () => {
    expect(html).toContain(THEME_BAR_COLORS.light);
    expect(html).toContain(THEME_BAR_COLORS.dark);
  });
});
