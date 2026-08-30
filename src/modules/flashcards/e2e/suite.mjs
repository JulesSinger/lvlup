/**
 * Suite e2e du module flashcards (Orbite).
 *
 * Étapes 2, 3 et 5 (docs/etude-flashcards.md §9) : « les paquets se créent,
 * se renomment, s'archivent », puis « le contenu existe » — les cartes d'un
 * paquet se créent, s'éditent, se suppriment —, puis « le module devient
 * utilisable seul » — une carte due se révise, recto puis verso, juste ou
 * faux. Comme la suite Astra, elle part d'un contexte frais et entre dans
 * la carte Orbite du hub — voir `modules/objectifs/e2e/suite.mjs` pour le
 * même motif.
 */

async function enterOrbite(p, base) {
  await p.goto(base);
  await p.waitForSelector('.hub-picker-card');
  await p.getByRole('button', { name: /Orbite/ }).click();
}

/**
 * Un rechargement repasse toujours par l'écran de choix — `moduleId` n'est
 * pas persisté côté hub (voir `App.tsx`) — donc reentrer dans Orbite fait
 * partie du rechargement, pas une étape à part.
 */
async function reloadOrbite(p) {
  await p.reload();
  await p.waitForSelector('.hub-picker-card');
  await p.getByRole('button', { name: /Orbite/ }).click();
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await enterOrbite(page, BASE);
  check('Écran vide affiché à la première visite', await page.locator('.empty h3').isVisible());

  // --- Création ------------------------------------------------------------
  await page.getByRole('button', { name: 'Créer mon premier paquet' }).click();
  check("L'éditeur s'ouvre", await page.locator('.flashcards-deck-editor').isVisible());

  await page.locator('#flashcards-deck-name').fill('Vocabulaire espagnol');
  await page.locator('.flashcards-emoji-grid .flashcards-swatch-btn').nth(3).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.waitForSelector('.flashcards-row');
  check(
    'Le paquet créé apparaît dans la liste',
    (await page.locator('.flashcards-row-name').allTextContents()).join(',') === 'Vocabulaire espagnol',
  );

  // --- Édition ---------------------------------------------------------------
  await page.getByRole('button', { name: 'Modifier' }).click();
  check(
    "L'éditeur se pré-remplit",
    (await page.locator('#flashcards-deck-name').inputValue()) === 'Vocabulaire espagnol',
  );
  await page.locator('#flashcards-deck-name').fill('Espagnol — verbes');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check(
    'Le renommage est pris en compte',
    (await page.locator('.flashcards-row-name').first().textContent()) === 'Espagnol — verbes',
  );

  // --- Entrer dans le paquet et gérer ses cartes (étape 3) -----------------
  await page.locator('.flashcards-row', { hasText: 'Espagnol — verbes' }).click();
  await page.waitForSelector('.flashcards-deck-detail');
  check(
    'Ouvrir un paquet vide affiche son écran vide',
    await page.locator('.flashcards-deck-detail .empty h3').isVisible(),
  );
  check(
    'Le titre du paquet ouvert est affiché',
    (await page.locator('.flashcards-deck-detail-title').textContent()).includes('Espagnol — verbes'),
  );

  await page.getByRole('button', { name: 'Créer ma première carte' }).click();
  check("L'éditeur de carte s'ouvre", await page.locator('.flashcards-card-editor').isVisible());
  await page.locator('#flashcards-card-front').fill('Hola');
  await page.locator('#flashcards-card-back').fill('Bonjour');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await page.waitForSelector('.flashcards-card-row');
  check(
    'La carte créée affiche son recto et son verso',
    (await page.locator('.flashcards-card-front').first().textContent()) === 'Hola' &&
      (await page.locator('.flashcards-card-back').first().textContent()) === 'Bonjour',
  );

  // --- Réviser une carte due (étape 5) --------------------------------------
  check(
    'Le bouton Réviser affiche le nombre de cartes dues',
    (await page.locator('.flashcards-review-start').textContent()).includes('1'),
  );
  await page.locator('.flashcards-review-start').click();
  await page.waitForSelector('.flashcards-review-card');
  check(
    'La révision montre le recto, pas le verso',
    (await page.locator('.flashcards-review-face').textContent()) === 'Hola',
  );
  check(
    'La progression annonce 1 / 1',
    (await page.locator('.flashcards-review-progress').textContent()) === '1 / 1',
  );

  await page.locator('.flashcards-review-card').click();
  check(
    'Retourner la carte montre le verso',
    (await page.locator('.flashcards-review-face').textContent()) === 'Bonjour',
  );

  await page.getByRole('button', { name: 'Juste' }).click();
  await page.waitForSelector('.flashcards-review .empty h3');
  check(
    'La session terminée annonce le nombre de cartes revues',
    (await page.locator('.flashcards-review .empty p').textContent()).includes('1 carte'),
  );

  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.waitForSelector('.flashcards-deck-detail');
  check(
    'Une carte revue juste quitte la file du jour',
    (await page.locator('.flashcards-review-start').count()) === 0,
  );

  await page.getByRole('button', { name: 'Modifier' }).click();
  check(
    "L'éditeur de carte se pré-remplit",
    (await page.locator('#flashcards-card-front').inputValue()) === 'Hola',
  );
  await page.locator('#flashcards-card-back').fill('Bonjour / Salut');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check(
    'La modification est prise en compte',
    (await page.locator('.flashcards-card-back').first().textContent()) === 'Bonjour / Salut',
  );

  // Un aller-retour, pour vérifier que la carte n'est pas seulement en mémoire.
  await page.getByRole('button', { name: '← Paquets' }).click();
  await page.waitForSelector('.flashcards-decks');
  await page.locator('.flashcards-row', { hasText: 'Espagnol — verbes' }).click();
  await page.waitForSelector('.flashcards-card-row');
  check('La carte survit à un aller-retour', (await page.locator('.flashcards-card-row').count()) === 1);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.flashcards-deck-detail .empty h3');
  check(
    'Supprimer la seule carte ramène à l’écran vide du paquet',
    await page.locator('.flashcards-deck-detail .empty h3').isVisible(),
  );

  await page.getByRole('button', { name: '← Paquets' }).click();
  await page.waitForSelector('.flashcards-decks');

  // --- Un deuxième paquet, pour vérifier que la liste en tient plusieurs ---
  await page.getByRole('button', { name: '+ Nouveau paquet' }).click();
  await page.locator('#flashcards-deck-name').fill('Anatomie');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(200);
  check('Les deux paquets sont listés', (await page.locator('.flashcards-row').count()) === 2);

  // --- Archivage --------------------------------------------------------------
  await page.locator('.flashcards-row', { hasText: 'Anatomie' }).getByRole('button', { name: 'Archiver' }).click();
  await page.waitForTimeout(200);
  check(
    'Un paquet archivé quitte la liste active',
    (await page.locator('.flashcards-row').count()) === 1,
  );
  check('Section Archivés visible', await page.locator('.flashcards-archived').isVisible());

  // --- Persistance -------------------------------------------------------------
  await reloadOrbite(page);
  check(
    'Le paquet actif et le paquet archivé survivent au rechargement',
    (await page.locator('.flashcards-row').count()) === 1 &&
      (await page.locator('.flashcards-archived-row').count()) === 1,
  );

  // --- Restauration ------------------------------------------------------------
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await page.waitForTimeout(200);
  check(
    'Restaurer ramène le paquet dans la liste active',
    (await page.locator('.flashcards-row').count()) === 2 &&
      (await page.locator('.flashcards-archived').count()) === 0,
  );

  // --- Suppression -------------------------------------------------------------
  page.on('dialog', (d) => d.accept());
  await page.locator('.flashcards-row', { hasText: 'Anatomie' }).getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(200);
  await page.locator('.flashcards-row', { hasText: 'Espagnol' }).getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.empty h3');
  check('Supprimer les deux paquets ramène à l’écran vide', await page.locator('.empty h3').isVisible());

  await page.getByRole('button', { name: '← Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Le retour ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

  await context.close();

  // --- Le bandeau « Aujourd'hui » : savoir tout de suite ce qui est dû ------
  // Demande de Jules après la V1. Deux paquets, chacun une carte due, pour
  // vérifier à la fois la pastille par paquet et la session tous paquets.
  {
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const tp = await fresh.newPage();
    tp.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(tp, BASE);
    await tp.waitForSelector('.empty h3');
    await tp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1') || '{}');
      const today = new Date().toISOString().slice(0, 10);
      snap.flashcardsDecks = [
        { id: 'td1', name: 'Espagnol', emoji: '🇪🇸', position: 0, archived: false, createdAt: today },
        { id: 'td2', name: 'Anatomie', emoji: '🩺', position: 1, archived: false, createdAt: today },
      ];
      snap.flashcardsCards = [
        { id: 'tc1', deckId: 'td1', front: 'Hola', back: 'Bonjour', box: 1, dueDay: today, createdAt: today },
        { id: 'tc2', deckId: 'td2', front: 'Fémur', back: 'Os de la cuisse', box: 1, dueDay: today, createdAt: today },
      ];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadOrbite(tp);
    await tp.waitForSelector('.flashcards-today');

    check(
      'Le bandeau du jour annonce le total, tous paquets confondus',
      (await tp.locator('.flashcards-today-text').textContent()).includes('2'),
    );
    check(
      'Chaque paquet porte sa propre pastille',
      (await tp.locator('.flashcards-row-due').allTextContents()).sort().join(',') === '1,1',
    );

    await tp.getByRole('button', { name: 'Réviser' }).click();
    await tp.waitForSelector('.flashcards-review-card');
    check(
      "La session s'ouvre sur « Aujourd'hui », pas le nom d'un paquet",
      (await tp.locator('.flashcards-review-head').textContent()).includes("Aujourd'hui"),
    );
    check(
      'La carte annonce de quel paquet elle vient',
      await tp.locator('.flashcards-review-deck').isVisible(),
    );

    // Deux cartes, deux paquets différents : on retourne et note chacune.
    await tp.locator('.flashcards-review-card').click();
    await tp.getByRole('button', { name: 'Juste' }).click();
    await tp.waitForSelector('.flashcards-review-card');
    await tp.locator('.flashcards-review-card').click();
    await tp.getByRole('button', { name: 'Juste' }).click();
    await tp.waitForSelector('.flashcards-review .empty h3');
    check(
      'Les deux cartes de la session sont comptées',
      (await tp.locator('.flashcards-review .empty p').textContent()).includes('2 cartes'),
    );

    await tp.getByRole('button', { name: 'Terminer' }).click();
    await tp.waitForSelector('.flashcards-decks');
    check(
      'Le bandeau annonce qu’il n’y a plus rien à réviser',
      (await tp.locator('.flashcards-today-empty').count()) === 1,
    );
    check(
      'Les pastilles par paquet disparaissent avec elles',
      (await tp.locator('.flashcards-row-due').count()) === 0,
    );

    check('Aucune erreur JavaScript (bandeau du jour)', errors.length === 0, errors.join(' | '));
    await fresh.close();
  }
}
