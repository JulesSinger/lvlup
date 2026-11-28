import { describe, expect, it } from 'vitest';
import { linesFromList, linesOf, templatePlan } from './templates';
import type { Item, ListEntry, TemplateLine } from './types';

const item = (id: string, defaultQuantity = ''): Item => ({ id, name: id, aisle: 'autre', recurrence: null, defaultQuantity, lastTripNumber: null, createdAt: '' });
const line = (id: string, itemId: string, quantity = '', position = 0, templateId = 'm'): TemplateLine => ({ id, templateId, itemId, quantity, note: '', position });
const entry = (id: string, itemId: string, quantity = '', checked = false, createdAt = ''): ListEntry => ({ id, itemId, quantity, note: '', checked, priceCents: null, createdAt });

const ITEMS = [item('lardons'), item('oeufs', '6'), item('creme'), item('lait')];

describe('remplir la liste avec un modèle', () => {
  it('ajoute chaque article, avec la quantité du modèle ou, à défaut, celle de l’article', () => {
    const plan = templatePlan([line('1', 'lardons', '500 g'), line('2', 'oeufs')], [], ITEMS);
    expect(plan.add).toEqual([
      { itemId: 'lardons', quantity: '500 g', note: '' },
      { itemId: 'oeufs', quantity: '6', note: '' },
    ]);
    expect(plan.merge).toEqual([]);
  });

  it('un article déjà sur la liste n’a jamais deux lignes : sa quantité est complétée, il repasse à prendre', () => {
    const plan = templatePlan([line('1', 'creme', '2 pots')], [entry('e', 'creme', '1 pot', true)], ITEMS);
    expect(plan.add).toEqual([]);
    expect(plan.merge).toEqual([{ entryId: 'e', quantity: '1 pot + 2 pots', note: '' }]);
  });

  it('déjà sur la liste et rien à compléter : la ligne reste telle quelle', () => {
    const plan = templatePlan([line('1', 'lait')], [entry('e', 'lait', '1 L')], ITEMS);
    expect(plan).toEqual({ add: [], merge: [], already: 1 });
  });

  it('les lignes décochées dans l’aperçu et les articles disparus sont laissés', () => {
    const plan = templatePlan([line('1', 'lardons', '500 g'), line('2', 'lait'), line('3', 'disparu')], [], ITEMS, new Set(['1']));
    expect(plan.add.map((a) => a.itemId)).toEqual(['lait']);
  });

  it('deux lignes du même article dans un modèle n’en font qu’une', () => {
    const plan = templatePlan([line('1', 'lardons', '300 g'), line('2', 'lardons', '200 g')], [], ITEMS);
    expect(plan.add).toEqual([{ itemId: 'lardons', quantity: '300 g + 200 g', note: '' }]);
  });
});

describe('les lignes d’un modèle', () => {
  it('dans leur ordre, celles de ce modèle seulement', () => {
    expect(linesOf([line('b', 'x', '', 1), line('a', 'y', '', 0), line('c', 'z', '', 0, 'autre')], 'm').map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('la liste en cours devient un modèle : un article une fois, dans l’ordre d’ajout', () => {
    const lines = linesFromList([entry('2', 'oeufs', '6', true, '2026-11-28T10:01'), entry('1', 'lait', '1 L', false, '2026-11-28T10:00'), entry('3', 'lait', '', false, '2026-11-28T10:02')]);
    expect(lines).toEqual([
      { itemId: 'lait', quantity: '1 L', note: '' },
      { itemId: 'oeufs', quantity: '6', note: '' },
    ]);
  });
});
