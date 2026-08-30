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

  await page.getByRole('button', { name: 'Modules' }).click();
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

  // --- Voir ce qu'il y a dans chaque boîte -----------------------------------
  // Demande de Jules : « on ne sait pas quelle carte est bientôt finie, qu'est-ce
  // qu'il y a dans la boîte 1, la boîte 2 etc. ». Trois cartes, trois boîtes
  // différentes, dont deux pas dues aujourd'hui (pour ne pas dépendre de
  // l'écran de révision ici).
  {
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const bp = await fresh.newPage();
    bp.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(bp, BASE);
    await bp.waitForSelector('.empty h3');
    await bp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1') || '{}');
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      snap.flashcardsDecks = [
        { id: 'bd1', name: 'Espagnol', emoji: '🇪🇸', position: 0, archived: false, createdAt: today },
      ];
      snap.flashcardsCards = [
        { id: 'bc1', deckId: 'bd1', front: 'Hola', back: 'Bonjour', box: 1, dueDay: today, createdAt: today },
        { id: 'bc2', deckId: 'bd1', front: 'Adios', back: 'Au revoir', box: 3, dueDay: future, createdAt: today },
        { id: 'bc3', deckId: 'bd1', front: 'Gracias', back: 'Merci', box: 5, dueDay: future, createdAt: today },
      ];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadOrbite(bp);
    await bp.locator('.flashcards-row', { hasText: 'Espagnol' }).click();
    await bp.waitForSelector('.flashcards-box-filter');

    check(
      'Le filtre annonce la répartition par boîte',
      (await bp.locator('.flashcards-box-chip').allTextContents()).join(' ') ===
        'Toutes (3) Boîte 1 (1) Boîte 2 (0) Boîte 3 (1) Boîte 4 (0) Boîte 5 (1)',
    );
    check(
      'Chaque carte affiche sa boîte en points',
      (await bp.locator('.flashcards-card-row').nth(1).locator('.flashcards-box-dot.filled').count()) === 3,
    );

    await bp.getByRole('button', { name: 'Boîte 3' }).click();
    await bp.waitForTimeout(200);
    check(
      'Filtrer sur une boîte réduit la liste à son contenu',
      (await bp.locator('.flashcards-card-row').count()) === 1 &&
        (await bp.locator('.flashcards-card-front').first().textContent()) === 'Adios',
    );

    await bp.getByRole('button', { name: 'Boîte 2' }).click();
    check(
      'Une boîte vide le dit, plutôt que de ne rien montrer',
      await bp.locator('.flashcards-box-empty').isVisible(),
    );

    await bp.getByRole('button', { name: 'Toutes' }).click();
    await bp.waitForTimeout(200);
    check('Revenir à « Toutes » restaure les trois cartes', (await bp.locator('.flashcards-card-row').count()) === 3);

    check('Aucune erreur JavaScript (boîtes)', errors.length === 0, errors.join(' | '));
    await fresh.close();
  }

  // --- La répartition par boîte, tous paquets confondus, sur l'écran principal ---
  // Demande de Jules : « voir combien de cartes il y a dans chaque boîte » sur
  // l'écran principal, comme dans un paquet particulier. Deux paquets, une
  // boîte partagée par une carte de chacun, pour vérifier l'agrégation et
  // l'étiquette de provenance.
  {
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const gp = await fresh.newPage();
    gp.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(gp, BASE);
    await gp.waitForSelector('.empty h3');
    await gp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1') || '{}');
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      snap.flashcardsDecks = [
        { id: 'gd1', name: 'Espagnol', emoji: '🇪🇸', position: 0, archived: false, createdAt: today },
        { id: 'gd2', name: 'Anatomie', emoji: '🩺', position: 1, archived: false, createdAt: today },
      ];
      snap.flashcardsCards = [
        { id: 'gc1', deckId: 'gd1', front: 'Hola', back: 'Bonjour', box: 1, dueDay: today, createdAt: today },
        { id: 'gc2', deckId: 'gd1', front: 'Adios', back: 'Au revoir', box: 3, dueDay: future, createdAt: today },
        { id: 'gc3', deckId: 'gd2', front: 'Fémur', back: 'Os de la cuisse', box: 3, dueDay: future, createdAt: today },
        { id: 'gc4', deckId: 'gd2', front: 'Tibia', back: 'Os de la jambe', box: 5, dueDay: future, createdAt: today },
      ];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadOrbite(gp);
    await gp.waitForSelector('.flashcards-box-filter');

    check(
      'La répartition agrège les deux paquets',
      (await gp.locator('.flashcards-box-chip').allTextContents()).join(' ') ===
        'Toutes (4) Boîte 1 (1) Boîte 2 (0) Boîte 3 (2) Boîte 4 (0) Boîte 5 (1)',
    );
    check('Repliée par défaut : pas de liste avant de choisir une boîte', (await gp.locator('.flashcards-row-deck').count()) === 0);

    await gp.getByRole('button', { name: 'Boîte 3' }).click();
    await gp.waitForTimeout(200);
    const fronts = (await gp.locator('.flashcards-row-name').allTextContents()).filter(
      (t) => t === 'Adios' || t === 'Fémur',
    );
    check('La boîte 3 montre une carte de chaque paquet', fronts.sort().join(',') === 'Adios,Fémur');
    check(
      'Chaque carte annonce son paquet',
      (await gp.locator('.flashcards-row-deck').allTextContents()).sort().join(',') ===
        ['🇪🇸 Espagnol', '🩺 Anatomie'].sort().join(','),
    );

    await gp.locator('.flashcards-row', { hasText: 'Adios' }).click();
    await gp.waitForSelector('.flashcards-deck-detail');
    check(
      'Cliquer une carte de la liste globale ouvre son paquet',
      (await gp.locator('.flashcards-deck-detail-title').textContent()).includes('Espagnol'),
    );

    check('Aucune erreur JavaScript (répartition globale)', errors.length === 0, errors.join(' | '));
    await fresh.close();
  }

  // --- Statistiques, sans streak (étape 6) -----------------------------------
  // Décision de Jules : pas de streak, juste le volume et le taux de réussite —
  // une vraie révision (via l'écran de révision) doit se refléter dans le
  // panneau, pour vérifier que le journal est bien écrit et relu.
  {
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const sp = await fresh.newPage();
    sp.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(sp, BASE);
    await sp.waitForSelector('.empty h3');

    await sp.getByRole('button', { name: 'Statistiques' }).click();
    await sp.waitForSelector('.flashcards-stats');
    check(
      'Aucune révision : le panneau le dit plutôt que d’afficher des zéros',
      await sp.locator('.flashcards-stats-empty').isVisible(),
    );
    await sp.getByRole('button', { name: 'Fermer' }).click();

    await sp.getByRole('button', { name: 'Créer mon premier paquet' }).click();
    await sp.locator('#flashcards-deck-name').fill('Espagnol');
    await sp.getByRole('button', { name: 'Enregistrer' }).click();
    await sp.waitForSelector('.flashcards-row');
    await sp.locator('.flashcards-row', { hasText: 'Espagnol' }).click();
    await sp.getByRole('button', { name: 'Créer ma première carte' }).click();
    await sp.locator('#flashcards-card-front').fill('Hola');
    await sp.locator('#flashcards-card-back').fill('Bonjour');
    await sp.getByRole('button', { name: 'Enregistrer' }).click();

    await sp.locator('.flashcards-review-start').click();
    await sp.waitForSelector('.flashcards-review-card');
    await sp.locator('.flashcards-review-card').click();
    await sp.getByRole('button', { name: 'Juste' }).click();
    await sp.waitForSelector('.flashcards-review .empty h3');
    await sp.getByRole('button', { name: 'Terminer' }).click();
    await sp.waitForSelector('.flashcards-deck-detail');

    await sp.getByRole('button', { name: '← Paquets' }).click();
    await sp.getByRole('button', { name: 'Statistiques' }).click();
    await sp.waitForSelector('.flashcards-stats');
    check(
      'La révision faite à l’instant apparaît dans les statistiques',
      (await sp.locator('.flashcards-stat-value').allTextContents()).join(',') === '1,1,100 %',
    );

    check('Aucune erreur JavaScript (statistiques)', errors.length === 0, errors.join(' | '));
    await fresh.close();
  }

  // --- Import en masse (étape 7) ---------------------------------------------
  // « L'usage devient tenable dans la durée » sans ouvrir l'éditeur une carte
  // à la fois. Un mélange volontaire : deux lignes valides, une incomprise.
  {
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const ip = await fresh.newPage();
    ip.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(ip, BASE);
    await ip.waitForSelector('.empty h3');
    await ip.getByRole('button', { name: 'Créer mon premier paquet' }).click();
    await ip.locator('#flashcards-deck-name').fill('Espagnol');
    await ip.getByRole('button', { name: 'Enregistrer' }).click();
    await ip.waitForSelector('.flashcards-row');
    await ip.locator('.flashcards-row', { hasText: 'Espagnol' }).click();
    await ip.waitForSelector('.flashcards-deck-detail .empty h3');

    await ip.getByRole('button', { name: 'Importer une liste' }).click();
    check("L'éditeur d'import s'ouvre", await ip.locator('.flashcards-bulk-import').isVisible());

    await ip
      .locator('#flashcards-bulk-text')
      .fill('Hola ; Bonjour\nAdios ; Au revoir\nligne sans séparateur');
    check(
      "L'aperçu distingue nouvelles cartes et lignes incomprises",
      (await ip.locator('.flashcards-bulk-summary').textContent()).includes('2') &&
        (await ip.locator('.flashcards-bulk-invalid li').count()) === 1,
    );

    await ip.getByRole('button', { name: /Importer \(2\)/ }).click();
    await ip.waitForSelector('.flashcards-card-row');
    check('Les deux lignes valides deviennent des cartes', (await ip.locator('.flashcards-card-row').count()) === 2);

    // Recoller la même liste : Hola et Adios doivent être écartés, pas dupliqués.
    await ip.getByRole('button', { name: 'Importer une liste' }).click();
    await ip.locator('#flashcards-bulk-text').fill('Hola ; Bonjour\nGracias ; Merci');
    check(
      'Une carte déjà présente est écartée plutôt que dupliquée',
      (await ip.locator('.flashcards-bulk-summary').textContent()).includes('1 nouvelle') &&
        (await ip.locator('.flashcards-bulk-summary').textContent()).includes('1 déjà connue'),
    );
    await ip.getByRole('button', { name: /Importer \(1\)/ }).click();
    await ip.waitForTimeout(200);
    check(
      'Seule la carte neuve a été ajoutée',
      (await ip.locator('.flashcards-card-row').count()) === 3,
    );

    check('Aucune erreur JavaScript (import en masse)', errors.length === 0, errors.join(' | '));
    await fresh.close();
  }

  // --- Rendu mobile --------------------------------------------------------
  // Jamais vérifié jusqu'ici, contrairement à Zénith et Astra : le bandeau,
  // les pastilles, les paquets et l'écran de révision doivent tenir sur un
  // téléphone, sans défilement horizontal.
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await phone.newPage();
    mp.on('pageerror', (e) => errors.push(e.message));
    await enterOrbite(mp, BASE);
    await mp.waitForSelector('.empty h3');
    check(
      'Écran vide sans débordement horizontal sur téléphone',
      await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );

    check(
      'La barre du haut passe en icônes seules sur téléphone',
      !(await mp.locator('.flashcards-topbar-label').first().isVisible()),
    );
    check(
      'Mais chaque bouton garde un nom accessible malgré son texte caché',
      await mp.getByRole('button', { name: 'Statistiques' }).isVisible(),
    );

    await mp.getByRole('button', { name: 'Créer mon premier paquet' }).click();
    await mp.locator('#flashcards-deck-name').fill('Vocabulaire espagnol');
    await mp.getByRole('button', { name: 'Enregistrer' }).click();
    await mp.waitForSelector('.flashcards-row');
    check(
      'Écran des paquets sans débordement horizontal sur téléphone',
      await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );

    await mp.getByRole('button', { name: 'Statistiques' }).click();
    await mp.waitForSelector('.flashcards-stats');
    check(
      'Le panneau de statistiques reste utilisable en icône seule',
      await mp.locator('.flashcards-stats').isVisible(),
    );
    await mp.getByRole('button', { name: 'Fermer' }).click();

    await mp.locator('.flashcards-row', { hasText: 'Vocabulaire espagnol' }).click();
    await mp.waitForSelector('.flashcards-deck-detail');
    await mp.getByRole('button', { name: 'Créer ma première carte' }).click();
    await mp.locator('#flashcards-card-front').fill('Hola, ¿cómo estás?');
    await mp.locator('#flashcards-card-back').fill('Bonjour, comment ça va ?');
    await mp.getByRole('button', { name: 'Enregistrer' }).click();
    await mp.waitForSelector('.flashcards-card-row');
    check(
      'Détail du paquet (recto/verso empilés) sans débordement sur téléphone',
      await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );

    await mp.locator('.flashcards-review-start').click();
    await mp.waitForSelector('.flashcards-review-card');
    check(
      'Écran de révision sans débordement horizontal sur téléphone',
      await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );

    check('Aucune erreur JavaScript (mobile)', errors.length === 0, errors.join(' | '));
    await phone.close();
  }
}
