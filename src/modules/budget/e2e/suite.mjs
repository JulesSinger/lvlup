/**
 * Suite e2e du module budget (Astra).
 *
 * Étapes 2 à 4 (docs/etude-astra.md §7) : les catégories se créent et
 * s'éditent, le module devient utilisable seul grâce à la saisie manuelle
 * et à la liste des opérations, et l'onglet « Aperçu » ajoute le camembert
 * du mois, son total et son sélecteur — « la V1 est atteinte ». C'est
 * désormais l'onglet par défaut : Astra s'ouvre sur la réponse à « où en
 * est mon mois ? », les catégories passent en second. Comme la suite
 * Zénith, elle part d'un contexte frais et entre dans la carte Astra du hub
 * — voir `modules/objectifs/e2e/suite.mjs` pour le même motif, conséquence
 * du deuxième module désormais enregistré.
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
  check(
    'Astra s’ouvre sur l’onglet Aperçu, pas Catégories',
    (await page.locator('.budget-tab', { hasText: 'Aperçu' }).getAttribute('class'))?.includes('active') ?? false,
  );
  check('Écran vide affiché à la première visite (aucune écriture ce mois-ci)', await page.locator('.empty h3').isVisible());

  // --- Création manuelle -------------------------------------------------
  await page.getByRole('button', { name: 'Catégories' }).click();
  check("L'onglet Catégories affiche aussi son écran vide", await page.locator('.empty h3').isVisible());
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
  // Le rechargement retombe sur l'onglet Aperçu (l'onglet par défaut) : il
  // faut recliquer sur Catégories pour retrouver la catégorie créée.
  await reloadAstra(page);
  await page.getByRole('button', { name: 'Catégories' }).click();
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

  // --- Opérations, sous le camembert du mois (étapes 3 et 4) ---------------
  await page.getByRole('button', { name: 'Aperçu' }).click();
  check("L'onglet Aperçu affiche l'écran vide", await page.locator('.empty h3').isVisible());

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

  // --- Camembert du mois (étape 4) ------------------------------------------
  // Une dépense sans catégorie doit apparaître dans le camembert sous « À
  // classer » plutôt que disparaître du total (docs/etude-astra.md §2). Le
  // camembert agrège par catégorie (donc ici, par « pas de catégorie ») :
  // avec le remboursement d'ami (+20 €) déjà présent, une nouvelle dépense
  // non catégorisée de 30 € laisse le groupe « à classer » à un net de
  // -10 €, qui est bien ce qui doit apparaître comme part (le net positif
  // du remboursement seul, lui, n'aurait pas fait de part — voir
  // lib/monthlyBreakdown.ts).
  await page.getByRole('button', { name: '+ Nouvelle écriture' }).click();
  await page.locator('#budget-entry-label').fill('Distributeur');
  await page.locator('#budget-entry-amount').fill('30');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);

  check(
    'Le camembert affiche deux parts : Courses et À classer',
    (await page.locator('.budget-pie-legend-item').count()) === 2,
  );
  check(
    'La part « Courses » affiche le bon montant',
    ((await page.locator('.budget-pie-legend-item', { hasText: 'Courses' }).textContent()) ?? '').includes('50,00'),
  );
  check(
    'La part « À classer » nette le remboursement et la dépense (30 - 20 = 10 €)',
    ((await page.locator('.budget-pie-legend-item', { hasText: 'À classer' }).textContent()) ?? '').includes('10,00'),
  );
  check(
    'Le total dépensé du mois est la somme des deux parts (50 + 10 = 60 €)',
    (await page.locator('.budget-month-total-amount').textContent())?.trim() === '-60,00 €',
  );

  // --- Filtrage par clic sur une part -----------------------------------------
  // La part « à classer » regroupe toutes les écritures sans catégorie : le
  // filtre montre donc le remboursement ET la dépense, pas seulement celle
  // qui vient d'être ajoutée.
  await page.locator('.budget-pie-legend-item', { hasText: 'À classer' }).click();
  await page.waitForTimeout(150);
  check(
    'Cliquer la part « À classer » filtre la liste sur les deux écritures non catégorisées',
    (await page.locator('.budget-entry-row').count()) === 2,
  );
  // Le contour de sélection est un <path> à part, redessiné par-dessus les
  // parts (voir PieChart.tsx) : il doit exister et être le dernier enfant
  // du SVG, sans quoi une part voisine dessinée après lui reviendrait
  // masquer un de ses côtés.
  check(
    'Le contour de sélection du camembert est redessiné au-dessus des parts',
    await page.evaluate(() => {
      const svg = document.querySelector('.budget-pie');
      const outline = svg?.querySelector('.budget-pie-slice-outline');
      return !!outline && svg.lastElementChild === outline;
    }),
  );
  check(
    'Le filtre exclut bien Courses de la semaine',
    (await page.locator('.budget-entry-row', { hasText: 'Courses de la semaine' }).count()) === 0,
  );
  check(
    'La notice de filtre est visible et nomme la part',
    ((await page.locator('.budget-filter-notice').textContent()) ?? '').includes('À classer'),
  );
  await page.locator('.budget-pie-legend-item', { hasText: 'À classer' }).click();
  await page.waitForTimeout(150);
  check('Recliquer la même part retire le filtre', (await page.locator('.budget-entry-row').count()) === 3);
  check('La notice de filtre disparaît', (await page.locator('.budget-filter-notice').count()) === 0);

  // --- Sélecteur de mois -------------------------------------------------------
  const currentMonthText = await page.locator('.budget-month-label').textContent();
  await page.getByRole('button', { name: 'Mois précédent' }).click();
  await page.waitForTimeout(150);
  check(
    'Le mois précédent change le libellé et affiche un camembert vide',
    (await page.locator('.budget-month-label').textContent()) !== currentMonthText &&
      (await page.locator('.budget-pie-empty').isVisible()),
  );
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await page.waitForTimeout(150);
  check(
    'Revenir au mois suivant réaffiche le mois courant et son camembert',
    (await page.locator('.budget-month-label').textContent()) === currentMonthText,
  );

  // On retire l'écriture ajoutée pour ce test, afin de ne pas perturber les
  // vérifications de suppression ci-dessous, écrites pour l'étape 3.
  page.once('dialog', (d) => d.accept());
  await page
    .locator('.budget-entry-row', { hasText: 'Distributeur' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await page.waitForTimeout(200);
  check('Deux écritures après nettoyage du test du camembert', (await page.locator('.budget-entry-row').count()) === 2);

  // --- Persistance -----------------------------------------------------------
  // Un rechargement retombe sur l'onglet Aperçu (l'onglet par défaut) : rien
  // à cliquer pour l'atteindre, contrairement à l'étape 3.
  await reloadAstra(page);
  check(
    'Le rechargement retombe directement sur Aperçu',
    (await page.locator('.budget-tab', { hasText: 'Aperçu' }).getAttribute('class'))?.includes('active') ?? false,
  );
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
