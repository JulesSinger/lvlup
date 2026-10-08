import { describe, expect, it } from 'vitest';
import { clean, extractRecipe, isoMinutes, mapCategory, readYield } from '../../../../supabase/functions/recettes-import/extract.ts';

/**
 * Des pages fabriquées sur le modèle de celles de Marmiton et CuisineAZ
 * (relevées le 08/10/2026) : la forme des données, pas leur texte.
 */
const page = (ld: unknown) => `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Un site"}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body>…</body></html>`;

const marmitonLike = {
  '@context': 'http://schema.org',
  '@type': 'Recipe',
  name: 'Lasagnes à la bolognaise : la meilleure recette',
  recipeCategory: 'Plat principal',
  image: ['https://assets.example.com/lasagnes.jpg', 'https://assets.example.com/lasagnes.webp'],
  prepTime: 'PT30M',
  cookTime: 'PT1H35M',
  totalTime: 'PT2H5M',
  recipeYield: '8 personnes',
  keywords: 'Lasagnes à la bolognaise : la meilleure recette, lasagne, facile',
  recipeIngredient: ['1 paquet de lasagnes', '600 g de boeuf haché', 'Pour la béchamel :', '1 l de lait', 'sel'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Faire revenir l&#39;ail et les oignons.' },
    { '@type': 'HowToStep', text: 'Ajouter la viande &amp; laisser cuire <b>20 minutes</b>.' },
  ],
};

describe('lire la recette d’une page', () => {
  it('une page comme Marmiton', () => {
    const r = extractRecipe(page(marmitonLike), 'https://www.marmiton.org/recettes/x.aspx')!;
    expect(r).toMatchObject({
      title: 'Lasagnes à la bolognaise',
      servings: 8,
      yieldLabel: 'personnes',
      prepMinutes: 30,
      cookMinutes: 95,
      restMinutes: null,
      category: 'plat',
      sourceName: 'marmiton.org',
      imageUrl: 'https://assets.example.com/lasagnes.jpg',
    });
    expect(r.tags).toEqual(['lasagne', 'facile']);
    expect(r.ingredients).toEqual([
      { text: '1 paquet de lasagnes', section: null },
      { text: '600 g de boeuf haché', section: null },
      { text: '1 l de lait', section: 'Pour la béchamel' },
      { text: 'sel', section: 'Pour la béchamel' },
    ]);
    expect(r.steps.map((s) => s.text)).toEqual(["Faire revenir l'ail et les oignons.", 'Ajouter la viande & laisser cuire 20 minutes.']);
  });

  it('une recette dans un @graph, des étapes en sections, un repos et un éditeur', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'x' },
        {
          '@type': ['Recipe', 'Thing'],
          name: 'Pain maison',
          recipeYield: ['1', '1 pain'],
          prepTime: 'PT20M',
          cookTime: 'PT40M',
          totalTime: 'PT3H',
          recipeCategory: ['Boulangerie', 'Accompagnement'],
          publisher: { '@type': 'Organization', name: 'Le Blog de Léa' },
          image: { '@type': 'ImageObject', url: 'https://blog.example.com/pain.jpg' },
          recipeIngredient: ['Préparation', '500 g de farine', '1 sachet de levure'],
          recipeInstructions: [
            { '@type': 'HowToSection', name: 'Le pétrissage', itemListElement: [{ '@type': 'HowToStep', text: 'Pétrir 10 minutes.' }, { '@type': 'HowToStep', text: 'Laisser lever 2 heures.' }] },
            { '@type': 'HowToSection', name: 'La cuisson', itemListElement: [{ '@type': 'HowToStep', text: 'Cuire 40 minutes.' }] },
          ],
        },
      ],
    };
    const r = extractRecipe(page(ld), 'https://blog.example.com/pain')!;
    expect(r).toMatchObject({ title: 'Pain maison', servings: 1, yieldLabel: 'pain', restMinutes: 120, category: 'accompagnement', sourceName: 'Le Blog de Léa', imageUrl: 'https://blog.example.com/pain.jpg' });
    // « Préparation » glissé dans la liste n'est pas un groupe.
    expect(r.ingredients.every((i) => i.section === null)).toBe(true);
    expect(r.steps.map((s) => s.text)).toEqual(['Le pétrissage : Pétrir 10 minutes.', 'Laisser lever 2 heures.', 'La cuisson : Cuire 40 minutes.']);
  });

  it('des étapes en un seul texte', () => {
    const r = extractRecipe(page({ '@type': 'Recipe', name: 'Salade', recipeInstructions: 'Laver la salade.\nPréparer la vinaigrette.\n\nMélanger.' }), 'https://x.fr/s')!;
    expect(r.steps.map((s) => s.text)).toEqual(['Laver la salade.', 'Préparer la vinaigrette.', 'Mélanger.']);
    expect(r.servings).toBeNull();
  });

  it('rien quand la page ne décrit pas de recette, ou quand le JSON est cassé', () => {
    expect(extractRecipe('<html>rien</html>', 'https://x.fr')).toBeNull();
    expect(extractRecipe('<script type="application/ld+json">{cassé</script>', 'https://x.fr')).toBeNull();
    expect(extractRecipe(page({ '@type': 'Recipe', name: '' }), 'https://x.fr')).toBeNull();
  });

  it('les petites règles', () => {
    expect(isoMinutes('PT1H35M')).toBe(95);
    expect(isoMinutes('PT0M')).toBeNull();
    expect(readYield('4')).toEqual({ servings: 4, yieldLabel: 'personnes' });
    expect(readYield('15 crêpes')).toEqual({ servings: 15, yieldLabel: 'crêpes' });
    expect(readYield(6)).toEqual({ servings: 6, yieldLabel: 'personnes' });
    expect(mapCategory('Dessert')).toBe('dessert');
    expect(mapCategory(['Entrées'])).toBe('entree');
    expect(mapCategory('Inconnu')).toBe('plat');
    expect(clean('<p>Crème&nbsp;brûlée &eacute;t&#233; &#x2019;</p>')).toBe('Crème brûlée été ’');
  });
});
