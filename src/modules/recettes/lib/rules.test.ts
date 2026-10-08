import { describe, expect, it } from 'vitest';
import { formatMinutes, parseIsoDuration, totalMinutes } from './duration';
import { factorFor, isPantry, nextPosition, shoppingLines, slot, weekDays } from './menu';
import { parsePastedRecipe, readServings } from './pasteText';
import { NO_FILTERS, cookedSummary, searchRecipes, withWhatIHave } from './search';
import { findTimers, formatClock } from './timers';
import { DEFAULT_PANTRY, type PlanEntry, type Recipe } from './types';

let n = 0;
const recipe = (title: string, ingredients: string[], extra: Partial<Recipe> = {}): Recipe => ({
  id: `r${n++}`,
  title,
  description: '',
  servings: 4,
  yieldLabel: 'personnes',
  prepMinutes: 10,
  cookMinutes: 20,
  restMinutes: null,
  category: 'plat',
  tags: [],
  sourceUrl: null,
  sourceName: '',
  note: '',
  favorite: false,
  ingredients: ingredients.map((text) => ({ text, section: null })),
  steps: [],
  createdAt: '',
  updatedAt: '',
  ...extra,
});

describe('les durées', () => {
  it('lit l’ISO 8601 des sites', () => {
    expect(parseIsoDuration('PT1H35M')).toBe(95);
    expect(parseIsoDuration('PT30M')).toBe(30);
    expect(parseIsoDuration('P1DT2H')).toBe(1560);
    expect(parseIsoDuration('PT')).toBeNull();
    expect(parseIsoDuration('30 min')).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });

  it('les dit en français', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(95)).toBe('1 h 35');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(3000)).toBe('2 j 2 h');
    expect(totalMinutes({ prepMinutes: 30, cookMinutes: 95, restMinutes: null })).toBe(125);
    expect(totalMinutes({ prepMinutes: null, cookMinutes: null, restMinutes: null })).toBeNull();
  });
});

describe('les minuteurs d’une étape', () => {
  it('trouve les durées écrites de plusieurs façons', () => {
    const t = (s: string) => findTimers(s).map((x) => [x.label, x.seconds]);
    expect(t('Enfourner 25 minutes à 180°C.')).toEqual([['25 minutes', 1500]]);
    expect(t('Laisser mijoter 1 h 30, puis 10 min à couvert.')).toEqual([
      ['1 h 30', 5400],
      ['10 min', 600],
    ]);
    expect(t('Cuire 20 à 25 min')).toEqual([['20 à 25 min', 1200]]);
    expect(t('Réserver 2 heures au frais')).toEqual([['2 heures', 7200]]);
    expect(t('Faire revenir pendant 5 mn.')).toEqual([['5 mn', 300]]);
    expect(t('Couper 3 oignons et 200 g de lardons')).toEqual([]);
    expect(t('Préchauffer le four à 180°C (thermostat 6).')).toEqual([]);
  });

  it('écrit un minuteur', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(5400)).toBe('1:30:00');
    expect(formatClock(59)).toBe('0:59');
  });
});

describe('une recette collée en texte', () => {
  it('avec ses titres de partie', () => {
    const r = parsePastedRecipe(`Crêpes de Mamie
Pour 4 personnes
Ingrédients :
- 250 g de farine
- 4 oeufs
- 50 cl de lait
Pour le nappage :
- 50 g de sucre
Préparation :
1. Mettre la farine dans un saladier.
2. Ajouter les oeufs, puis le lait petit à petit.`);
    expect(r.title).toBe('Crêpes de Mamie');
    expect(r.servings).toBe(4);
    expect(r.ingredients.map((i) => [i.text, i.section])).toEqual([
      ['250 g de farine', null],
      ['4 oeufs', null],
      ['50 cl de lait', null],
      ['50 g de sucre', 'Pour le nappage'],
    ]);
    expect(r.steps.map((s) => s.text)).toEqual(['Mettre la farine dans un saladier.', 'Ajouter les oeufs, puis le lait petit à petit.']);
  });

  it('sans titres de partie : les quantités font les ingrédients, le reste les étapes', () => {
    const r = parsePastedRecipe(`Pâtes au pesto
200 g de pâtes
2 c. à s. de pesto
parmesan
Faire cuire les pâtes 10 minutes dans l'eau bouillante salée.
Égoutter, mélanger au pesto et servir avec le parmesan râpé.`);
    expect(r.title).toBe('Pâtes au pesto');
    expect(r.ingredients.map((i) => i.text)).toEqual(['200 g de pâtes', '2 c. à s. de pesto']);
    // « parmesan », sans quantité ni puce, ne se devine pas : il part dans les étapes, à corriger.
    expect(r.steps).toHaveLength(3);
  });

  it('lit un nombre de personnes ou de pièces', () => {
    expect(readServings('Pour 6 personnes')).toEqual({ servings: 6, yieldLabel: 'personnes' });
    expect(readServings('12 crêpes')).toEqual({ servings: 12, yieldLabel: 'crêpes' });
    expect(readServings('4 pers.')).toEqual({ servings: 4, yieldLabel: 'personnes' });
    expect(readServings('Cuire 20 minutes')).toBeNull();
  });
});

