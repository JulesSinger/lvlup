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

  // --- Vers Courses, à la demande (étape 6) ------------------------------------------------------------
  await page.locator('.recettes-card', { hasText: 'Lasagnes' }).click();
  await sheet.getByRole('button', { name: '🛒 Ajouter aux courses' }).click();
  await page.waitForSelector('.recettes-shopping');
  const line = (name) => modal.locator('.recettes-shopping-line', { hasText: name });
  check('La liste à relire reprend les ingrédients de la fiche', (await modal.locator('.recettes-shopping-line').count()) === 5);
  check('« sel », toujours là, est décoché d’office', !(await line('sel').locator('input[type="checkbox"]').isChecked()));
  check('Les quantités suivent le nombre de personnes de la fiche', (await line('boeuf').locator('.recettes-shopping-qty').inputValue()) === '600 g');
  await line('oignons').getByRole('button', { name: '+ toujours là' }).click();
  await page.waitForTimeout(200);
  check('Un ingrédient devient « toujours là » d’un toucher, et se décoche', !(await line('oignons').locator('input[type="checkbox"]').isChecked()));
  await line('lait').locator('.recettes-shopping-qty').fill('2 l');
  await modal.getByRole('button', { name: /^Ajouter 3 articles aux courses/ }).click();
  await page.waitForSelector('.notice.info');
  check('Atlas dit ce qui est parti vers Courses', (await text(page.locator('.notice.info'))).includes('3 articles envoyés à Courses'));
  await page.getByRole('button', { name: 'Voir la liste de courses' }).click();
  await page.waitForFunction(() => location.hash === '#/courses');
  await page.waitForTimeout(500);
  const courses = await text(page.locator('main'));
  check('Les articles sont sur la liste de Courses, quantités comprises', courses.includes('boeuf haché') && courses.includes('2 l') && courses.includes('600 g') && !courses.includes('oignons'), courses.slice(0, 300));
  await page.evaluate(() => (location.hash = '#/recettes'));
  await page.waitForSelector('.recettes-sheet, .recettes-grid, .recettes-menu');
  if (await page.locator('.recettes-sheet').count()) await sheet.getByRole('button', { name: '← Carnet' }).click();
  await page.getByRole('button', { name: /^Menu de la semaine/ }).click();
  await page.getByRole('button', { name: '🛒 Courses de la semaine' }).click();
  await page.waitForSelector('.recettes-shopping');
  check('« Oignons » reste « toujours là » la fois suivante', !(await line('oignons').locator('input[type="checkbox"]').isChecked()));
  await modal.getByRole('button', { name: /^Ajouter \d+ articles? aux courses/ }).click();
  await page.waitForSelector('.notice.info');
  check('Ce qui est déjà sur la liste est complété, pas dédoublé', (await text(page.locator('.notice.info'))).includes('déjà sur la liste, quantité complétée'));
  await page.getByRole('button', { name: /^Carnet/ }).click();

  // --- Le mode cuisine (étape 7) ---------------------------------------------------------------------
  await page.locator('.recettes-card', { hasText: 'Lasagnes' }).click();
  await sheet.getByRole('button', { name: '👩‍🍳 Cuisiner' }).click();
  const cook = page.locator('.recettes-cook');
  await page.waitForSelector('.recettes-cook');
  check('Le mode cuisine s’ouvre sur les ingrédients à réunir', (await text(cook.locator('.recettes-cook-label'))) === 'Réunir les ingrédients' && (await cook.locator('.recettes-cook-gather li').count()) === 5);
  check('Il dit si l’écran reste allumé', /L’écran (reste allumé|peut se mettre en veille)/.test(await text(cook.locator('.recettes-cook-sub'))));
  await cook.locator('.recettes-cook-gather input').first().check();
  check('Un ingrédient réuni se coche', (await cook.locator('.recettes-cook-gather label.done').count()) === 1);
  await cook.getByRole('button', { name: 'Commencer ›' }).click();
  check('Une étape à la fois, en grand', (await text(cook.locator('.recettes-cook-label'))) === 'Étape 1 / 2' && (await text(cook.locator('.recettes-cook-step'))).replace(/\s+/g, ' ') === 'Faire revenir les oignons ×3.', await text(cook.locator('.recettes-cook-step')));
  check('Avec les ingrédients dont elle parle', (await text(cook.locator('.recettes-cook-used'))).includes('3 oignons'));
  await page.keyboard.press('ArrowRight');
  check('Les flèches du clavier passent d’une étape à l’autre', (await text(cook.locator('.recettes-cook-label'))) === 'Étape 2 / 2');
  await cook.getByRole('button', { name: '⏱ Lancer 20:00' }).click();
  await page.waitForTimeout(1300);
  const clock = await text(cook.locator('.recettes-cook-clock'));
  check('« Cuire 20 minutes » donne un minuteur, qui tourne', /^19:5\d$/.test(clock), clock);
  await cook.getByRole('button', { name: 'Pause' }).click();
  const paused = await text(cook.locator('.recettes-cook-clock'));
  await page.waitForTimeout(1200);
  check('Un minuteur se met en pause', (await text(cook.locator('.recettes-cook-clock'))) === paused && (await cook.getByRole('button', { name: 'Reprendre' }).isVisible()));
  await page.keyboard.press('ArrowLeft');
  check('Il continue quand on change d’étape', (await cook.locator('.recettes-cook-running li').count()) === 1);
  await page.keyboard.press('Escape');
  check('Échap quitte le mode cuisine', (await page.locator('.recettes-cook').count()) === 0);
  await sheet.getByRole('button', { name: '← Carnet' }).click();

  // --- Les étapes en parallèle (§20) --------------------------------------------------------------
  await page.getByRole('button', { name: 'Nouvelle recette' }).click();
  await page.waitForSelector('#recettes-title');
  await page.locator('#recettes-title').fill('Pâtes aux lardons');
  await page.locator('#recettes-servings').fill('2');
  await page.locator('#recettes-ingredients').fill('200 g de pâtes\n150 g de lardons\n1 oignon\n2 œufs\n10 cl de crème');
  await page.locator('#recettes-steps').fill(
    [
      'Porter à ébullition une grande casserole d’eau salée.',
      'Pendant ce temps, émincer l’oignon.',
      'Faire revenir les lardons et l’oignon dans une poêle 7 minutes.',
      'Quand l’eau bout, cuire les pâtes 10 minutes.',
      'Battre les œufs avec la crème.',
      'Égoutter les pâtes et mélanger le tout hors du feu.',
    ].join('\n'),
  );
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.recettes-sheet');
  check('Une recette sans temps réglés n’a pas de plan', (await page.locator('.recettes-plan-panel').count()) === 0);

  await sheet.getByRole('button', { name: '⏱ Régler les temps' }).click();
  const timing = page.locator('.recettes-timing-editor');
  await timing.waitFor();
  check('« Régler les temps » propose d’après le texte, à vérifier', (await text(timing.locator('.recettes-timing-guessed'))).includes('à vérifier'));
  check(
    'Le poste et la durée sont devinés',
    (await timing.getByRole('group', { name: 'Poste de l’étape 1' }).getByRole('button', { name: 'Casserole' }).getAttribute('aria-pressed')) === 'true' &&
      (await timing.getByLabel('Durée de l’étape 4, en minutes').inputValue()) === '10',
  );
  check('« Quand l’eau bout » attend la fin de l’eau', (await timing.getByLabel('Quand commence l’étape 4').inputValue()).startsWith('end:'));
  check('Le plan se dessine en direct', (await timing.locator('.recettes-gantt-block').count()) === 6 && (await text(timing.locator('.recettes-plan-meta'))).startsWith('21 min'));
  // Un réglage à la main : les œufs au lancement, en même temps que l'oignon → deux gestes à la fois.
  await timing.getByLabel('Quand commence l’étape 5').selectOption('launch');
  check('Deux gestes en même temps sont signalés', (await text(timing.locator('.recettes-timing-conflict'))).includes('deux choses à faire de tes mains'));
  await timing.getByLabel('Quand commence l’étape 5').selectOption({ index: 1 });
  await timing.getByRole('button', { name: 'Enregistrer' }).click();
  await timing.waitFor({ state: 'detached' });
  const planPanel = page.locator('.recettes-plan-panel');
  await planPanel.waitFor();
  check(
    'La fiche montre le plan : une ligne par poste, et « Tes mains »',
    (await planPanel.locator('.recettes-gantt-lane').allTextContents()).map((t) => t.trim()).join(',') === 'Casserole,Plan de travail,Poêle,✋ Tes mains',
    (await planPanel.locator('.recettes-gantt-lane').allTextContents()).join(','),
  );
  check('Le chemin qui fixe la durée est marqué', (await planPanel.locator('.recettes-gantt-block.critical').count()) >= 2);

  // Modifier le texte de la recette garde les temps.
  await sheet.getByRole('button', { name: 'Modifier' }).click();
  await page.locator('#recettes-title').fill('Pâtes à la carbonara');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.recettes-sheet h1:has-text("carbonara")');
  check('Modifier la recette garde ses temps', (await planPanel.locator('.recettes-gantt-block').count()) === 6);

  // En cuisine, le mode par défaut d'une recette minutée.
  await sheet.getByRole('button', { name: '👩‍🍳 Cuisiner' }).click();
  const kitchen = page.locator('.recettes-kitchen');
  await kitchen.waitFor();
  check('« Cuisiner » ouvre « En cuisine » pour une recette minutée', (await text(kitchen.locator('.recettes-kitchen-big'))) === '21 min' && (await kitchen.getByRole('button', { name: '▶ Lancer' }).isVisible()));
  check('Avant de lancer, la mise en place : tout ce qu’il faut sortir et peser', (await text(kitchen.locator('.recettes-kitchen-gather'))).includes('150 g de lardons'));
  await kitchen.getByRole('button', { name: '▶ Lancer' }).click();
  await kitchen.locator('.recettes-kitchen-working').waitFor();
  check(
    'Lancer démarre l’eau et l’oignon : l’oignon en cours, l’eau en barre',
    (await text(kitchen.locator('.recettes-kitchen-working'))).includes('émincer l’oignon') && (await text(kitchen.locator('.recettes-kitchen-running'))).includes('ébullition'),
  );
  await kitchen.getByRole('button', { name: '✓ Fini' }).click();
  await kitchen.locator('.recettes-kitchen-due').waitFor();
  check('L’oignon fini, les lardons sont à faire maintenant', (await text(kitchen.locator('.recettes-kitchen-due'))).includes('lardons'));
  check('La quantité est écrite dans l’étape, à côté de l’ingrédient', (await kitchen.locator('.recettes-kitchen-due .recettes-amount').allTextContents()).map((t) => t.trim()).includes('150 g'), await text(kitchen.locator('.recettes-kitchen-due')));
  await kitchen.getByRole('button', { name: 'C’est parti' }).click();
  await kitchen.locator('.recettes-kitchen-soon').waitFor();
  check('Puis la suite est annoncée, avec le temps qui reste', /Dans \d+:\d\d/.test(await text(kitchen.locator('.recettes-kitchen-soon .recettes-kitchen-label'))));
  check('Deux choses cuisent en même temps', (await kitchen.locator('.recettes-kitchen-running li').count()) === 2);

  await page.reload();
  await page.locator('.recettes-card', { hasText: 'carbonara' }).click();
  await sheet.getByRole('button', { name: '👩‍🍳 Cuisiner' }).click();
  await kitchen.waitFor();
  check('Un rechargement reprend la cuisine où elle en était', (await kitchen.locator('.recettes-kitchen-running li').count()) === 2 && (await kitchen.getByRole('button', { name: '▶ Lancer' }).count()) === 0);
  await kitchen.getByRole('button', { name: 'Étape par étape' }).click();
  check('« Étape par étape » reste à portée de main', (await text(page.locator('.recettes-cook-label'))) === 'Réunir les ingrédients');
  await page.getByRole('button', { name: '⏱ En cuisine' }).click();
  await kitchen.waitFor();
  check('… et l’on revient « En cuisine » sans rien perdre', (await kitchen.locator('.recettes-kitchen-running li').count()) === 2);
  page.once('dialog', (d) => void d.accept());
  await kitchen.getByRole('button', { name: 'Quitter la cuisine' }).click();
  await kitchen.waitFor({ state: 'detached' });
  check('Quitter (après confirmation) oublie la cuisine en cours', (await page.evaluate(() => localStorage.getItem('recettes.kitchen.v1'))) === null);
  await sheet.getByRole('button', { name: '← Carnet' }).click();

  // --- La semaine type, les restes, l'échange de deux repas (§22) -----------------------------------
  /** Glisser une pastille sur une case, à la souris, par petits pas (le glisser part après 5 px). */
  const dragTo = async (from, to) => {
    // Par le nom du repas : ses petits boutons (🍳, ✕) gardent leur geste.
    const a = await from.locator('.recettes-menu-recipe, .recettes-menu-free').first().boundingBox();
    const b = await to.boundingBox();
    const [x0, y0, x1, y1] = [a.x + a.width / 2, a.y + a.height / 2, b.x + b.width / 2, b.y + b.height / 2];
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12);
    await page.mouse.up();
  };
  const tslot = (weekday, meal) => page.locator(`.recettes-template [data-meal-slot="${weekday}|${meal}"]`);
  await page.getByRole('button', { name: /^Semaine type/ }).click();
  await page.waitForSelector('.recettes-template');
  check('La semaine type s’ouvre, vide, du lundi au dimanche', (await text(page.locator('.recettes-template-summary'))).includes('vide') && (await page.locator('.recettes-template .recettes-menu-day').count()) === 7);
  await tslot(1, 'midi').locator('.recettes-menu-add').click();
  check('Une case de la semaine type se remplit comme une case du menu', (await text(modal.locator('.modal-title'))).includes('Midi du lundi — semaine type'));
  await modal.locator('.recettes-plan-option', { hasText: 'Lasagnes' }).click();
  for (let i = 0; i < 4; i++) await modal.getByRole('button', { name: 'Une personne de plus' }).click();
  await modal.getByRole('button', { name: 'Ajouter au menu' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-template [data-meal-slot="1|midi"]')?.textContent?.includes('Lasagnes'));
  check('À cuisiner : 🍳, ses parts et son temps', (await text(tslot(1, 'midi'))).includes('🍳') && (await text(tslot(1, 'midi'))).includes('×8'));
  await tslot(1, 'soir').locator('.recettes-menu-add').click();
  await modal.locator('.recettes-plan-option', { hasText: 'Lasagnes' }).click();
  await modal.getByRole('button', { name: '♻️ Des restes' }).click();
  check('Des restes n’ont pas de parts à choisir', (await modal.getByRole('group', { name: 'Nombre de personnes' }).count()) === 0);
  await modal.getByRole('button', { name: 'Ajouter au menu' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-template [data-meal-slot="1|soir"]')?.textContent?.includes('♻️'));
  check('Deux repas de suite pareils sont signalés', (await text(page.locator('.recettes-template-repeats'))).includes('Lasagnes à la bolognaise au soir du lundi'));
  check('Le résumé compte les fois en cuisine et les restes', (await text(page.locator('.recettes-template-summary'))).includes('2 repas sur 14 · 1 fois en cuisine · 1 repas de restes'));

  await dragTo(tslot(1, 'soir').locator('.recettes-menu-entry'), tslot(3, 'soir'));
  await page.waitForFunction(() => document.querySelector('.recettes-template [data-meal-slot="3|soir"]')?.textContent?.includes('Lasagnes'));
  check('Glisser un repas sur une case vide l’y déplace', !(await text(tslot(1, 'soir'))).includes('Lasagnes') && (await page.locator('.recettes-template-repeats').count()) === 0);
  await tslot(3, 'soir').getByRole('button', { name: /^Échanger le soir du mercredi/ }).click();
  check('« ⇄ » demande la case d’arrivée', (await text(page.locator('.recettes-grid-moving'))).includes('soir du mercredi'));
  await tslot(4, 'midi').getByRole('button', { name: 'Échanger avec le midi du jeudi' }).click();
  await page.waitForFunction(() => document.querySelector('.recettes-template [data-meal-slot="4|midi"]')?.textContent?.includes('Lasagnes'));
  check('… puis l’échange sans glisser', !(await text(tslot(3, 'soir'))).includes('Lasagnes'));
  await page.reload();
  await page.waitForSelector('.recettes-template');
  check('La semaine type est gardée, échanges compris', (await text(tslot(4, 'midi'))).includes('♻️') && (await text(tslot(1, 'midi'))).includes('🍳'));

  // Dans le menu d'une semaine : la semaine suivante, pour ne dépendre d'aucun jour de la semaine.
  await page.getByRole('button', { name: /^Menu de la semaine/ }).click();
  await page.getByRole('button', { name: 'Semaine suivante' }).click();
  await page.waitForSelector('.recettes-menu-offer');
  check('Une semaine vide propose la semaine type', (await text(page.locator('.recettes-menu-offer'))).includes('remplit 2 repas'));
  await page.getByRole('button', { name: '📋 Remplir avec la semaine type' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.recettes-menu-entry').length === 2);
  check('La semaine type se recopie dans le menu, restes compris', (await text(page.locator('.notice.info'))).includes('2 repas de ta semaine type mis au menu') && (await page.locator('.recettes-menu-entry.leftovers').count()) === 1);
  check('Recopiée, plus rien à proposer', (await page.locator('.recettes-menu-offer').count()) === 0 && (await page.getByRole('button', { name: '📋 Compléter avec la semaine type' }).count()) === 0);
  const mslot = (n, meal) => page.locator('.recettes-menu-day').nth(n).locator(`[data-meal-slot$="|${meal}"]`);
  await dragTo(mslot(0, 'midi').locator('.recettes-menu-entry'), mslot(3, 'midi'));
  await page.waitForFunction(() => document.querySelectorAll('.recettes-menu-day')[3]?.querySelectorAll('[data-meal-slot]')[0]?.textContent?.includes('🍳'));
  check('Au bureau lundi : le repas à cuisiner passe à jeudi, les restes de jeudi à lundi', (await text(mslot(0, 'midi'))).includes('♻️') && (await text(mslot(3, 'midi'))).includes('🍳'));
  await page.getByRole('button', { name: '🛒 Courses de la semaine' }).click();
  await page.waitForSelector('.recettes-shopping');
  check('Les courses ne comptent que ce qu’on cuisine, aux parts prévues', (await line('boeuf').locator('.recettes-shopping-qty').inputValue()) === '1,2 kg', await line('boeuf').locator('.recettes-shopping-qty').inputValue());
  await modal.getByRole('button', { name: 'Annuler' }).click();
  await mslot(3, 'midi').getByRole('button', { name: /à cuisiner — passer en restes/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.recettes-menu-entry.leftovers').length === 2);
  check('Que des restes : pas de courses', await page.getByRole('button', { name: '🛒 Courses de la semaine' }).isDisabled());
  await page.getByRole('button', { name: 'Revenir à cette semaine' }).click();
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
    await sheet.getByRole('button', { name: '👩‍🍳 Cuisiner' }).click();
    await page.getByRole('button', { name: 'Commencer ›' }).click();
    const cookFits = await fits();
    await page.getByRole('button', { name: 'Quitter le mode cuisine' }).click();
    await page.getByRole('button', { name: 'Nouvelle recette' }).click();
    const editorFits = await fits();
    await modal.getByRole('button', { name: 'Annuler' }).click();
    await sheet.getByRole('button', { name: '← Carnet' }).click();
    await page.getByRole('button', { name: /^Menu de la semaine/ }).click();
    await page.waitForSelector('.recettes-menu');
    const menuFits = await fits();
    await page.getByRole('button', { name: /^Semaine type/ }).click();
    await page.waitForSelector('.recettes-template');
    const templateFits = await fits();
    await page.getByRole('button', { name: /^Carnet/ }).click();
    check(`Rien ne déborde sur téléphone (${width} px) : carnet, fiche, cuisine, fenêtre, menu, semaine type`, notebook && sheetFits && cookFits && editorFits && menuFits && templateFits, `${notebook} ${sheetFits} ${cookFits} ${editorFits} ${menuFits} ${templateFits}`);
  }

  await page.getByRole('button', { name: 'Changer de module — Recettes' }).click();
  check('Le nom du module ouvre la grille des modules', await page.getByRole('dialog').isVisible());
  check('Aucune erreur dans la page', errors.length === 0, errors.join(' | '));

  await context.close();
}
