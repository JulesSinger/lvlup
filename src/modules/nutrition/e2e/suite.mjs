/**
 * Suite e2e du module nutrition (Cérès).
 *
 * Étapes 3 et 4 (docs/etude-nutrition.md §10) : le journal du jour et
 * l'objectif quotidien. Ces
 * vérifications suivent un vrai parcours — chercher un aliment dans la
 * table CIQUAL embarquée, l'ajouter, corriger sa quantité, le retirer,
 * retrouver ses récents, copier un repas de la veille — plus le rendu
 * téléphone et le chargement à la demande de la table.
 */

/** Pomme, chair et peau, crue : 54 kcal / 100 g dans la table CIQUAL 2025. */
const APPLE = 'Pomme, chair et peau, crue';

/**
 * Texte d'un élément, espaces normalisées : les milliers s'affichent avec
 * l'espace fine insécable du français (« 2 190 »), qu'une comparaison avec
 * une espace ordinaire raterait.
 */
async function text(locator) {
  return ((await locator.textContent()) ?? '').replace(/\s/g, ' ');
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();

  // La table CIQUAL doit être un fichier à part, téléchargé à la première
  // recherche seulement — ni le hub ni le journal n'en portent le poids.
  const ciqualRequests = [];
  page.on('request', (r) => {
    if (/ciqual/i.test(r.url())) ciqualRequests.push(r.url());
  });

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Cérès/ });
  check('La carte Cérès apparaît sur l’écran de choix', await card.isVisible());
  check(
    'La carte Cérès dit ce que fait le module',
    (await card.textContent())?.includes('Calories et macronutriments') ?? false,
  );

  await card.click();
  await page.waitForSelector('.nutrition-summary');
  check('Le journal s’ouvre sur aujourd’hui', (await page.locator('.nutrition-day-label').textContent()) === 'Aujourd’hui');
  check('Les quatre repas sont affichés', (await page.locator('.nutrition-meal').count()) === 4);
  check('Un jour vide totalise 0 kcal', (await page.locator('.nutrition-summary-kcal-value').textContent()) === '0');
  check('Sans objectif, le total le dit plutôt que d’afficher des barres vides', await page.locator('.nutrition-summary-hint').isVisible());
  check('La source des données est citée (Licence Ouverte)', (await page.locator('.nutrition-credit').textContent())?.includes('Ciqual 2025, ANSES') ?? false);
  check('La table des aliments n’est pas encore téléchargée', ciqualRequests.length === 0, ciqualRequests.join(', '));

  const breakfast = page.locator('.nutrition-meal', { hasText: 'Petit-déjeuner' });
  const lunch = page.locator('.nutrition-meal', { hasText: 'Déjeuner' }).filter({ hasNotText: 'Petit' });

  // --- Ajouter un aliment ------------------------------------------------
  await breakfast.getByRole('button', { name: '+ Ajouter' }).click();
  await page.waitForSelector('.nutrition-add-dialog');
  await page.locator('#nutrition-search').fill('pomme chair peau crue');
  await page.waitForSelector('.nutrition-result');
  check('La table des aliments se télécharge à la première recherche', ciqualRequests.length > 0);
  check('La recherche trouve l’aliment sans accents ni ponctuation', await page.locator('.nutrition-result', { hasText: APPLE }).first().isVisible());

  await page.locator('.nutrition-result', { hasText: APPLE }).first().click();
  check('Choisir un aliment propose 100 g par défaut', (await page.locator('#nutrition-grams').inputValue()) === '100');
  await page.locator('#nutrition-grams').fill('150');
  check(
    'L’aperçu calcule les valeurs de la quantité avant d’ajouter',
    (await page.locator('.nutrition-quantity-preview').textContent())?.includes('81 kcal') ?? false,
  );
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForSelector('.nutrition-add-dialog', { state: 'detached' });

  const appleRow = breakfast.locator('.nutrition-entry', { hasText: APPLE });
  check('L’aliment apparaît sous son repas, avec sa quantité', (await appleRow.textContent())?.includes('150 g') ?? false);
  check('Le total du jour suit (150 g de pomme = 81 kcal)', (await page.locator('.nutrition-summary-kcal-value').textContent()) === '81');
  check('Le repas affiche son propre total', (await breakfast.locator('.nutrition-meal-kcal').textContent()) === '81 kcal');

  // --- Récents -----------------------------------------------------------
  await lunch.getByRole('button', { name: '+ Ajouter' }).click();
  await page.waitForSelector('.nutrition-results-title');
  check(
    'Sans rien taper, les aliments déjà mangés sont proposés',
    await page.locator('.nutrition-result', { hasText: APPLE }).isVisible(),
  );
  await page.locator('.nutrition-result', { hasText: APPLE }).click();
  check('Un aliment récent reprend la quantité de la dernière fois', (await page.locator('#nutrition-grams').inputValue()) === '150');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.nutrition-add-dialog', { state: 'detached' });
  check('Échap ferme la fenêtre sans rien ajouter', (await page.locator('.nutrition-entry').count()) === 1);

  // --- Corriger une quantité --------------------------------------------
  await appleRow.click();
  await page.waitForSelector('.nutrition-entry-editor');
  await page.locator('#nutrition-entry-grams').fill('200');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.nutrition-entry-editor', { state: 'detached' });
  check('Corriger la quantité remet les valeurs à l’échelle (200 g = 108 kcal)', (await page.locator('.nutrition-summary-kcal-value').textContent()) === '108');

  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Cérès/ }).click();
  await page.waitForSelector('.nutrition-entry');
  check('Le journal survit à un rechargement', (await breakfast.locator('.nutrition-entry', { hasText: '200 g' }).count()) === 1);

  // --- La veille, puis copier un repas ------------------------------------
  await page.getByRole('button', { name: 'Jour précédent' }).click();
  await page.waitForFunction(() => document.querySelector('.nutrition-day-label')?.textContent === 'Hier');
  check('Le jour précédent est vide', (await page.locator('.nutrition-entry').count()) === 0);
  check('Un bouton ramène à aujourd’hui', await page.locator('.nutrition-day-today').isVisible());

  await lunch.getByRole('button', { name: '+ Ajouter' }).click();
  await page.locator('#nutrition-search').fill('riz blanc cuit');
  await page.locator('.nutrition-result').first().click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForSelector('.nutrition-add-dialog', { state: 'detached' });
  check('Un aliment s’ajoute à un autre jour qu’aujourd’hui', (await lunch.locator('.nutrition-entry').count()) === 1);

  await page.locator('.nutrition-day-today').click();
  await page.waitForFunction(() => document.querySelector('.nutrition-day-label')?.textContent === 'Aujourd’hui');
  const copyButton = lunch.getByRole('button', { name: /Copier d’hier/ });
  check('Un repas de la veille peut être copié', await copyButton.isVisible());
  check(
    'Un repas vide la veille ne propose pas de copie',
    (await page.locator('.nutrition-meal', { hasText: 'Dîner' }).getByRole('button', { name: /Copier/ }).count()) === 0,
  );
  await copyButton.click();
  await lunch.locator('.nutrition-entry').first().waitFor();
  check('La copie ajoute le repas de la veille à aujourd’hui', (await lunch.locator('.nutrition-entry', { hasText: 'Riz blanc' }).count()) === 1);

  // --- Retirer ------------------------------------------------------------
  await lunch.locator('.nutrition-entry').first().click();
  await page.waitForSelector('.nutrition-entry-editor');
  await page.getByRole('button', { name: 'Retirer' }).click();
  await page.waitForSelector('.nutrition-entry-editor', { state: 'detached' });
  check('Retirer une entrée la fait disparaître du repas', (await lunch.locator('.nutrition-entry').count()) === 0);
  check('Le total du jour la retire aussi', (await page.locator('.nutrition-summary-kcal-value').textContent()) === '108');

  // --- Objectif quotidien (étape 4) --------------------------------------
  await page.getByRole('button', { name: 'Fixer un objectif' }).click();
  await page.waitForSelector('.nutrition-target-editor');
  await page.locator('#nutrition-target-protein').fill('140');
  await page.locator('#nutrition-target-carbs').fill('250');
  await page.locator('#nutrition-target-fat').fill('70');
  check(
    'Les kcal de l’objectif se déduisent des grammes (140/250/70 g = 2 190 kcal)',
    (await text(page.locator('.nutrition-target-kcal'))).includes('2 190 kcal'),
  );
  check(
    'Chaque macro affiche sa part de l’énergie et le repère ANSES',
    (await page.locator('.nutrition-target-editor .field-hint').first().textContent())?.includes('25 % de l’énergie · repère ANSES 10–20 %') ?? false,
  );

  // Le calculateur propose, sans rien enregistrer.
  await page.locator('.nutrition-calculator summary').click();
  await page.locator('#nutrition-calc-age').fill('30');
  await page.locator('#nutrition-calc-weight').fill('75');
  await page.locator('#nutrition-calc-height').fill('180');
  await page.locator('#nutrition-calc-activity').selectOption('1.55');
  await page.locator('#nutrition-calc-protein').selectOption('1.6');
  check(
    'Le calculateur propose des grammes (Mifflin-St Jeor, 75 kg × 1,6 g/kg = 120 g de protéines)',
    (await page.locator('.nutrition-calculator-result').textContent())?.includes('protéines 120 g, glucides 316 g, lipides 104 g') ?? false,
  );
  await page.getByRole('button', { name: 'Utiliser ces valeurs' }).click();
  check('« Utiliser ces valeurs » remplit les grammes', (await page.locator('#nutrition-target-protein').inputValue()) === '120');
  await page.locator('#nutrition-target-protein').fill('140');
  await page.locator('#nutrition-target-carbs').fill('250');
  await page.locator('#nutrition-target-fat').fill('70');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.nutrition-target-editor', { state: 'detached' });

  check('Le total se lit face à l’objectif', (await text(page.locator('.nutrition-summary-kcal-unit'))).includes('/ 2 190 kcal'));
  check('Une barre par chiffre (kcal et trois macros)', (await page.locator('.nutrition-summary .nutrition-bar').count()) === 4);
  check('Chaque macro montre son objectif en grammes', (await page.locator('.nutrition-summary-macro.protein').textContent())?.includes('/ 140 g') ?? false);
  check('Le message « pas d’objectif » disparaît', (await page.locator('.nutrition-summary-hint').count()) === 0);

  await page.getByRole('button', { name: 'Jour précédent' }).click();
  await page.waitForFunction(() => document.querySelector('.nutrition-day-label')?.textContent === 'Hier');
  check('Un objectif posé aujourd’hui ne rejuge pas la veille', await page.locator('.nutrition-summary-hint').isVisible());
  await page.locator('.nutrition-day-today').click();
  await page.waitForFunction(() => document.querySelector('.nutrition-day-label')?.textContent === 'Aujourd’hui');

  // Reposer un objectif le même jour le remplace plutôt que d'en empiler deux.
  await page.locator('.nutrition-summary').getByRole('button', { name: 'Objectif' }).click();
  await page.waitForSelector('.nutrition-target-editor');
  check('La fenêtre reprend l’objectif en vigueur', (await page.locator('#nutrition-target-protein').inputValue()) === '140');
  await page.locator('#nutrition-target-protein').fill('150');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.nutrition-target-editor', { state: 'detached' });
  check('Modifier l’objectif du jour le remplace', (await text(page.locator('.nutrition-summary-kcal-unit'))).includes('/ 2 230 kcal'));
  await page.locator('.nutrition-summary').getByRole('button', { name: 'Objectif' }).click();
  await page.waitForSelector('.nutrition-target-history');
  check('Un seul objectif enregistré pour ce jour', (await page.locator('.nutrition-target-history-row').count()) === 1);
  check('L’historique dit depuis quand', (await page.locator('.nutrition-target-history-row').textContent())?.includes('Depuis aujourd’hui') ?? false);
  await page.locator('.nutrition-target-history-row').getByRole('button', { name: 'Retirer' }).click();
  await page.waitForSelector('.nutrition-target-history', { state: 'detached' });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.nutrition-target-editor', { state: 'detached' });
  check('Retirer l’objectif ramène aux totaux seuls', await page.locator('.nutrition-summary-hint').isVisible());

  await page.getByRole('button', { name: 'Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());
  await context.close();

  // --- Téléphone ----------------------------------------------------------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mobile.newPage();
  await mp.goto(BASE);
  await mp.waitForSelector('.hub-picker-card');
  await mp.getByRole('button', { name: /Cérès/ }).click();
  await mp.waitForSelector('.nutrition-summary');
  const mBreakfast = mp.locator('.nutrition-meal', { hasText: 'Petit-déjeuner' });
  await mBreakfast.getByRole('button', { name: '+ Ajouter' }).click();
  await mp.locator('#nutrition-search').fill('pomme de terre conservation sans peau bouillie');
  await mp.locator('.nutrition-result').first().click();
  await mp.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await mp.waitForSelector('.nutrition-add-dialog', { state: 'detached' });
  check(
    'Journal sans débordement horizontal sur téléphone, même avec un nom d’aliment long',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check('La barre du haut passe en icônes seules sur téléphone', !(await mp.locator('.nutrition-topbar-label').first().isVisible()));
  await mp.getByRole('button', { name: 'Fixer un objectif' }).click();
  await mp.locator('.nutrition-calculator summary').click();
  check(
    'Fenêtre d’objectif et calculateur sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mp.keyboard.press('Escape');
  await mBreakfast.getByRole('button', { name: '+ Ajouter' }).click();
  await mp.locator('#nutrition-search').fill('pomme');
  await mp.waitForSelector('.nutrition-result');
  check(
    'Fenêtre de recherche sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mobile.close();
}