describe('retrouver une recette', () => {
  const lasagnes = recipe('Lasagnes à la bolognaise', ['600 g de boeuf haché', '1 l de lait', 'sel'], { tags: ['batch cooking'], cookMinutes: 95, favorite: true });
  const curry = recipe('Curry de lentilles', ['200 g de lentilles corail', '1 courgette', '40 cl de lait de coco'], { category: 'plat' });
  const tarte = recipe('Tarte aux pommes', ['1 pâte brisée', '6 pommes Golden'], { category: 'dessert', prepMinutes: null, cookMinutes: null });
  const all = [lasagnes, curry, tarte];

  it('par titre, ingrédient ou étiquette, sans accents ni casse', () => {
    expect(searchRecipes(all, { ...NO_FILTERS, query: 'BOLOGNAISE' }).map((r) => r.title)).toEqual(['Lasagnes à la bolognaise']);
    expect(searchRecipes(all, { ...NO_FILTERS, query: 'lait' }).map((r) => r.title)).toEqual(['Lasagnes à la bolognaise', 'Curry de lentilles']);
    expect(searchRecipes(all, { ...NO_FILTERS, query: 'batch' })).toEqual([lasagnes]);
    expect(searchRecipes(all, { ...NO_FILTERS, query: 'lait coco' })).toEqual([curry]);
  });

  it('par filtres : catégorie, temps, favoris, jamais faite', () => {
    expect(searchRecipes(all, { ...NO_FILTERS, category: 'dessert' })).toEqual([tarte]);
    // Une recette sans temps n'entre pas dans « moins de 30 min ».
    expect(searchRecipes(all, { ...NO_FILTERS, maxMinutes: 30 })).toEqual([curry]);
    expect(searchRecipes(all, { ...NO_FILTERS, favorites: true })).toEqual([lasagnes]);
    const cooked = [{ id: 'c', recipeId: curry.id, day: '2026-10-01', servings: 2, rating: 4, comment: '', createdAt: '' }];
    expect(searchRecipes(all, { ...NO_FILTERS, neverCooked: true }, cooked)).toEqual([lasagnes, tarte]);
  });

  it('« avec ce que j’ai » classe par ingrédients trouvés', () => {
    const r = withWhatIHave(all, 'courgette, lait', DEFAULT_PANTRY);
    expect(r.map((m) => [m.recipe.title, m.found.length])).toEqual([
      ['Curry de lentilles', 2],
      ['Lasagnes à la bolognaise', 1],
    ]);
    // Le sel est « toujours là » : il ne manque pas.
    expect(r[1].missing).toBe(1);
    expect(withWhatIHave(all, '')).toEqual([]);
  });

  it('résume l’historique', () => {
    const cooked = [
      { id: 'a', recipeId: 'x', day: '2026-09-01', servings: 2, rating: 4, comment: '', createdAt: '' },
      { id: 'b', recipeId: 'x', day: '2026-10-01', servings: 2, rating: 5, comment: '', createdAt: '' },
      { id: 'c', recipeId: 'x', day: '2026-08-01', servings: 2, rating: null, comment: '', createdAt: '' },
    ];
    expect(cookedSummary('x', cooked)).toEqual({ count: 3, last: '2026-10-01', rating: 4.5 });
    expect(cookedSummary('y', cooked)).toEqual({ count: 0, last: null, rating: null });
  });
});

describe('le menu et la liste de courses', () => {
  it('une semaine du lundi au dimanche, et les cases', () => {
    expect(weekDays('2026-10-08')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    const e = (id: string, meal: 'midi' | 'soir', position: number): PlanEntry => ({ id, day: '2026-10-08', meal, recipeId: null, title: id, servings: null, position, createdAt: '' });
    const entries = [e('b', 'soir', 1), e('a', 'soir', 0), e('m', 'midi', 0)];
    expect(slot(entries, '2026-10-08', 'soir').map((x) => x.id)).toEqual(['a', 'b']);
    expect(nextPosition(entries, '2026-10-08', 'soir')).toBe(2);
    expect(nextPosition(entries, '2026-10-09', 'soir')).toBe(0);
  });

  it('additionne les ingrédients de plusieurs recettes, chacune à son nombre de personnes', () => {
    const lasagnes = recipe('Lasagnes', ['600 g de boeuf haché', '3 oignons', "2 gousses d'ail", '1 l de lait', 'sel', 'Sel poivre'], { servings: 8 });
    const curry = recipe('Curry', ['2 oignons', '200 g de boeuf haché', '40 cl de lait', "huile d'olive"], { servings: 4 });
    const lines = shoppingLines(
      [
        { recipe: lasagnes, servings: 4 },
        { recipe: curry, servings: 4 },
      ],
      DEFAULT_PANTRY,
    );
    const by = (key: string) => lines.find((l) => l.key === key)!;
    expect(by('boeuf hache')).toMatchObject({ quantity: '500 g', sources: ['Lasagnes', 'Curry'], pantry: false });
    expect(by('oignon')).toMatchObject({ quantity: '3 ½' });
    expect(by('ail')).toMatchObject({ quantity: '1 gousse' });
    expect(by('lait')).toMatchObject({ quantity: '90 cl' });
    expect(by('sel')).toMatchObject({ quantity: '', pantry: true });
    expect(by('sel poivre').pantry).toBe(true);
    expect(by("huile d'olive").pantry).toBe(true);
  });

  it('ce qui ne s’additionne pas se met bout à bout', () => {
    const a = recipe('A', ['2 tomates'], { servings: null });
    const b = recipe('B', ['200 g de tomates'], { servings: null });
    expect(shoppingLines([{ recipe: a, servings: 6 }, { recipe: b, servings: null }], [])[0].quantity).toBe('2 + 200 g');
    expect(factorFor(a, 6)).toBe(1);
  });

  it('« toujours là » : le même nom, ou seulement de tels noms', () => {
    expect(isPantry('sel', ['Sel'])).toBe(true);
    expect(isPantry('sel poivre', ['sel', 'poivre'])).toBe(true);
    expect(isPantry('sel de guerande', ['sel'])).toBe(false);
  });
});
