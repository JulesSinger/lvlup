/**
 * Suite e2e du module Recettes (docs/etude-recettes.md §13-§15).
 *
 * Étape 3 : le carnet, une recette tapée puis une recette collée, la fiche et
 * son nombre de personnes, la photo, « je l'ai faite », la recherche et « avec
 * ce que j'ai », modifier et supprimer, le rechargement, le téléphone.
 */

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

/** Le texte visible, espaces ramassés (les espaces fines de `toLocaleString` comprises). */
const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();

/** Un vrai JPEG, dessiné dans le navigateur (même motif que Projets et Hauts faits). */
async function jpeg(page, hue) {
  const base64 = await page.evaluate((hue) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.fillRect(0, 0, 2400, 1800);
    ctx.fillStyle = `hsl(${hue + 180}, 70%, 75%)`;
    ctx.beginPath();
    ctx.arc(1200, 900, 450, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, hue);
  return Buffer.from(base64, 'base64');
}

const PASTED = `Crêpes de Mamie
Pour 4 personnes
Ingrédients :
- 250 g de farine
- 4 oeufs
- 50 cl de lait
Préparation :
1. Mettre la farine dans un saladier.
2. Ajouter les oeufs, puis le lait petit à petit.`;

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await toHub(page);

  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Recettes' });
  check('La carte Recettes apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Recettes dit ce que fait le module', (await card.textContent())?.includes('menu de la semaine') ?? false);
  await card.click();
  await page.waitForSelector('.recettes-empty');
  check('Un carnet vide propose d’ajouter une recette', (await text(page.locator('.recettes-empty'))).includes('Ton carnet est vide'));
  check('L’adresse dit le module ouvert', page.url().endsWith('#/recettes'));

  const modal = page.locator('.recettes-modal');

  // --- Une recette tapée --------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Ajouter une recette' }).click();
  await page.waitForSelector('#recettes-title');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  check('Une recette sans titre est refusée, avec la raison', (await text(modal.locator('.recettes-error'))).includes('titre'));
  await page.locator('#recettes-title').fill('Lasagnes à la bolognaise');
  await page.locator('#recettes-servings').fill('4');
  await page.locator('#recettes-prep').fill('30');
  await page.locator('#recettes-cook').fill('1 h 30');
  await page.locator('#recettes-ingredients').fill("600 g de boeuf haché\n3 oignons\n2 gousses d'ail\nPour la béchamel :\n1 l de lait\nsel");
  await page.locator('#recettes-steps').fill('1. Faire revenir les oignons.\n2. Ajouter la viande, cuire 20 minutes.');
  await page.locator('.recettes-file input').setInputFiles([{ name: 'lasagnes.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 20) }]);
  await page.waitForSelector('img.recettes-photo-preview');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.recettes-sheet');
  const sheet = page.locator('.recettes-sheet');
  check('La recette enregistrée s’ouvre sur sa fiche', (await text(sheet.locator('h1'))) === 'Lasagnes à la bolognaise');
  check('La fiche dit le temps total', (await text(sheet.locator('.recettes-sheet-meta'))).includes('2 h'));
  const ingredients = () => text(sheet.locator('.recettes-ingredients'));
  check('Les ingrédients, groupe compris', (await ingredients()).includes('Pour la béchamel') && (await ingredients()).includes('600 g de boeuf haché'));
  check('Les étapes, numérotées par Atlas', (await sheet.locator('.recettes-step-list li').count()) === 2 && (await text(sheet.locator('.recettes-step-list li').first())) === 'Faire revenir les oignons.');
  await page.waitForSelector('img.recettes-sheet-photo');
  check('La photo est réduite et affichée', await sheet.locator('img.recettes-sheet-photo').isVisible());

  // Le nombre de personnes.
  await sheet.getByRole('button', { name: 'Une personne de plus' }).click();
  await sheet.getByRole('button', { name: 'Une personne de plus' }).click();
  check('Pour 6 au lieu de 4, les quantités suivent', (await ingredients()).includes('900 g de boeuf haché') && (await ingredients()).includes("3 gousses d'ail") && (await ingredients()).includes('1,5 l de lait'), await ingredients());
  check('Et la fiche dit qu’elles sont ajustées', (await ingredients()).includes('Quantités ajustées pour 6 personnes'));

  // Je l'ai faite.
  await sheet.getByRole('button', { name: '✓ Je l’ai faite' }).click();
  await modal.getByRole('button', { name: '4 sur 5' }).click();
  await page.locator('#recettes-cooked-comment').fill('Doubler l’ail');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.recettes-history');
  check('« Je l’ai faite » entre dans l’historique', (await text(sheet.locator('.recettes-history'))).includes('« Doubler l’ail »'));
  check('La fiche dit combien de fois', (await text(sheet.locator('.recettes-sheet-history-line'))).includes('Faite 1 fois') && (await text(sheet.locator('.recettes-sheet-history-line'))).includes('4/5'));

  // Favori.
  await sheet.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await page.waitForSelector('.recettes-favorite.on');
  check('Une recette se met en favori', await sheet.getByRole('button', { name: 'Retirer des favoris' }).isVisible());

  // --- Depuis un lien (étape 4) : sans compte, la fenêtre dit pourquoi --------------------------------
  await page.getByRole('button', { name: 'Nouvelle recette' }).click();
  await modal.getByRole('button', { name: 'Depuis un lien' }).click();
  check('Sans compte, importer un lien dit qu’il faut un compte et propose le texte collé', (await text(modal.locator('.recettes-local'))).includes('connecté avec un compte'));
  check('Et le bouton d’import reste inactif', await modal.getByRole('button', { name: 'Importer' }).isDisabled());
  await modal.getByRole('button', { name: 'Fermer' }).click();

  // --- Une recette collée -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Nouvelle recette' }).click();
  await modal.getByRole('button', { name: 'Coller un texte' }).click();
  await page.locator('#recettes-paste').fill(PASTED);
  await modal.getByRole('button', { name: 'Lire le texte' }).click();
  check('Le texte collé remplit le titre et les personnes', (await page.locator('#recettes-title').inputValue()) === 'Crêpes de Mamie' && (await page.locator('#recettes-servings').inputValue()) === '4');
  check('Et sépare les ingrédients des étapes', (await page.locator('#recettes-ingredients').inputValue()) === '250 g de farine\n4 oeufs\n50 cl de lait' && (await page.locator('#recettes-steps').inputValue()).startsWith('Mettre la farine'));
  await page.locator('#recettes-category').selectOption('dessert');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-sheet h1')?.textContent === 'Crêpes de Mamie');
  check('Sans photo, la couverture de la catégorie', await sheet.locator('.recettes-cover-dessert').isVisible());

  // --- Le carnet ----------------------------------------------------------------------------------
  await sheet.getByRole('button', { name: '← Carnet' }).click();
  await page.waitForSelector('.recettes-grid');
  check('Le carnet montre les deux recettes', (await page.locator('.recettes-card').count()) === 2);
  await page.getByRole('searchbox', { name: 'Chercher une recette' }).fill('boeuf');
  check('Chercher un ingrédient trouve la recette', (await page.locator('.recettes-card').count()) === 1 && (await text(page.locator('.recettes-card'))).includes('Lasagnes'));
  await page.getByRole('searchbox', { name: 'Chercher une recette' }).fill('');
  await page.getByRole('button', { name: '★ Favoris' }).click();
  check('Le filtre des favoris', (await page.locator('.recettes-card').count()) === 1);
  await page.getByRole('button', { name: '★ Favoris' }).click();
  await page.getByRole('button', { name: 'Jamais faites' }).click();
  check('Le filtre « jamais faites »', (await page.locator('.recettes-card').count()) === 1 && (await text(page.locator('.recettes-card'))).includes('Crêpes'));
  await page.getByRole('button', { name: 'Jamais faites' }).click();
  await page.getByRole('button', { name: '🧺 Avec ce que j’ai' }).click();
  await page.getByRole('searchbox', { name: 'Ce que j’ai' }).fill('lait, oeufs');
  const firstMatch = await text(page.locator('.recettes-card').first());
  check('« Avec ce que j’ai » met d’abord la recette qui s’en sert le plus', firstMatch.includes('Crêpes') && firstMatch.includes('lait, oeufs'), firstMatch);
  await page.getByRole('button', { name: '🧺 Avec ce que j’ai' }).click();

  // --- Modifier, recharger, supprimer -------------------------------------------------------------
  await page.locator('.recettes-card', { hasText: 'Crêpes' }).click();
  await sheet.getByRole('button', { name: 'Modifier' }).click();
  await page.locator('#recettes-title').fill('Crêpes de Mamie Jeanne');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-sheet h1')?.textContent === 'Crêpes de Mamie Jeanne');
  check('Modifier une recette met la fiche à jour', true);

  await page.reload();
  await page.waitForSelector('.recettes-grid');
  check('Les recettes survivent au rechargement', (await page.locator('.recettes-card').count()) === 2);
  await page.waitForSelector('.recettes-card img.recettes-card-photo');
  check('La photo aussi', await page.locator('.recettes-card', { hasText: 'Lasagnes' }).locator('img.recettes-card-photo').isVisible());

  await page.locator('.recettes-card', { hasText: 'Crêpes' }).click();
  await sheet.getByRole('button', { name: 'Supprimer la recette' }).click();
  await sheet.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForSelector('.recettes-grid');
  await page.waitForFunction(() => document.querySelectorAll('.recettes-card').length === 1);
  check('Supprimer une recette demande confirmation, puis la retire', (await page.locator('.recettes-card').count()) === 1);

  // --- Le menu de la semaine (étape 5) -----------------------------------------------------------------
  await page.locator('.recettes-card', { hasText: 'Lasagnes' }).click();
  await sheet.getByRole('button', { name: '📅 Au menu' }).click();
  await modal.getByRole('group', { name: 'Le repas' }).getByRole('button', { name: 'Soir' }).click();
  await modal.getByRole('button', { name: 'Ajouter au menu' }).click();
  await page.waitForSelector('.notice.info');
  check('Une recette se pose au menu depuis sa fiche, et Atlas le dit', (await text(page.locator('.notice.info'))).includes('Au menu : Lasagnes à la bolognaise, soir'));
  await sheet.getByRole('button', { name: '← Carnet' }).click();
  await page.getByRole('button', { name: /^Menu de la semaine/ }).click();
  await page.waitForSelector('.recettes-menu');
  const today = page.locator('.recettes-menu-day.today');
  check('Le menu s’ouvre sur cette semaine, aujourd’hui en évidence', (await text(page.locator('.recettes-menu-title'))) === 'Cette semaine' && (await today.count()) === 1);
  check('Le soir d’aujourd’hui porte la recette', (await text(today.locator('.recettes-menu-slot').nth(1))).includes('Lasagnes à la bolognaise'));
  await today.locator('.recettes-menu-slot').nth(0).locator('.recettes-menu-add').click();
  await page.locator('#recettes-plan-free').fill('Restes');
  await modal.getByRole('button', { name: 'Ajouter au menu' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-menu-day.today .recettes-menu-slot')?.textContent?.includes('Restes'));
  check('Une case peut porter un simple titre (« Restes »)', true);
  await page.getByRole('button', { name: 'Semaine suivante' }).click();
  check('Les semaines se parcourent', (await text(page.locator('.recettes-menu-title'))).startsWith('Semaine du') && (await page.locator('.recettes-menu-entry').count()) === 0);
  await page.getByRole('button', { name: 'Revenir à cette semaine' }).click();
  await today.getByRole('button', { name: 'Retirer Restes du menu' }).click();
  await page.waitForFunction(() => !document.querySelector('.recettes-menu-day.today')?.textContent?.includes('Restes'));
  check('Un repas se retire du menu', true);

  // Le calque de Recettes dans Calendar.
  await page.evaluate(() => (location.hash = '#/calendrier'));
  await page.waitForSelector('.fc-event', { timeout: 20_000 });
  await page.waitForTimeout(400);
  check('Calendar montre le menu de Recettes', (await text(page.locator('.fc'))).includes('Soir · Lasagnes à la bolognaise'));
  await page.evaluate(() => (location.hash = '#/recettes'));
  await page.waitForSelector('.recettes-menu');
  await page.locator('.recettes-menu-recipe', { hasText: 'Lasagnes' }).first().click();
  await page.waitForSelector('.recettes-sheet');
  check('Toucher une recette du menu ouvre sa fiche', (await text(sheet.locator('h1'))) === 'Lasagnes à la bolognaise');
  await sheet.getByRole('button', { name: '← Carnet' }).click();
  await page.getByRole('button', { name: /^Carnet/ }).click();

  // --- Téléphone ----------------------------------------------------------------------------------
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(150);
    const notebook = await fits();
    await page.locator('.recettes-card').first().click();
    await page.waitForSelector('.recettes-sheet');
    const sheetFits = await fits();
    await page.getByRole('button', { name: 'Nouvelle recette' }).click();
    const editorFits = await fits();
    await modal.getByRole('button', { name: 'Annuler' }).click();
    await sheet.getByRole('button', { name: '← Carnet' }).click();
    await page.getByRole('button', { name: /^Menu de la semaine/ }).click();
    await page.waitForSelector('.recettes-menu');
    const menuFits = await fits();
    await page.getByRole('button', { name: /^Carnet/ }).click();
    check(`Rien ne déborde sur téléphone (${width} px) : carnet, fiche, fenêtre, menu`, notebook && sheetFits && editorFits && menuFits, `${notebook} ${sheetFits} ${editorFits} ${menuFits}`);
  }

  await page.getByRole('button', { name: 'Changer de module — Recettes' }).click();
  check('Le nom du module ouvre la grille des modules', await page.getByRole('dialog').isVisible());
  check('Aucune erreur dans la page', errors.length === 0, errors.join(' | '));

  await context.close();
}
