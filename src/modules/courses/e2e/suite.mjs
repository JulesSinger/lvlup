/**
 * Suite e2e du module courses (Comète).
 *
 * Étape 3 (docs/etude-courses.md §12) : la liste de courses, la V1. Un vrai
 * parcours — ajouter (rayon deviné), reprendre un article connu sans
 * doublon, régler une récurrence, cocher, noter un prix, retirer — plus le
 * rendu téléphone. « Terminer la course » arrive à l'étape 4.
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
  await page.waitForSelector('.courses-suggestion');
  check('Un article retiré reste connu et se propose à la frappe', (await page.locator('.courses-suggestion').first().textContent())?.includes('Piles AA') ?? false);
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
  await mp.locator('.courses-line-main', { hasText: 'Café' }).click();
  await mp.waitForSelector('.courses-item-editor');
  check(
    'Fenêtre d’un article sans débordement sur téléphone',
    await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await mobile.close();
}
