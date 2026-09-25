/**
 * Suite e2e du module courses (Comète).
 *
 * Étapes 3 et 4 (docs/etude-courses.md §12) : la liste de courses et la
 * clôture d'une course. Un vrai parcours — ajouter (rayon deviné), reprendre
 * un article connu sans doublon, régler une récurrence, cocher, noter un
 * prix, retirer, puis trois courses terminées d'affilée pour vérifier que
 * chaque habituel revient à son tour — plus le rendu téléphone.
 */

/**
 * Texte d'un élément, espaces normalisées : les milliers s'affichent avec
 * l'espace fine insécable du français.
 */
async function text(locator) {
  return ((await locator.textContent()) ?? '').replace(/\s/g, ' ');
}

async function openComete(page, BASE) {
  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Comète/ }).click();
  await page.waitForSelector('.courses-add');
}

async function addItem(page, name) {
  await page.getByLabel('Ajouter un article').fill(name);
  await page.getByLabel('Ajouter un article').press('Enter');
  await page.waitForFunction(
    (n) => [...document.querySelectorAll('.courses-line-name')].some((el) => el.textContent === n),
    name,
  );
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Comète/ });
  check('La carte Comète apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Comète dit ce que fait le module', (await card.textContent())?.includes('Liste de courses') ?? false);
  await card.click();
  await page.waitForSelector('.courses-add');
  check('Une liste vide invite à ajouter et explique les habituels', (await page.locator('.courses-empty').textContent())?.includes('habituels') ?? false);

  // --- Ajouter : le rayon se devine -------------------------------------------
  await addItem(page, 'Lait demi-écrémé');
  await addItem(page, 'Tomates');
  await addItem(page, 'Piles AA');
  const aisles = await page.locator('.courses-aisle-title').allTextContents();
  check(
    'La liste est rangée par rayon, dans l’ordre d’un parcours de magasin',
    JSON.stringify(aisles) === JSON.stringify(['Fruits et légumes', 'Crèmerie', 'Autre']),
    aisles.join(' | '),
  );
  check('Le champ se vide après un ajout', (await page.getByLabel('Ajouter un article').inputValue()) === '');
  check(
    'Les suggestions se referment après un ajout (elles recouvriraient l’article ajouté)',
    (await page.locator('.courses-suggestions').count()) === 0,
  );

  // --- Récurrence et quantité ---------------------------------------------------
  await page.locator('.courses-line-main', { hasText: 'Lait demi-écrémé' }).click();
  await page.waitForSelector('.courses-item-editor');
  await page.locator('#courses-recurrence').selectOption('1');
  await page.locator('#courses-default-quantity').fill('2');
  await page.locator('#courses-quantity').fill('2');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.courses-item-editor', { state: 'detached' });
  check(
    'La ligne affiche sa quantité et sa récurrence',
    (await page.locator('.courses-line', { hasText: 'Lait' }).locator('.courses-line-meta').textContent()) === '2 · à chaque course',
  );

  // Un nom déjà connu reprend l'article existant, sans doublon au catalogue.
  await page.locator('.courses-line-main', { hasText: 'Piles AA' }).click();
  await page.getByRole('button', { name: 'Retirer de la liste' }).click();
  await page.waitForSelector('.courses-item-editor', { state: 'detached' });
  check('« Retirer de la liste » enlève la ligne', (await page.locator('.courses-line', { hasText: 'Piles' }).count()) === 0);
  await page.getByLabel('Ajouter un article').fill('pil');
  // Attendre la suggestion avec son texte en une fois : la trouver puis la
  // relire laisse une fenêtre où elle peut se refermer (délai de fermeture
  // au changement de focus), sous la charge des suites en parallèle.
  const suggested = await page
    .waitForFunction(() => document.querySelector('.courses-suggestion')?.textContent?.includes('Piles AA'), null, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check('Un article retiré reste connu et se propose à la frappe', suggested);
  await page.locator('.courses-suggestion').first().dispatchEvent('mousedown');
  await page.waitForSelector('.courses-line:has-text("Piles AA")');
  await page.getByLabel('Ajouter un article').fill('PILES aa');
  await page.getByLabel('Ajouter un article').press('Enter');
  await page.waitForTimeout(300);
  check('Retaper le nom d’un article déjà sur la liste (casse différente) n’ajoute pas de seconde ligne', (await page.locator('.courses-line', { hasText: 'Piles' }).count()) === 1);
  await page.getByLabel('Ajouter un article').fill('');

  // --- En magasin : cocher, noter un prix ---------------------------------------
  const lait = page.locator('.courses-line', { hasText: 'Lait' });
  await lait.getByRole('checkbox').click();
  check('Cocher met l’article dans le panier', (await lait.getAttribute('class'))?.includes('checked') ?? false);
  check('Un article coché attend son prix', await lait.locator('.courses-price').isVisible());
  await lait.locator('.courses-price').fill('2,38');
  await lait.locator('.courses-price').press('Enter');
  await page.waitForFunction(() => document.querySelector('.courses-summary-basket')?.textContent?.includes('2,38'));
  check('Le panier additionne les prix saisis', (await text(page.locator('.courses-summary-basket'))).includes('Panier : 2,38 €'));

  const tomates = page.locator('.courses-line', { hasText: 'Tomates' });
  await tomates.getByRole('checkbox').click();
  await tomates.locator('.courses-price').fill('abc');
  await tomates.locator('.courses-price').press('Enter');
  check('Un prix illisible est signalé, pas enregistré', (await tomates.locator('.courses-price').getAttribute('class'))?.includes('invalid') ?? false);
  check('Le panier compte ce qui n’a pas de prix', (await text(page.locator('.courses-summary-basket'))).includes('(1 sans prix)'));
  await tomates.getByRole('checkbox').click();
  check('Décocher retire du panier', !((await tomates.getAttribute('class'))?.includes('checked') ?? true));
  check('Le résumé compte ce qui reste à prendre', (await text(page.locator('.courses-summary'))).includes('2 à prendre · 1 dans le panier'));

  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Comète/ }).click();
  await page.waitForSelector('.courses-line');
  check(
    'La liste, les coches et les prix survivent à un rechargement',
    (await page.locator('.courses-line.checked', { hasText: 'Lait' }).count()) === 1 &&
      (await page.locator('.courses-line', { hasText: 'Lait' }).locator('.courses-price').inputValue()) === '2,38',
  );

  // --- Supprimer un article du catalogue ----------------------------------------
  await page.locator('.courses-line-main', { hasText: 'Piles AA' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Supprimer l’article' }).click();
  await page.waitForSelector('.courses-item-editor', { state: 'detached' });
  await page.getByLabel('Ajouter un article').fill('pil');
  await page.waitForTimeout(200);
  check('Un article supprimé disparaît de la liste et des suggestions', (await page.locator('.courses-suggestion').count()) === 0 && (await page.locator('.courses-line', { hasText: 'Piles' }).count()) === 0);
  await page.getByLabel('Ajouter un article').fill('');

  // --- Terminer la course (étape 4) --------------------------------------------
  // État à ce stade : Lait (habituel, à chaque course) coché à 2,38 € ; Tomates (ponctuel) non coché.
  await addItem(page, 'Lessive');
  await page.locator('.courses-line-main', { hasText: 'Lessive' }).click();
  await page.locator('#courses-recurrence').selectOption('3');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.courses-item-editor', { state: 'detached' });
  const lessive = page.locator('.courses-line', { hasText: 'Lessive' });
  await lessive.getByRole('checkbox').click();
  await lessive.locator('.courses-price').fill('8,99');
  await lessive.locator('.courses-price').press('Enter');
  await page.locator('.courses-line', { hasText: 'Tomates' }).getByRole('checkbox').click();
  await page.waitForFunction(() => document.querySelector('.courses-summary-basket')?.textContent?.includes('11,37'));

  await page.getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog');
  check('La fenêtre récapitule le panier', (await page.locator('.courses-close-recap').textContent())?.includes('3 articles dans le panier') ?? false);
  check('Le total est proposé d’après les prix saisis', (await page.locator('#courses-close-total').inputValue()) === '11,37');
  check(
    'Elle dit ce qui n’a pas de prix, et que le ticket fait foi',
    (await text(page.locator('.courses-close-dialog .field-hint'))).includes('(1 article sans prix). Le ticket fait foi.'),
  );
  await page.getByLabel('Magasin').fill('Leclerc');
  await page.locator('#courses-close-total').fill('12,50');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog', { state: 'detached' });
  check(
    'La course est enregistrée avec le total du ticket, et le dit',
    (await text(page.locator('.courses-notice'))).includes('Course enregistrée : 12,50 € chez Leclerc. 1 habituel remis sur la liste.'),
    await text(page.locator('.courses-notice')),
  );
  const names = await page.locator('.courses-line-name').allTextContents();
  check('L’habituel « à chaque course » revient sur la liste, décoché', JSON.stringify(names) === JSON.stringify(['Lait demi-écrémé']) && (await page.locator('.courses-line.checked').count()) === 0, names.join(' | '));
  check('Il revient avec sa quantité habituelle', (await page.locator('.courses-line-meta').first().textContent())?.startsWith('2') ?? false);
  check('Sans rien dans le panier, pas de bouton « Terminer la course »', (await page.getByRole('button', { name: 'Terminer la course' }).count()) === 0);

  await page.getByRole('tab', { name: /Courses/ }).click();
  await page.waitForSelector('.courses-trip');
  check('L’historique montre la course, son magasin et son total', (await text(page.locator('.courses-trip-head').first())).includes('Leclerc · 3 articles') && (await text(page.locator('.courses-trip-total').first())) === '12,50 €');
  await page.locator('.courses-trip-head').first().click();
  check('Déplier une course montre ce qui a été acheté, avec les prix figés', (await page.locator('.courses-trip-item').count()) === 3 && (await text(page.locator('.courses-trip-item', { hasText: 'Lait' }))).includes('2,38 €'));

  // Deuxième course : le magasin se propose, le dernier prix aussi.
  await page.getByRole('tab', { name: 'Liste' }).click();
  const lait2 = page.locator('.courses-line', { hasText: 'Lait' });
  await lait2.getByRole('checkbox').click();
  const hint = ((await lait2.locator('.courses-price').getAttribute('placeholder')) ?? '').replace(/\s/g, ' ');
  check('Le dernier prix payé s’affiche en indice', hint === '2,38 €', hint);
  await page.getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog');
  check('Le magasin habituel est choisi par défaut', (await page.getByRole('radio', { name: 'Leclerc' }).getAttribute('aria-checked')) === 'true');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  check('Sans total, la course est refusée avec une explication', (await page.locator('.courses-close-dialog .notice.error').textContent())?.includes('total payé') ?? false);
  await page.locator('#courses-close-total').fill('2,50');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog', { state: 'detached' });
  check('Après la course n° 2, la lessive (toutes les 3 courses) n’est pas encore revenue', (await page.locator('.courses-line', { hasText: 'Lessive' }).count()) === 0);

  // Troisième course : la lessive, achetée à la n° 1, revient pour la n° 4.
  await page.locator('.courses-line', { hasText: 'Lait' }).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Terminer la course' }).click();
  await page.locator('#courses-close-total').fill('2,40');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog', { state: 'detached' });
  check('Après la course n° 3, la lessive revient à son tour', (await page.locator('.courses-line', { hasText: 'Lessive' }).count()) === 1);
  check('Le compte rendu compte les deux habituels remis', (await text(page.locator('.courses-notice'))).includes('2 habituels remis sur la liste.'));

  await page.getByRole('tab', { name: /Courses/ }).click();
  check('L’onglet compte les courses', (await page.getByRole('tab', { name: /Courses/ }).textContent()) === 'Courses (3)');
  await page.locator('.courses-trip-head').first().click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Supprimer cette course' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.courses-trip').length === 2);
  check('Supprimer une course la retire de l’historique', (await page.locator('.courses-trip').count()) === 2);
  await page.getByRole('tab', { name: 'Liste' }).click();

  await page.getByRole('button', { name: 'Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());
  await context.close();

  // --- Téléphone ------------------------------------------------------------------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mobile.newPage();
  await openComete(mp, BASE);
  await addItem(mp, 'Papier toilette triple épaisseur, lot de douze rouleaux');
  await addItem(mp, 'Café moulu');
  await mp.locator('.courses-line', { hasText: 'Café' }).getByRole('checkbox').click();
  check(
    'Liste sans débordement horizontal sur téléphone, même avec un nom long et un prix',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check('La barre du haut passe en icônes seules sur téléphone', !(await mp.locator('.courses-topbar-label').first().isVisible()));
  await mp.getByRole('button', { name: 'Terminer la course' }).click();
  await mp.waitForSelector('.courses-close-dialog');
  check(
    'Fenêtre « Terminer la course » sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mp.getByLabel('Magasin').fill('Intermarché du centre-ville');
  await mp.locator('#courses-close-total').fill('4,20');
  await mp.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await mp.waitForSelector('.courses-close-dialog', { state: 'detached' });
  await mp.getByRole('tab', { name: /Courses/ }).click();
  await mp.locator('.courses-trip-head').first().click();
  check(
    'Historique déplié sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mp.getByRole('tab', { name: 'Liste' }).click();
  await addItem(mp, 'Café moulu');
  await mp.locator('.courses-line-main', { hasText: 'Café' }).click();
  await mp.waitForSelector('.courses-item-editor');
  check(
    'Fenêtre d’un article sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mobile.close();
}
