import { describe, expect, it } from 'vitest';
import { ingredientsToText, readMinutesField, stepsToText, textToIngredients, textToSteps, textToTags } from './editorText';

describe('les ingrédients en texte', () => {
  it('aller-retour, groupes compris', () => {
    const ingredients = [
      { text: '600 g de boeuf haché', section: null },
      { text: '1 l de lait', section: 'Pour la béchamel' },
      { text: '100 g de beurre', section: 'Pour la béchamel' },
      { text: 'parmesan', section: 'Montage' },
    ];
    const text = ingredientsToText(ingredients);
    expect(text).toBe('600 g de boeuf haché\nPour la béchamel :\n1 l de lait\n100 g de beurre\nMontage :\nparmesan');
    expect(textToIngredients(text)).toEqual(ingredients);
  });

  it('les puces et les lignes vides partent', () => {
    expect(textToIngredients('- 3 oeufs\n\n• sel\n  ')).toEqual([
      { text: '3 oeufs', section: null },
      { text: 'sel', section: null },
    ]);
  });
});

describe('les étapes en texte', () => {
  it('une par ligne, numéros retirés', () => {
    expect(textToSteps('1. Préchauffer le four.\n2) Mélanger.\n\nÉtape 3 : Cuire 20 min.')).toEqual([
      { text: 'Préchauffer le four.' },
      { text: 'Mélanger.' },
      { text: 'Cuire 20 min.' },
    ]);
    expect(stepsToText([{ text: 'A' }, { text: 'B' }])).toBe('A\nB');
  });
});

describe('les petits champs', () => {
  it('les étiquettes', () => {
    expect(textToTags('batch cooking, Rapide, rapide, , végétarien')).toEqual(['batch cooking', 'rapide', 'végétarien']);
  });

  it('les minutes', () => {
    expect(readMinutesField('25')).toBe(25);
    expect(readMinutesField('1 h 30')).toBe(90);
    expect(readMinutesField('1h')).toBe(60);
    expect(readMinutesField('45 min')).toBe(45);
    expect(readMinutesField('')).toBeNull();
    expect(readMinutesField('bientôt')).toBeUndefined();
  });
});
