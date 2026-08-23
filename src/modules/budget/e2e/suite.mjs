/**
 * Suite e2e du module budget (Astra).
 *
 * Étapes 2 et 3 (docs/etude-astra.md §7) : les catégories se créent et
 * s'éditent, et le module devient utilisable seul grâce à la saisie
 * manuelle et à la liste des opérations. Comme la suite Zénith, elle part
 * d'un contexte frais et entre dans la carte Astra du hub — voir
 * `modules/objectifs/e2e/suite.mjs` pour le même motif, conséquence du
 * deuxième module désormais enregistré.
 */

async function enterAstra(p, base) {
  await p.goto(base);
  await p.waitForSelector('.hub-picker-card');
  await p.getByRole('button', { name: /Astra/ }).click();
}

/**
 * Un rechargement repasse toujours par l'écran de choix — `moduleId` n'est
 * pas persisté côté hub (voir `App.tsx`) — donc reentrer dans Astra fait
 * partie du rechargement, pas une étape à part.
 */
async function reloadAstra(p) {
  await p.reload();
  await p.waitForSelector('.hub-picker-card');
  await p.getByRole('button', { name: /Astra/ }).click();
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await enterAstra(page, BASE);
  check('Écran vide affiché à la première visite', await page.locator('.empty h3').isVisible());

  // --- Création manuelle -------------------------------------------------
  await page.getByRole('button', { name: 'Créer ma première catégorie' }).click();
  check("L'éditeur s'ouvre", await page.locator('.budget-category-editor').isVisible());

  await page.locator('#budget-category-name').fill('Courses');
  // Choisir un emoji et une couleur autres que ceux par défaut, pour
  // vérifier qu'ils sont bien pris en compte et pas juste ignorés.
  await page.locator('.budget-emoji-grid .budget-swatch-btn').nth(3).click();
  await page.locator('.budget-color-grid .budget-swatch-btn').nth(2).click();
  await page.locator('#budget-category-kind').selectOption('variable');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.waitForSelector('.budget-row');
  check(
    'La catégorie créée apparaît dans son groupe',
    (await page.locator('.budget-group-title').first().textContent()) === 'Variables',
  );
  check(
    'Une seule ligne, avec le bon nom',
    (await page.locator('.budget-row-name').allTextContents()).join(',') === 'Courses',
  );

  // --- Édition -------------------------------------------------------------
  await page.getByRole('button', { name: 'Modifier' }).click();
  check("L'éditeur se pré-remplit", (await page.locator('#budget-category-name').inputValue()) === 'Courses');
  await page.locator('#budget-category-name').fill('Courses & marché');
  await page.locator('#budget-category-kind').selectOption('fixe');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check(
    'Le renommage et le changement de nature sont pris en compte',
    (await page.locator('.budget-group-title').first().textContent()) === 'Fixes' &&
      (await page.locator('.budget-row-name').first().textContent()) === 'Courses & marché',
  );

  // --- Persistance ---------------------------------------------------------
  await reloadAstra(page);
  check('La catégorie survit au rechargement', (await page.locator('.budget-row').count()) === 1);

  // --- Suppression -----------------------------------------------------------
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.empty h3');
  check('Supprimer la seule catégorie ramène à l’écran vide', await page.locator('.empty h3').isVisible());

  // --- Catégories de départ -------------------------------------------------
  await page.getByRole('button', { name: 'Charger les catégories de départ' }).click();
  await page.waitForSelector('.budget-row');
  check(
    'Les quatre groupes de catégories de départ sont représentés',
    (await page.locator('.budget-group-title').count()) === 4,
  );
  check(
    'Le groupe « Transferts » existe (exclu du camembert, voir etude-astra.md §2)',
    (await page.locator('.budget-group-title', { hasText: 'Transferts' }).count()) === 1,
  );
  const rowCount = await page.locator('.budget-row').count();
  check('Une vingtaine de catégories de départ chargées', rowCount >= 15, String(rowCount));

  // --- Opérations (étape 3) ------------------------------------------------
  await page.getByRole('button', { name: 'Opérations' }).click();
  check("L'onglet Opérations affiche l'écran vide", await page.locator('.empty h3').isVisible());

  await page.getByRole('button', { name: 'Ajouter une écriture' }).click();
  check("L'éditeur d'écriture s'ouvre", await page.locator('.budget-entry-editor').isVisible());
  await page.locator('#budget-entry-label').fill('Courses de la semaine');
  await page.locator('#budget-entry-amount').fill('45,90');
  await page.locator('#budget-entry-category').selectOption({ label: '🛒 Courses' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.waitForSelector('.budget-entry-row');
  check(
    'La dépense apparaît, signée et catégorisée',
    (await page.locator('.budget-row-amount').first().textContent()) === '-45,90 €' &&
      (await page.locator('.budget-row-category').first().textContent()) === 'Courses',
  );
  check('Une dépense est en rouge, pas en vert', await page.locator('.budget-row-amount.negative').isVisible());

  // Une entrée d'argent sans catégorie : elle doit apparaître « à classer »,
  // visible plutôt que masquée (docs/etude-astra.md §2).
  await page.getByRole('button', { name: '+ Nouvelle écriture' }).click();
  await page.locator('#budget-entry-label').fill('Remboursement ami');
  await page.getByRole('button', { name: '+ Entrée' }).click();
  await page.locator('#budget-entry-amount').fill('20');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check('Deux écritures dans la liste', (await page.locator('.budget-entry-row').count()) === 2);
  check(
    'Une entrée sans catégorie reste visible, « à classer »',
    (await page.locator('.budget-row-category', { hasText: 'À classer' }).count()) === 1,
  );
  check('Une entrée d’argent est en vert', await page.locator('.budget-row-amount.positive').isVisible());

  // --- Édition d'une écriture -----------------------------------------------
  await page.locator('.budget-entry-row', { hasText: 'Courses de la semaine' }).getByRole('button', { name: 'Modifier' }).click();
  check(
    "L'éditeur d'écriture se pré-remplit",
    (await page.locator('#budget-entry-amount').inputValue()) === '45,90',
  );
  await page.locator('#budget-entry-amount').fill('50');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check(
    'La correction du montant est prise en compte',
    (await page.locator('.budget-entry-row', { hasText: 'Courses de la semaine' }).locator('.budget-row-amount').textContent()) ===
      '-50,00 €',
  );

  // --- Persistance -----------------------------------------------------------
  await reloadAstra(page);
  await page.getByRole('button', { name: 'Opérations' }).click();
  check('Les écritures survivent au rechargement', (await page.locator('.budget-entry-row').count()) === 2);

  // --- Suppression -----------------------------------------------------------
  page.on('dialog', (d) => d.accept());
  await page
    .locator('.budget-entry-row', { hasText: 'Remboursement ami' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await page.waitForTimeout(200);
  check('Une seule écriture après suppression', (await page.locator('.budget-entry-row').count()) === 1);

  await page.getByRole('button', { name: '← Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Le retour ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

  await context.close();
}
