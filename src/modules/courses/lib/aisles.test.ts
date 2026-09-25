import { describe, expect, it } from 'vitest';
import { groupByAisle, guessAisle } from './aisles';
import type { Item, ListEntry } from './types';

describe('guessAisle', () => {
  it('reconnaît les articles courants, sans accents ni majuscules, au pluriel', () => {
    expect(guessAisle('Lait demi-écrémé')).toBe('cremerie');
    expect(guessAisle('Tomates cerises')).toBe('fruits_legumes');
    expect(guessAisle('Baguette')).toBe('boulangerie');
    expect(guessAisle('Pâtes')).toBe('epicerie_salee');
    expect(guessAisle('Papier toilette')).toBe('entretien');
    expect(guessAisle('Croquettes chat')).toBe('animaux');
  });

  it('le mot-clé le plus précis l’emporte sur le plus court', () => {
    expect(guessAisle('Lait de coco')).toBe('epicerie_salee'); // pas la crèmerie
    expect(guessAisle('Eau de Javel')).toBe('entretien'); // pas une boisson
    expect(guessAisle('Légumes surgelés')).toBe('surgeles');
    expect(guessAisle('Pâte à tartiner')).toBe('epicerie_sucree');
  });

  it('ne reconnaît que des mots entiers', () => {
    expect(guessAisle('Thon au naturel')).toBe('epicerie_salee'); // « the » ne voit pas « thon »
    expect(guessAisle('Thé vert')).toBe('epicerie_sucree');
    expect(guessAisle('Vinaigre balsamique')).toBe('epicerie_salee'); // pas du vin
  });

  it('« autre » quand rien ne correspond', () => {
    expect(guessAisle('Piles AA')).toBe('autre');
    expect(guessAisle('')).toBe('autre');
  });
});

describe('groupByAisle', () => {
  const item = (id: string, name: string, aisle: Item['aisle']): Item => ({
    id,
    name,
    aisle,
    recurrence: null,
    defaultQuantity: '',
    lastTripNumber: null,
    createdAt: '',
  });
  const entry = (id: string, itemId: string, checked = false): ListEntry => ({
    id,
    itemId,
    quantity: '',
    note: '',
    checked,
    priceCents: null,
    createdAt: '',
  });
  const items = [
    item('i1', 'Yaourt', 'cremerie'),
    item('i2', 'Beurre', 'cremerie'),
    item('i3', 'Pommes', 'fruits_legumes'),
    item('i4', 'Lait', 'cremerie'),
  ];

  it('range par rayon dans l’ordre du parcours, rayons vides omis', () => {
    const groups = groupByAisle([entry('e1', 'i1'), entry('e3', 'i3')], items);
    expect(groups.map((g) => g.aisle)).toEqual(['fruits_legumes', 'cremerie']);
  });

  it('dans un rayon : à prendre d’abord, par ordre alphabétique, puis ce qui est dans le panier', () => {
    const [cremerie] = groupByAisle([entry('e1', 'i1'), entry('e2', 'i2', true), entry('e4', 'i4')], items);
    expect(cremerie.lines.map((l) => l.item.name)).toEqual(['Lait', 'Yaourt', 'Beurre']);
  });

  it('ignore une ligne dont l’article a disparu', () => {
    expect(groupByAisle([entry('e9', 'inconnu')], items)).toEqual([]);
  });
});
