import { describe, expect, it } from 'vitest';
import { base64ToFile, draftToInput } from './linkDraft';

describe('le brouillon venu d’un lien', () => {
  it('devient une recette à relire, champ par champ', () => {
    const input = draftToInput({
      title: 'Lasagnes à la bolognaise',
      servings: 8,
      yieldLabel: 'personnes',
      prepMinutes: 30,
      cookMinutes: 95,
      restMinutes: null,
      category: 'plat',
      tags: ['lasagne'],
      sourceUrl: 'https://www.marmiton.org/x',
      sourceName: 'Marmiton',
      ingredients: [{ text: '1 l de lait', section: 'Pour la béchamel' }],
      steps: [{ text: 'Cuire.' }],
      imageUrl: 'https://img/x.jpg',
    });
    expect(input).toMatchObject({ title: 'Lasagnes à la bolognaise', servings: 8, cookMinutes: 95, sourceName: 'Marmiton', ingredients: [{ text: '1 l de lait', section: 'Pour la béchamel' }] });
    expect(input).not.toHaveProperty('imageUrl');
  });

  it('ne garde rien de douteux', () => {
    const input = draftToInput({ title: 'X', servings: 500, category: 'poison', prepMinutes: -3, sourceUrl: 'javascript:alert(1)', ingredients: [{ text: 1 }, 'a', { text: 'sel' }], steps: [null, { text: 'ok' }] })!;
    expect(input).toMatchObject({ servings: null, category: 'plat', prepMinutes: null, sourceUrl: null, ingredients: [{ text: 'sel', section: null }], steps: [{ text: 'ok' }] });
    expect(draftToInput({ title: '  ' })).toBeNull();
    expect(draftToInput(null)).toBeNull();
  });

  it('la photo rapportée devient un fichier', async () => {
    const file = base64ToFile(btoa('jpeg!'), 'image/jpeg');
    expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('jpeg!');
    expect(base64ToFile(btoa('x'), 'text/html').type).toBe('image/jpeg');
  });
});
