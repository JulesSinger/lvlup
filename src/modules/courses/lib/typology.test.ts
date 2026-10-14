import { describe, expect, it } from 'vitest';
import { guessAisle } from './aisles';
import { classify, guessTypology, spendKey, sumSpends, tripSpend, typologyRows, type SpendLine } from './typology';
import type { Aisle } from './types';

// La typologie d'un achat (docs/etude-courses-typologies.md §3). Les deux premiers tickets de
// Jules (10 et 13 octobre 2026), avec les rayons que Courses leur avait donnés.
const tickets: [string, Aisle, number][] = [
  ['Bières', 'boissons', 525],
  ['Allumettes fumées', 'boucherie_poissonnerie', 185],
  ['Crème semi-épaisse 30 %', 'cremerie', 376],
  ['Beurre demi-sel', 'cremerie', 306],
  ['Aérosol anti-fourmis', 'entretien', 599],
  ['Essuie-tout', 'entretien', 227],
  ['Chips barbecue', 'epicerie_salee', 182],
  ['Gnocchis', 'epicerie_salee', 174],
  ['Kit de préparation', 'epicerie_salee', 298],
  ['Moutarde douce', 'epicerie_salee', 114],
  ['Sauce tomate', 'epicerie_salee', 178],
  ['Riz thaï', 'epicerie_salee', 234],
  ['Spaghetti', 'epicerie_salee', 176],
  ['Papier toilette', 'hygiene', 135],
  ['Lingettes', 'hygiene', 175],
  ['Pèse-personne', 'autre', 1599],
  ['Abattant WC gris', 'autre', 2390],
  ['Cuvette carrée 10 L', 'entretien', 399],
];

const line = (name: string, aisle: Aisle, cents: number | null, i = 0): SpendLine => ({
  id: `l${i}`,
  itemId: null,
  name,
  quantity: '',
  cents,
  classification: guessTypology(name, aisle),
});

describe('deviner la typologie', () => {
  it('range les deux vrais tickets comme on l’attend', () => {
    const got = Object.fromEntries(tickets.map(([n, a]) => [n, spendKey(guessTypology(n, a))]));
    expect(got).toEqual({
      Bières: 'alimentation:alcool',
      'Allumettes fumées': 'alimentation:essentiel',
      'Crème semi-épaisse 30 %': 'alimentation:essentiel',
      'Beurre demi-sel': 'alimentation:essentiel',
      'Aérosol anti-fourmis': 'entretien',
      'Essuie-tout': 'entretien',
      'Chips barbecue': 'alimentation:plaisir',
      Gnocchis: 'alimentation:essentiel',
      'Kit de préparation': 'alimentation:essentiel',
      'Moutarde douce': 'alimentation:essentiel',
      'Sauce tomate': 'alimentation:essentiel',
      'Riz thaï': 'alimentation:essentiel',
      Spaghetti: 'alimentation:essentiel',
      'Papier toilette': 'hygiene',
      Lingettes: 'hygiene',
      'Pèse-personne': 'maison',
      'Abattant WC gris': 'maison',
      'Cuvette carrée 10 L': 'maison',
    });
  });

  it('les mots entiers, le plus long l’emporte, et le rayon en dernier recours', () => {
    expect(spendKey(guessTypology('Vin rouge de Bordeaux', guessAisle('Vin rouge de Bordeaux')))).toBe('alimentation:alcool');
    expect(spendKey(guessTypology('Ginger beer', 'boissons'))).toBe('alimentation:essentiel');
    expect(spendKey(guessTypology('Eau gazeuse', 'boissons'))).toBe('alimentation:essentiel');
    expect(spendKey(guessTypology('Jambon rose', 'boucherie_poissonnerie'))).toBe('alimentation:essentiel');
    expect(spendKey(guessTypology('Olives vertes', 'epicerie_salee'))).toBe('alimentation:plaisir');
    expect(spendKey(guessTypology('Ampoules LED', 'autre'))).toBe('maison');
    expect(spendKey(guessTypology('Croquettes', 'animaux'))).toBe('animaux');
    expect(spendKey(guessTypology('Truc inconnu', 'autre'))).toBe('autre');
  });

  it('ce qu’on a choisi l’emporte sur la devinette ; un sous-type ne vaut que pour l’alimentation', () => {
    expect(classify(null, { typology: 'alimentation', foodKind: 'plaisir' }, 'Kit de préparation', 'epicerie_salee')).toEqual({ typology: 'alimentation', foodKind: 'plaisir' });
    expect(classify({ typology: 'maison', foodKind: null }, { typology: 'alimentation', foodKind: 'plaisir' }, 'x', 'autre')).toEqual({ typology: 'maison', foodKind: null });
    expect(classify(null, { typology: 'hygiene', foodKind: 'plaisir' }, 'x', 'autre')).toEqual({ typology: 'hygiene', foodKind: null });
    expect(classify(null, { typology: 'alimentation', foodKind: null }, 'Bière', 'boissons')).toEqual({ typology: 'alimentation', foodKind: 'alcool' });
    expect(classify(null, null, 'Bière', 'boissons')).toEqual({ typology: 'alimentation', foodKind: 'alcool' });
  });
});

describe('ce qu’une course a coûté, par typologie', () => {
  it('les deux tickets : tout est réparti, sans remise', () => {
    const first = tripSpend(3884, tickets.slice(0, 15).map(([n, a, c], i) => line(n, a, c, i)));
    const second = tripSpend(4388, tickets.slice(15).map(([n, a, c], i) => line(n, a, c, i)));
    const total = sumSpends([first, second]);
    expect(total.adjustmentCents).toBe(0);
    expect(total.undetailedCents).toBe(0);
    expect(typologyRows(total.byKey)).toEqual([
      { typology: 'maison', cents: 4388, kinds: [] },
      { typology: 'alimentation', cents: 2748, kinds: [{ kind: 'essentiel', cents: 2041 }, { kind: 'plaisir', cents: 182 }, { kind: 'alcool', cents: 525 }] },
      { typology: 'entretien', cents: 826, kinds: [] },
      { typology: 'hygiene', cents: 310, kinds: [] },
    ]);
  });

  it('une remise en bas de ticket est à part, jamais répartie', () => {
    const s = tripSpend(900, [line('Pâtes', 'epicerie_salee', 500), line('Chips', 'epicerie_salee', 500)]);
    expect(s.adjustmentCents).toBe(-100);
    expect(s.undetailedCents).toBe(0);
    expect(s.byKey.get('alimentation:essentiel')).toBe(500);
  });

  it('des lignes sans prix : le reste du ticket est « non détaillé »', () => {
    const s = tripSpend(1500, [line('Pâtes', 'epicerie_salee', 500), line('Lessive', 'entretien', null)]);
    expect(s.undetailedCents).toBe(1000);
    expect(s.adjustmentCents).toBe(0);
  });
});
