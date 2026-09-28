/**
 * Suite e2e du module courses (Courses).
 *
 * Étapes 3 à 6 (docs/etude-courses.md §12) : la liste de courses, la
 * clôture d'une course, les chiffres et le lien avec le Budget. Un vrai parcours — ajouter (rayon deviné), reprendre
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
  await page.getByRole('button', { name: /Courses/ }).click();
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
  const card = page.getByRole('button', { name: /Courses/ });
  check('La carte Courses apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Courses dit ce que fait le module', (await card.textContent())?.includes('le magasin') ?? false);
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
  await page.getByRole('button', { name: /Courses/ }).click();
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
  check(
    'La dépense part au budget par défaut (case cochée)',
    await page.getByLabel('Ajouter la dépense au Budget (catégorie Courses)').isChecked(),
  );
  await page.getByLabel('Magasin').fill('Leclerc');
  await page.locator('#courses-close-total').fill('12,50');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog', { state: 'detached' });
  check(
    'La course est enregistrée avec le total du ticket, et le dit — ajout au budget compris',
    (await text(page.locator('.courses-notice'))).includes('Course enregistrée : 12,50 € chez Leclerc. 1 habituel remis sur la liste. Ajoutée au budget.'),
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

  // --- Chiffres (étape 5) --------------------------------------------------------
  // Restent deux courses, toutes deux ce mois-ci chez Leclerc : 12,50 € et 2,50 €.
  await page.getByRole('tab', { name: 'Chiffres' }).click();
  await page.waitForSelector('.courses-stats');
  const keys = await page.locator('.courses-stats-key').allTextContents();
  check('Ce mois-ci : le total et le nombre de courses', (keys[0] ?? '').replace(/\s/g, ' ').includes('15,00 €2 courses'), keys[0]);
  check('Le panier moyen, et sur combien de courses', (keys[1] ?? '').replace(/\s/g, ' ').includes('7,50 €sur 2 courses'), keys[1]);
  check('La barre du mois en cours porte son total, arrondi à l’euro', (await text(page.locator('.courses-chart-month.current .courses-chart-value'))) === '15 €');
  check(
    'Le tableau par magasin compte les courses, le total et le panier moyen',
    (await text(page.locator('.courses-stats-table tbody tr').first())) === 'Leclerc215,00 €7,50 €',
    await text(page.locator('.courses-stats-table tbody tr').first()),
  );
  const tracked = await page.locator('.courses-stats-select option').allTextContents();
  check('Seuls les articles avec un prix se suivent, par ordre alphabétique', JSON.stringify(tracked) === JSON.stringify(['Lait demi-écrémé', 'Lessive']), tracked.join(' | '));
  check('Le dernier prix d’un article et son magasin', (await text(page.locator('.courses-price-summary'))).includes('Dernier prix 2,38 € chez Leclerc'));
  await page.locator('.courses-stats-select').selectOption({ label: 'Lessive' });
  check('Changer d’article change son historique', (await text(page.locator('.courses-price-summary'))).includes('8,99 €'));
  await page.getByRole('tab', { name: 'Liste' }).click();

  // --- Le lien avec le budget (étape 6) -------------------------------------------
  // Restent les courses n° 1 (12,50 €) et n° 2 (2,50 €), envoyées au budget ; la n° 3 a été supprimée.
  await page.getByRole('tab', { name: /Courses/ }).click();
  await page.locator('.courses-trip-head').first().click();
  await page.waitForSelector('.courses-trip-budget');
  check('L’historique dit qu’une course est dans le budget', (await page.locator('.courses-trip-budget').textContent()) === 'Dans le Budget ✓');

  // Une course terminée sans l'envoyer, puis envoyée après coup.
  await page.getByRole('tab', { name: 'Liste' }).click();
  await page.locator('.courses-line', { hasText: 'Lait' }).getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Terminer la course' }).click();
  await page.getByLabel('Ajouter la dépense au Budget (catégorie Courses)').uncheck();
  await page.locator('#courses-close-total').fill('3,10');
  await page.locator('.courses-close-dialog').getByRole('button', { name: 'Terminer la course' }).click();
  await page.waitForSelector('.courses-close-dialog', { state: 'detached' });
  check('Case décochée : la course n’est pas envoyée, et le compte rendu n’en parle pas', !(await text(page.locator('.courses-notice'))).includes('budget'));
  await page.getByRole('tab', { name: /Courses/ }).click();
  await page.locator('.courses-trip-head').first().click();
  const sendLater = page.getByRole('button', { name: 'Ajouter au budget' });
  check('Une course absente du budget propose de l’y ajouter', await sendLater.isVisible());
  await sendLater.click();
  await page.waitForSelector('.courses-trip-budget');
  check('Ajoutée après coup, elle est dans le budget', (await page.locator('.courses-trip-budget').textContent()) === 'Dans le Budget ✓');
  await page.locator('.courses-trip-head').first().click();
  page.once('dialog', (d) => void d.accept());
  await page.locator('.courses-trip-head').first().click();
  await page.getByRole('button', { name: 'Supprimer cette course' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.courses-trip').length === 2);

  // De l'autre côté : Budget a reçu les dépenses, et perdu celles des courses supprimées.
  // (Seule vérification qui entre dans un autre module : c'est l'objet même du lien.)
  await page.getByRole('button', { name: 'Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Budget/ }).click();
  await page.waitForSelector('.budget-tab');
  const budgetRows = page.locator('.budget-entry-row', { hasText: 'Courses — Leclerc' });
  await budgetRows.first().waitFor({ timeout: 10000 }).catch(() => {});
  const amounts = (await budgetRows.locator('.budget-row-amount').allTextContents()).map((t) => t.replace(/\s/g, ' ')).sort();
  check(
    'Budget a les dépenses des courses restantes, avec leur montant — pas celles des courses supprimées',
    JSON.stringify(amounts) === JSON.stringify(['-12,50 €', '-2,50 €']),
    amounts.join(' | '),
  );
  check(
    'Sans catégorie « Courses » créée dans Budget, la dépense y est « à classer »',
    (await budgetRows.first().locator('.budget-row-category').textContent()) === 'À classer',
  );
  await page.getByRole('button', { name: /Modules/ }).first().click();
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Courses/ }).click();
  await page.waitForSelector('.courses-add');

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
  await mp.getByRole('tab', { name: 'Chiffres' }).click();
  await mp.waitForSelector('.courses-stats');
  check(
    'Chiffres sans débordement sur téléphone',
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
