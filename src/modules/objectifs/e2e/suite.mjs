/**
 * Suite e2e du module Objectifs (Zénith) : onboarding, grille des paliers,
 * échelle, cérémonies, comptage, quotidien, historique, rendu mobile.
 *
 * Tout ce qui ne dépend d'aucun module vit dans e2e/core.mjs ; ici, tout part
 * d'un contexte fraîchement créé qui joue le scénario Zénith de bout en bout.
 */

async function dismissCeremonies(p) {
  for (let i = 0; i < 5; i++) {
    const visible = await p
      .locator('.ceremony')
      .isVisible()
      .catch(() => false);
    if (!visible) return;
    await p.getByRole('button', { name: 'Continuer' }).click();
    await p.waitForTimeout(200);
  }
}

/**
 * Depuis l'arrivée d'Astra, le hub compte deux modules : l'écran de choix
 * (`ModulePicker`) s'affiche donc avant l'écran de Zénith, sur toute page
 * fraîchement chargée. Cette suite ne teste que Zénith — elle entre donc
 * systématiquement dans sa carte avant de continuer, comme le ferait
 * quiconque n'a qu'un module qui l'intéresse.
 */
async function enterZenith(p) {
  const card = p.locator('.hub-picker-card', { hasText: 'Zénith' });
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
    await card.click();
  }
}

async function gotoZenith(p, base) {
  await p.goto(base);
  await enterZenith(p);
}

async function reloadZenith(p) {
  await p.reload();
  await enterZenith(p);
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await gotoZenith(page, BASE);

  // 0. Onboarding de première connexion
  await page.waitForSelector('.onboarding-card');
  check('Onboarding affiché à la première visite', await page.locator('.onboarding-card').isVisible());
  check(
    'Premier écran : le principe des paliers',
    (await page.locator('.onboarding-title').textContent()) === 'Un objectif, des paliers',
    await page.locator('.onboarding-title').textContent(),
  );
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  check(
    'Dernier écran : objectif de départ pré-rempli',
    (await page.locator('#starter-title').inputValue()) === 'Courir un semi-marathon',
    await page.locator('#starter-title').inputValue(),
  );
  check(
    'Paliers du modèle affichés avec leur rang',
    (await page.locator('.starter-preview li').count()) === 4,
    String(await page.locator('.starter-preview li').count()),
  );
  await page.getByRole('button', { name: 'Lecture' }).click();
  check(
    'Changer de modèle met à jour l’intitulé',
    (await page.locator('#starter-title').inputValue()) === 'Me remettre à lire',
    await page.locator('#starter-title').inputValue(),
  );
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.waitForSelector('.brand');

  // 1. Écran vide (sur le hub) puis chargement des exemples
  check('Écran vide affiché après avoir passé l’onboarding', await page.locator('.empty h3').isVisible());
  await page.getByRole('button', { name: 'Charger des exemples' }).click();
  await page.waitForSelector('.hub');
  check('Hub affiché après chargement', await page.locator('.hub').isVisible());
  check(
    'Prochains paliers listés sur le hub (un par objectif)',
    (await page.locator('.next-tier').count()) === 3,
    String(await page.locator('.next-tier').count()),
  );
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.goal');
  check('3 objectifs créés', (await page.locator('.goal').count()) === 3);
  check(
    'Nombre de paliers variable selon les objectifs',
    (await page.locator('.goal-count').nth(0).textContent())?.includes('0/5') &&
      (await page.locator('.goal-count').nth(1).textContent())?.includes('0/3'),
    await page.locator('.goal-count').nth(1).textContent(),
  );

  // 2. Validation de paliers -> rang de l'objectif et rang global
  await page.locator('.goal').first().locator('.goal-head').click();
  await page.waitForSelector('.ladder');
  await page.locator('.tier-check').nth(0).click();
  await page.waitForSelector('.ceremony');
  check('Cérémonie affichée à la validation', await page.locator('.ceremony-rank').isVisible());
  check(
    'PP annoncés dans la cérémonie (Bronze = +50 PP)',
    (await page.locator('.ceremony-pp').textContent()) === '+50 PP',
    await page.locator('.ceremony-pp').textContent(),
  );
  await dismissCeremonies(page);
  await page.locator('.tier-check').nth(1).click();
  await page.waitForSelector('.ceremony');
  await dismissCeremonies(page);
  check(
    'Cérémonie de montée de rang enchaînée puis refermée',
    !(await page.locator('.ceremony').isVisible().catch(() => false)),
  );
  await page.waitForTimeout(300);
  check(
    "Rang de l'objectif = palier validé le plus haut (Argent)",
    (await page.locator('.goal').first().locator('.goal-title-row .rank-badge').textContent()) ===
      'Argent',
    await page.locator('.goal').first().locator('.goal-title-row .rank-badge').textContent(),
  );
  check(
    'Date de validation enregistrée',
    (await page.locator('.tier-date').first().textContent())?.startsWith('Validé le'),
    await page.locator('.tier-date').first().textContent(),
  );
  check('Barre de progression à 40 %', (await page.locator('.goal-count').first().textContent())?.includes('2/5'));
  // Le rang de profil et les PP s'affichent sur le hub
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.waitForSelector('.profile-rank');
  check(
    'Rang global calculé (moyenne 3/3 objectifs = Fer)',
    (await page.locator('.profile-rank').textContent()) === 'Fer',
    await page.locator('.profile-rank').textContent(),
  );
  await page.waitForTimeout(1100); // laisse le compteur de PP finir son animation
  check(
    // Les PP ont quitté le bandeau de profil — qui dit l'identité — pour la
    // carte « Cette semaine », qui dit le rythme et porte le comparatif.
    'PP de la semaine (Bronze 50 + Argent 75 = 125)',
    (await page.locator('.week-pp').textContent())?.replace(/[^0-9]/g, '') === '125',
    await page.locator('.week-pp').textContent(),
  );
  check(
    'Le bandeau de profil ne répète pas les PP',
    (await page.locator('.stat-pp').count()) === 0,
    (await page.locator('.stat-label').allTextContents()).join(' | '),
  );
  check(
    "Activité récente alimentée sur le hub",
    (await page.locator('.activity-item').count()) === 2,
    String(await page.locator('.activity-item').count()),
  );
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.ladder');

  // 3. Ajout d'un palier à un objectif existant
  await page.locator('.ladder-add input').fill('Courir 42 km sous les 4 h');
  // Plus de liste de rangs à l'ajout : depuis que les rangs appartiennent aux
  // barreaux, c'est la place qui décide. Le formulaire annonce le rang à venir
  // au lieu de faire choisir un rang qu'il n'honorait plus.
  check(
    'Aucune liste de rangs à l’ajout d’un palier',
    (await page.locator('.ladder-add select').count()) === 0,
    String(await page.locator('.ladder-add select').count()),
  );
  check(
    'Mais le rang à venir est annoncé',
    (await page.locator('.ladder-add .rank-badge').count()) === 1,
    (await page.locator('.ladder-add .rank-badge').textContent()) ?? 'aucun',
  );
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(300);
  check('Palier ajouté', (await page.locator('.goal-count').first().textContent())?.includes('2/6'));

  // 4. Persistance après rechargement (retour sur le hub par défaut)
  await reloadZenith(page);
  await page.waitForSelector('.brand');
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.goal');
  check('Données persistées après rechargement', (await page.locator('.goal').count()) === 3);
  check(
    'Rang objectif conservé',
    (await page.locator('.goal').first().locator('.goal-title-row .rank-badge').textContent()) ===
      'Argent',
  );

  // 5. Historique + graphique de progression
  await page.getByRole('button', { name: 'Historique' }).click();
  await page.waitForSelector('.entry');
  check('Historique daté alimenté', (await page.locator('.entry').count()) === 2);
  check(
    'Le graphe compte les PP par semaine, plus un cumul à vie',
    (await page.locator('.chart-title').textContent()) === 'PP par semaine',
    await page.locator('.chart-title').textContent(),
  );
  check(
    'Une barre par semaine',
    (await page.locator('.chart-wrap svg path').count()) >= 1,
    String(await page.locator('.chart-wrap svg path').count()),
  );
  // Régression : si la graduation haute est sous le maximum, la barre la plus
  // haute sort du cadre par le haut.
  {
    const barre = await page.locator('.chart-wrap svg path').first().boundingBox();
    const svg = await page.locator('.chart-wrap svg').boundingBox();
    check(
      'La barre la plus haute tient dans le cadre',
      barre.y >= svg.y && barre.y + barre.height <= svg.y + svg.height + 1,
      `barre ${Math.round(barre.y)}–${Math.round(barre.y + barre.height)} / svg ${Math.round(svg.y)}–${Math.round(svg.y + svg.height)}`,
    );
    // Une barre est ancrée à sa ligne de base : arrondir les quatre coins la
    // ferait flotter au-dessus de l'axe.
    const d = await page.locator('.chart-wrap svg path').first().getAttribute('d');
    check('Les barres sont ancrées à la ligne de base', /Z$/.test(d ?? '') && /V/.test(d ?? ''), d ?? '');
  }
  await page.locator('.chart-wrap svg').hover();
  await page.waitForTimeout(200);
  check('Infobulle au survol du graphe', await page.locator('.chart-tooltip').isVisible());
  await page.getByRole('button', { name: 'Voir le tableau' }).click();
  await page.waitForSelector('.chart-table');
  check(
    'Vue tableau : les valeurs sont lisibles sans survol',
    (await page.locator('.chart-table tbody tr').count()) >= 1,
    String(await page.locator('.chart-table tbody tr').count()),
  );
  await page.getByRole('button', { name: 'Voir le graphe' }).click();
  await page.screenshot({ path: 'screens/historique.png', fullPage: true });

  // 6. Création : bibliothèque de modèles puis éditeur
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.getByRole('button', { name: 'Nouvel objectif' }).click();
  await page.waitForSelector('.picker-grid');
  check(
    'Bibliothèque de modèles ouverte',
    (await page.locator('.picker-card').count()) >= 2,
    String(await page.locator('.picker-card').count()),
  );
  check(
    // Huit domaines de vie, plus « Habitudes » — qui n'est pas un domaine mais
    // une forme, et traverse donc les huit autres.
    'Huit domaines, plus l’onglet transversal des habitudes',
    (await page.locator('.picker-tab').count()) === 9,
    String(await page.locator('.picker-tab').count()),
  );
  await page.getByRole('button', { name: 'Apprendre' }).click();
  await page.waitForTimeout(200);
  await page.locator('.picker-card', { hasText: 'Apprendre un instrument' }).click();
  await page.waitForSelector('.preview-tiers');
  check(
    'Aperçu du modèle : étapes et rangs automatiques',
    (await page.locator('.preview-tiers li').count()) === 4,
    String(await page.locator('.preview-tiers li').count()),
  );
  check(
    'Échelle cohérente à 4 étapes : Bronze / Argent / Or / Challenger',
    (await page.locator('.preview-tiers .rank-badge').allTextContents()).join(' · ') ===
      'Bronze · Argent · Or · Challenger',
    (await page.locator('.preview-tiers .rank-badge').allTextContents()).join(' · '),
  );
  check(
    'Toutes les étapes du modèle sont mesurables (un chiffre ou un fait vérifiable)',
    (await page.locator('.preview-tiers .preview-title').allTextContents()).every((t) =>
      /\d|terminé|publié|devant du public|acceptée|signée/i.test(t),
    ),
    (await page.locator('.preview-tiers .preview-title').allTextContents()).join(' | '),
  );
  check(
    'Aperçu du modèle : actions incluses',
    (await page.locator('.preview-action').count()) === 2,
    String(await page.locator('.preview-action').count()),
  );
  // Contrôle de l'échelle à 3 étapes sur un autre modèle
  await page.locator('.modal-foot .btn', { hasText: 'Retour' }).click();
  await page.waitForSelector('.picker-grid');
  await page.getByRole('button', { name: 'Esprit' }).click();
  await page.waitForTimeout(200);
  await page.locator('.picker-card', { hasText: 'Noter 3 gratitudes' }).click();
  await page.waitForSelector('.preview-tiers');
  check(
    'Échelle cohérente à 3 étapes : Bronze / Argent / Or',
    (await page.locator('.preview-tiers .rank-badge').allTextContents()).join(' · ') ===
      'Bronze · Argent · Or',
    (await page.locator('.preview-tiers .rank-badge').allTextContents()).join(' · '),
  );
  await page.locator('.modal-foot .btn', { hasText: 'Retour' }).click();
  await page.waitForSelector('.picker-grid');
  await page.getByRole('button', { name: 'Apprendre' }).click();
  await page.waitForTimeout(200);
  await page.locator('.picker-card', { hasText: 'Apprendre un instrument' }).click();
  await page.waitForSelector('.preview-tiers');
  await page.getByRole('button', { name: 'Choisir cet objectif' }).click();
  await page.waitForSelector('.modal #goal-title');
  check(
    'Éditeur pré-rempli par le modèle',
    (await page.locator('#goal-title').inputValue()) === 'Apprendre un instrument',
    await page.locator('#goal-title').inputValue(),
  );
  check(
    'Aucune liste de rangs à la création',
    (await page.locator('.draft-tier select').count()) === 0,
    String(await page.locator('.draft-tier select').count()),
  );
  check(
    'Les rangs sont affichés en badges informatifs',
    (await page.locator('.draft-tier .rank-badge').count()) === 4,
    String(await page.locator('.draft-tier .rank-badge').count()),
  );
  await page.screenshot({ path: 'screens/creation.png' });
  await page.getByRole('button', { name: "Créer l'objectif" }).click();

  // La planification est elle-même célébrée
  await page.waitForSelector('.ceremony');
  check(
    'Cérémonie « ascension tracée » à la création',
    (await page.locator('.ceremony-eyebrow').textContent()) === 'Ascension tracée',
    await page.locator('.ceremony-eyebrow').textContent(),
  );
  check(
    'L’échelle des étapes se dessine dans la cérémonie',
    (await page.locator('.ceremony-step-row').count()) === 4,
    String(await page.locator('.ceremony-step-row').count()),
  );
  await dismissCeremonies(page);
  await page.waitForTimeout(400);
  check('4e objectif créé', (await page.locator('.goal').count()) === 4);
  check(
    'Le modèle apporte ses propres actions',
    (await page.locator('.goal').nth(3).locator('.goal-count').textContent())?.includes('0/4'),
    await page.locator('.goal').nth(3).locator('.goal-count').textContent(),
  );

  // 7. Modification d'un objectif
  await page.locator('.goal').nth(3).locator('.goal-actions button').first().click();
  await page.waitForSelector('.modal');
  await page.locator('#goal-title').fill('Apprendre le piano');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(300);
  check(
    'Objectif renommé',
    (await page.locator('.goal').nth(3).locator('.goal-title').textContent()) ===
      'Apprendre le piano',
  );

  // 8. Suppression (les actions sont désormais ✎ / 📦 / 🗑)
  page.once('dialog', (d) => d.accept());
  await page.locator('.goal').nth(3).locator('.goal-actions button').nth(2).click();
  await page.waitForTimeout(400);
  check('Objectif supprimé', (await page.locator('.goal').count()) === 3);

  // 8 bis. Archivage réversible
  await page.locator('.goal').nth(1).locator('.goal-actions button').nth(1).click();
  await page.waitForTimeout(400);
  check(
    'Objectif archivé : retiré de la grille',
    (await page.locator('.goal').count()) === 2,
    String(await page.locator('.goal').count()),
  );
  check('Section Archivés visible', (await page.locator('.archived-row').count()) === 1);
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await page.waitForTimeout(400);
  check(
    'Objectif restauré depuis les archives',
    (await page.locator('.goal').count()) === 3 && (await page.locator('.archived-row').count()) === 0,
  );

  // 9. Actions du quotidien, anneau, streak et trophées
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.waitForSelector('.checkin-chips');
  check(
    'Deux actions génériques créées par objectif',
    (await page.locator('.checkin-chip:not(.add-oneoff)').count()) === 6,
    String(await page.locator('.checkin-chip:not(.add-oneoff)').count()),
  );
  check(
    'Une porte « Autre chose » par objectif, et une seule',
    (await page.locator('.checkin-chip.add-oneoff').count()) === 3,
    String(await page.locator('.checkin-chip.add-oneoff').count()),
  );
  check(
    'Anneau du jour affiché',
    (await page.locator('.ring-goal').textContent()) === '/ 40 PP',
    await page.locator('.ring-goal').textContent(),
  );
  check(
    'Streak à 1 (les validations du jour comptent)',
    ((await page.locator('.flame-count').textContent()) ?? '') === '1',
    await page.locator('.flame-count').textContent(),
  );

  // « Un vrai effort » vaut 15 PP
  check(
    'Première action : Un vrai effort · +15',
    (await page.locator('.checkin-chip').first().textContent())?.includes('Un vrai effort'),
    await page.locator('.checkin-chip').first().textContent(),
  );
  await page.locator('.checkin-chip').first().click();
  await page.waitForSelector('.ceremony');
  check(
    'Trophée « Premier pas » célébré à la première action',
    (await page.locator('.ceremony-rank').textContent()) === 'Premier pas',
    await page.locator('.ceremony-rank').textContent(),
  );
  await dismissCeremonies(page);
  await page.waitForTimeout(1000);
  check('Action marquée comme faite', await page.locator('.checkin-chip.done').isVisible());
  check(
    'Anneau du jour à 140 PP (125 des paliers + 15 de l’action)',
    (await page.locator('.ring-value').textContent()) === '140',
    await page.locator('.ring-value').textContent(),
  );

  // Note libre optionnelle
  await page.locator('.checkin-chip.done .checkin-note-btn').click();
  await page.waitForSelector('.checkin-note input');
  await page.locator('.checkin-note input').fill('8 km ce matin, dur mais fait');
  await page.locator('.checkin-note input').press('Enter');
  await page.waitForTimeout(500);
  check(
    'Note enregistrée (indicateur 📝 sur le chip)',
    (await page.locator('.checkin-chip.done .checkin-note-btn').textContent()) === '📝',
    await page.locator('.checkin-chip.done .checkin-note-btn').textContent(),
  );
  await page.getByRole('button', { name: 'Historique' }).click();
  await page.waitForSelector('.entry');
  check(
    'La note apparaît dans le journal',
    (await page.locator('.entry-checkin .entry-title').first().textContent()) ===
      '8 km ce matin, dur mais fait',
    await page.locator('.entry-checkin .entry-title').first().textContent(),
  );
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.waitForSelector('.checkin-chips');
  check(
    'Récap « Cette semaine » : 1 action',
    (await page.locator('.week-stats > div').nth(1).locator('.week-value').textContent()) === '1',
    await page.locator('.week-stats > div').nth(1).locator('.week-value').textContent(),
  );

  // Persistance après rechargement
  await reloadZenith(page);
  await page.waitForSelector('.checkin-chips');
  check(
    'Action persistante après rechargement',
    (await page.locator('.checkin-chip.done').count()) === 1,
  );

  // Annulation : re-cliquer rend les PP
  await page.locator('.checkin-chip.done').click();
  await page.waitForTimeout(1000);
  check(
    'Annulation : les PP du jour retombent à 125',
    (await page.locator('.ring-value').textContent()) === '125',
    await page.locator('.ring-value').textContent(),
  );

  // Édition d'une action : renommer + changer les PP
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.goal');
  await page.locator('.goal').first().locator('.goal-head').click();
  await page.waitForSelector('.action-editor');
  check(
    'Éditeur d’actions présent dans la carte dépliée',
    (await page.locator('.action-row').count()) === 2,
    String(await page.locator('.action-row').count()),
  );
  await page.getByRole('button', { name: 'Renommer Un vrai effort' }).click();
  await page.locator('.action-row-body input').fill('Sortie course');
  await page.locator('.action-row-body input').press('Enter');
  await page.waitForTimeout(500);
  check(
    'Action renommée',
    (await page.locator('.action-row-title').first().textContent()) === 'Sortie course',
    await page.locator('.action-row-title').first().textContent(),
  );
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.waitForSelector('.checkin-chips');
  check(
    'Le renommage se voit sur le hub',
    (await page.locator('.checkin-chip').first().textContent())?.includes('Sortie course'),
    await page.locator('.checkin-chip').first().textContent(),
  );

  // Réaction instantanée au clic : l'état bascule sans attendre le serveur,
  // et l'action faite le dit explicitement.
  await page.locator('.checkin-chip').first().click();
  await page.waitForTimeout(120);
  check(
    'Le chip bascule immédiatement en « fait » (optimisme)',
    await page.locator('.checkin-chip.done').first().isVisible(),
  );
  check(
    'Le +PP s’envole au clic',
    (await page.locator('.pp-fly').count()) === 1,
    String(await page.locator('.pp-fly').count()),
  );
  check(
    'L’action faite affiche « fait » et non ses PP',
    ((await page.locator('.checkin-chip.done .checkin-mark').first().textContent()) ?? '').includes(
      'fait',
    ),
    await page.locator('.checkin-chip.done .checkin-mark').first().textContent(),
  );
  await dismissCeremonies(page);
  await page.waitForTimeout(900);
  await page.locator('.checkin-chip.done').first().click();
  await page.waitForTimeout(150);
  check(
    'L’annulation bascule aussi immédiatement',
    (await page.locator('.checkin-chip.done').count()) === 0,
    String(await page.locator('.checkin-chip.done').count()),
  );
  await page.waitForTimeout(600);

  // 9 bis. Gestes ponctuels — un pas vers l'objectif qui ne se refera pas
  // « J'ai regardé un tuto sur la gestion de budget » : ça compte pour la
  // journée, ça n'a rien à faire dans la liste des cases à cocher de demain.
  const ppAvant = Number(await page.locator('.ring-value').textContent());
  await page.locator('.checkin-chip.add-oneoff').first().click();
  await page.waitForSelector('.oneoff-bar input');
  check(
    'La barre de saisie ponctuelle s’ouvre sans quitter le hub',
    await page.locator('.oneoff-bar input').isVisible(),
  );
  check(
    'Le bouton annonce ce que ça rapporte',
    ((await page.locator('.oneoff-bar .btn-primary').textContent()) ?? '').includes('+10 PP'),
    await page.locator('.oneoff-bar .btn-primary').textContent(),
  );
  // Échap referme sans rien enregistrer : une porte ouverte par erreur ne
  // doit pas coûter une ligne d'historique.
  await page.locator('.oneoff-bar input').press('Escape');
  await page.waitForTimeout(200);
  check(
    'Échap referme la barre sans rien noter',
    (await page.locator('.oneoff-bar').count()) === 0 &&
      (await page.locator('.checkin-chip.oneoff').count()) === 0,
  );

  await page.locator('.checkin-chip.add-oneoff').first().click();
  await page.waitForSelector('.oneoff-bar input');
  await page.locator('.oneoff-bar input').fill('Tuto sur la gestion de budget');
  await page.locator('.oneoff-bar input').press('Enter');
  await page.waitForTimeout(1000);
  await dismissCeremonies(page);
  await page.waitForTimeout(300);
  check(
    'Le geste ponctuel apparaît, nommé, sur la journée',
    ((await page.locator('.checkin-chip.oneoff .checkin-title').first().textContent()) ?? '').includes(
      'Tuto sur la gestion de budget',
    ),
    await page.locator('.checkin-chip.oneoff .checkin-title').first().textContent(),
  );
  check(
    'Il rapporte ses 10 PP fixes',
    Number(await page.locator('.ring-value').textContent()) === ppAvant + 10,
    `${ppAvant} → ${await page.locator('.ring-value').textContent()}`,
  );
  check(
    'Il n’est pas barré : rien n’a été coché',
    (await page
      .locator('.checkin-chip.oneoff .checkin-title')
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine)) === 'none',
  );
  check(
    'Le geste ponctuel ne déborde pas de sa carte',
    await page.evaluate(() => {
      const chip = document.querySelector('.checkin-chip.oneoff');
      const card = chip?.closest('.today-goal');
      if (!chip || !card) return false;
      const a = chip.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      return a.right <= b.right + 1 && a.left >= b.left - 1;
    }),
  );

  // La règle qui empêche tout de dériver : demain, ce n'est pas une case.
  await reloadZenith(page);
  await page.waitForSelector('.checkin-chips');
  check(
    'Après rechargement, il reste un geste et pas une action de plus',
    (await page.locator('.checkin-chip.oneoff').count()) === 1 &&
      (await page.locator('.checkin-chip:not(.add-oneoff):not(.oneoff)').count()) === 6,
    `${await page.locator('.checkin-chip.oneoff').count()} / ${await page.locator('.checkin-chip:not(.add-oneoff):not(.oneoff)').count()}`,
  );
  // Le journal doit le nommer : dans six mois, « Check-in » ne dira rien.
  await page.getByRole('button', { name: 'Historique' }).click();
  await page.waitForSelector('.entry');
  check(
    'Le journal nomme le geste et le distingue d’une coche',
    (await page.locator('.entry-checkin .entry-title').first().textContent()) ===
      'Tuto sur la gestion de budget' &&
      (await page.locator('.entry-checkin .entry-kind').first().textContent()) === 'geste ponctuel',
    `${await page.locator('.entry-checkin .entry-title').first().textContent()} / ${await page.locator('.entry-checkin .entry-kind').first().textContent()}`,
  );

  // Aucun palier ne bouge : sinon « 30 jours sans écran » se validerait en
  // notant trente fois « j'y ai pensé ».
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.goal');
  check(
    'Aucun palier ne monte grâce à un geste ponctuel',
    ((await page.locator('.goal-count').first().textContent()) ?? '').includes('2/6'),
    await page.locator('.goal-count').first().textContent(),
  );
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.waitForSelector('.checkin-chips');
  // Re-cliquer annule : c'est la seule sortie de secours d'une faute de frappe.
  await page.locator('.checkin-chip.oneoff').first().click();
  await page.waitForTimeout(900);
  check(
    'Re-cliquer annule le geste et rend les PP',
    (await page.locator('.checkin-chip.oneoff').count()) === 0 &&
      Number(await page.locator('.ring-value').textContent()) === ppAvant,
    await page.locator('.ring-value').textContent(),
  );

  // Salle des trophées
  await page.getByRole('button', { name: 'Trophées' }).click();
  await page.waitForSelector('.trophy-grid');
  check('12 trophées listés', (await page.locator('.trophy').count()) === 12, String(await page.locator('.trophy').count()));
  check(
    "3 trophées acquis — « Premier pas » persiste malgré l'annulation du check-in",
    (await page.locator('.trophy.unlocked').count()) === 3,
    String(await page.locator('.trophy.unlocked').count()),
  );
  await page.screenshot({ path: 'screens/trophees.png', fullPage: true });


  // 10. Vue finale
  await page.getByRole('button', { name: 'Objectifs' }).click();
  await page.waitForSelector('.goal');
  await page.locator('.goal').nth(1).locator('.goal-head').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screens/accueil.png', fullPage: true });

  // 10. Rendu mobile
  // Même contexte que la page précédente, sinon le localStorage repart à vide.
  // Bannière « streak en jeu » : contexte isolé, activité datée d'hier seulement
  const riskCtx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const riskPage = await riskCtx.newPage();
  await gotoZenith(riskPage, BASE);
  await riskPage.evaluate(() => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const now = new Date().toISOString();
    const goal = {
      id: 'g1',
      title: 'Objectif test',
      description: '',
      emoji: '🎯',
      position: 0,
      archived: false,
      createdAt: now,
      tiers: [
        { id: 't1', goalId: 'g1', title: 'Palier 1', rank: 'or', position: 0, completedAt: null, createdAt: now },
      ],
    };
    localStorage.setItem(
      'palier.v1',
      JSON.stringify({
        goals: [goal],
        checkins: [{ id: 'c1', goalId: 'g1', day, note: '', createdAt: now }],
        achievements: [],
      }),
    );
  });
  await reloadZenith(riskPage);
  await riskPage.waitForSelector('.hub');
  check(
    "Bannière « streak en jeu » quand rien n'est fait aujourd'hui",
    await riskPage.locator('.streak-banner').isVisible(),
  );
  await riskCtx.close();

  const mobile = await page.context().newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await gotoZenith(mobile, BASE);
  await mobile.waitForSelector('.brand', { state: 'attached' });
  check(
    'Barre de navigation mobile en bas',
    await mobile.locator('.sidebar .nav-item').first().isVisible(),
  );
  await mobile.waitForSelector('.hub');
  check(
    'Hub mobile sans débordement horizontal',
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  // iOS zoome sur tout champ dont la police fait moins de 16px : on vérifie que
  // le champ de note (le plus exposé, il s'ouvre après chaque check-in) est à 16px.
  await mobile.locator('.checkin-chip').first().click();
  await mobile.waitForSelector('.checkin-chip.done .checkin-note-btn');
  await mobile.locator('.checkin-chip.done .checkin-note-btn').first().click();
  await mobile.waitForSelector('.checkin-note input');
  check(
    'Champ de note à 16px sur mobile (pas de zoom iOS)',
    (await mobile
      .locator('.checkin-note input')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 16,
    `${await mobile.locator('.checkin-note input').evaluate((el) => getComputedStyle(el).fontSize)}`,
  );
  check(
    'Pas de background-attachment: fixed (jank de scroll mobile)',
    (await mobile.evaluate(() => getComputedStyle(document.body).backgroundAttachment)) !== 'fixed',
    await mobile.evaluate(() => getComputedStyle(document.body).backgroundAttachment),
  );
  await mobile.waitForTimeout(600); // le scrollIntoView est animé
  check(
    'Champ de note visible, pas masqué par la barre d\'onglets',
    await mobile.evaluate(() => {
      const input = document.querySelector('.checkin-note input');
      const bar = document.querySelector('.sidebar');
      if (!input || !bar) return false;
      const i = input.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return i.top >= 0 && i.bottom <= b.top;
    }),
  );
  // Seule la flamme du streak a le droit de tourner en permanence : un transform
  // sur un élément, composité par le GPU. Tout le reste doit être coupé.
  {
    const running = await mobile.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => (a.effect?.target instanceof Element ? a.effect.target.className : '?')),
    );
    check(
      'Aucune animation permanente sur mobile hors la flamme',
      running.every((c) => String(c).includes('flame')),
      running.join(', ') || 'aucune',
    );
  }

  await mobile.getByRole('button', { name: 'Objectifs' }).click();
  await mobile.waitForSelector('.goal');
  await mobile.locator('.goal-head').first().click();
  await mobile.waitForTimeout(200);
  await mobile.screenshot({ path: 'screens/mobile.png', fullPage: true });
  check('Rendu mobile sans débordement horizontal', await mobile.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  ));

  // --- Barre du haut ----------------------------------------------------
  // Une seule porte vers les réglages, et rien d'autre : les raccourcis
  // import/export/déconnexion qui n'apparaissaient que sur téléphone créaient
  // deux vocabulaires pour une même chose.
  check(
    'La barre du haut ne porte que Réglages et + Objectif',
    (await page.locator('.topbar-actions .btn').count()) === 2,
    String(await page.locator('.topbar-actions .btn').count()),
  );
  check(
    'Plus de raccourcis en doublon dans la barre du haut',
    (await page.locator('.topbar-mobile-actions').count()) === 0,
  );
  check(
    'Le bouton Réglages porte son nom quand il y a la place',
    await page.locator('.topbar-settings-label').isVisible(),
  );

  // --- Réglages ---------------------------------------------------------
  await page.locator('.topbar-settings').click();
  await page.waitForSelector('.settings-block');
  check('Le panneau de réglages s’ouvre', await page.locator('.settings-block').first().isVisible());
  check(
    'Les quatre rythmes quotidiens sont proposés',
    (await page.locator('.goal-level').count()) === 4,
    String(await page.locator('.goal-level').count()),
  );
  {
    // Changer de rythme doit être immédiat : c'est un réglage, pas un formulaire.
    const before = await page.locator('.goal-level.active b').textContent();
    await page.locator('.goal-level').last().click();
    await page.waitForTimeout(200);
    const after = await page.locator('.goal-level.active b').textContent();
    check('Le rythme choisi est appliqué tout de suite', before !== after, `${before} → ${after}`);
  }
  check(
    'Pas de réglage de rappel en mode local (il demande un compte)',
    (await page.locator('.switch').count()) === 0,
  );
  await page.locator('.modal-foot').getByRole('button', { name: 'Fermer' }).click();
  await page.waitForTimeout(250);
  check('Le panneau se referme', (await page.locator('.settings-block').count()) === 0);

  // --- Revenir sur les jours précédents ----------------------------------
  // Contexte neuf : ce bloc dépend de l'ancienneté des objectifs, on ne veut pas
  // polluer l'état des vérifications précédentes.
  {
    const fresh = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    const rp = await fresh.newPage();
    rp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(rp, BASE);
    await rp.getByRole('button', { name: 'Passer' }).click();
    await rp.getByRole('button', { name: 'Charger des exemples' }).click();
    await rp.waitForSelector('.hub');
    await rp.waitForTimeout(300);

    // Sur un compte tout neuf, rien à corriger : l'app se tait complètement, et
    // les flèches ne mènent nulle part.
    check('Aucune alerte sur un compte tout neuf', (await rp.locator('.forgotten').count()) === 0);
    check(
      'La section du jour reste sur « Aujourd’hui »',
      (await rp.locator('.day-nav h2').textContent()) === "Aujourd'hui",
      await rp.locator('.day-nav h2').textContent(),
    );
    check(
      'La flèche arrière est désactivée quand il n’y a rien avant',
      await rp.locator('.day-arrow').first().isDisabled(),
    );

    // On vieillit les objectifs, et on coche une action hier : « hier » est donc
    // entamé, « avant-hier » est resté vide.
    await rp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const old = new Date(Date.now() - 10 * 86400000).toISOString();
      snap.goals.forEach((g) => (g.createdAt = old));
      const h = new Date(Date.now() - 86400000);
      const d = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
      const a = snap.actions[0];
      snap.checkins.push({
        id: 'seed-hier', goalId: a.goalId, actionId: a.id, pp: a.pp,
        day: d, note: '', createdAt: `${d}T09:00:00.000Z`, value: null,
      });
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(rp);
    await rp.waitForSelector('.forgotten');
    await rp.waitForTimeout(400);

    // Une seule ligne, pour le seul jour resté vide. Hier est entamé : l'app
    // n'en dit rien — c'est ce qui la rend supportable au quotidien.
    check(
      'Une seule ligne, et seulement pour le jour resté vide',
      (await rp.locator('.forgotten').count()) === 1,
      String(await rp.locator('.forgotten').count()),
    );
    check(
      'Elle nomme le jour et ne parle pas de la journée entamée',
      /Avant-hier · .+rien de coché/s.test((await rp.locator('.forgotten').textContent()) ?? ''),
      (await rp.locator('.forgotten-text').textContent())?.trim(),
    );

    // La navigation par flèches : hier, puis retour.
    await rp.locator('.day-arrow').first().click();
    await rp.waitForTimeout(250);
    check(
      'La flèche arrière change le jour de la section',
      /^Hier · /.test((await rp.locator('.day-nav h2').textContent()) ?? ''),
      await rp.locator('.day-nav h2').textContent(),
    );
    // Le piège classique de ce genre de navigation : cocher le mauvais jour sans
    // s'en apercevoir. Ça doit se voir sans avoir à lire.
    check(
      'Un repère visuel signale qu’on n’est plus sur aujourd’hui',
      (await rp.locator('.hub-section.past-day').count()) === 1,
    );
    check(
      "L'action déjà cochée hier apparaît comme faite",
      (await rp.locator('.past-day .checkin-chip.done').count()) === 1,
      String(await rp.locator('.past-day .checkin-chip.done').count()),
    );

    // Décocher une erreur de la veille, puis rajouter un oubli.
    const titleBefore = await rp.locator('.daily-title').textContent();
    await rp.locator('.past-day .checkin-chip.done').first().click();
    await rp.waitForTimeout(800);
    await dismissCeremonies(rp);
    check(
      'On peut décocher une action de la veille',
      (await rp.locator('.past-day .checkin-chip.done').count()) === 0,
    );
    await rp.locator('.past-day .checkin-chip').first().click();
    await rp.waitForTimeout(800);
    await dismissCeremonies(rp);
    check(
      'On peut cocher une action oubliée la veille',
      (await rp.locator('.past-day .checkin-chip.done').count()) === 1,
    );
    // Le point le plus important : les PP d'hier vont à hier.
    check(
      'Une coche rétroactive ne gonfle pas l’anneau du jour',
      (await rp.locator('.daily-title').textContent()) === titleBefore,
      `${titleBefore} → ${await rp.locator('.daily-title').textContent()}`,
    );
    check(
      'Elle nourrit tout de même le streak',
      (await rp.locator('.flame-count').textContent()) !== '0',
      await rp.locator('.flame-count').textContent(),
    );

    // La fenêtre est bornée à 48 h : on ne remonte pas plus loin.
    await rp.locator('.day-arrow').first().click();
    await rp.waitForTimeout(250);
    check(
      'On remonte jusqu’à avant-hier',
      /^Avant-hier · /.test((await rp.locator('.day-nav h2').textContent()) ?? ''),
      await rp.locator('.day-nav h2').textContent(),
    );
    check(
      'Et pas plus loin : la fenêtre est bornée à 48 h',
      await rp.locator('.day-arrow').first().isDisabled(),
    );

    await rp.getByRole('button', { name: "Revenir à aujourd'hui" }).click();
    await rp.waitForTimeout(250);
    check(
      'Le retour à aujourd’hui remet tout en place',
      (await rp.locator('.day-nav h2').textContent()) === "Aujourd'hui" &&
        (await rp.locator('.hub-section.past-day').count()) === 0,
    );

    // « Rien fait » fait taire l'alerte, définitivement.
    await rp.locator('.forgotten').getByRole('button', { name: 'Rien fait' }).click();
    await rp.waitForTimeout(300);
    check('« Rien fait » retire l’alerte', (await rp.locator('.forgotten').count()) === 0);
    check(
      'Mais le jour reste atteignable par les flèches',
      !(await rp.locator('.day-arrow').first().isDisabled()),
    );

    await reloadZenith(rp);
    await rp.waitForSelector('.hub');
    await rp.waitForTimeout(400);
    check(
      'La question ne se repose pas au rechargement',
      (await rp.locator('.forgotten').count()) === 0,
    );
    await fresh.close();
  }

  // --- Paliers comptables : la boucle se referme ---------------------------
  // Le cœur du sprint : l'action quotidienne fait monter le palier, et le palier
  // se valide seul en atteignant sa cible.
  {
    const fresh = await browser.newContext({ viewport: { width: 1150, height: 1000 } });
    const cp = await fresh.newPage();
    cp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(cp, BASE);
    await cp.getByRole('button', { name: 'Passer' }).click();
    await cp.getByRole('button', { name: 'Charger des exemples' }).click();
    await cp.waitForSelector('.hub');

    // Un palier « 3 jours » avec deux jours déjà faits : la coche du jour est
    // celle qui déclenche tout.
    await cp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const old = new Date(Date.now() - 30 * 86400000).toISOString();
      const g = snap.goals[0];
      g.createdAt = old;
      const base = {
        goalId: g.id, completedAt: null, createdAt: old,
        kind: 'compte', unit: 'jours', direction: 'hausse', mode: 'absolu', sources: [],
      };
      g.tiers = [
        { ...base, id: 'tc1', title: '3 jours sans écran', rank: 'bronze', position: 0, target: 3 },
        { ...base, id: 'tc2', title: '30 jours sans écran', rank: 'argent', position: 1, target: 30 },
      ];
      snap.goals = [g];
      const a = snap.actions.find((x) => x.goalId === g.id);
      snap.actions = [a];
      const day = (n) => {
        const d = new Date(Date.now() - n * 86400000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      snap.checkins = [3, 4].map((n, i) => ({
        id: `s${i}`, goalId: g.id, actionId: a.id, pp: a.pp,
        day: day(n), note: '', createdAt: `${day(n)}T09:00:00.000Z`, value: null,
      }));
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(cp);
    await cp.waitForSelector('.meter');
    await cp.waitForTimeout(400);

    check(
      'Le palier comptable affiche son avancée',
      (await cp.locator('.meter-count').first().textContent())?.replace(/\s+/g, ' ').trim() ===
        '2 / 3 jours · +1 ce soir',
      (await cp.locator('.meter-count').first().textContent())?.replace(/\s+/g, ' ').trim(),
    );
    // Le lien explicite entre le geste du soir et la marche qu'il fait monter.
    check(
      'Il annonce ce que la coche du soir va ajouter',
      (await cp.locator('.meter-pending').count()) === 1,
    );
    // Proposer « Valider » sur un palier qui se compte reviendrait à proposer
    // de tricher.
    check(
      'Aucun bouton « Valider » sur un palier comptable',
      (await cp.locator('.next-validate').count()) === 0,
    );

    await cp.locator('.checkin-chip').first().click();
    await cp.waitForTimeout(1200);
    const ceremony = (await cp.locator('.ceremony').first().innerText().catch(() => '')).replace(
      /\s+/g,
      ' ',
    );
    check(
      'Atteindre la cible déclenche la cérémonie au clic',
      /PALIER VALIDÉ/i.test(ceremony) && ceremony.includes('3 jours sans écran'),
      ceremony.slice(0, 80),
    );
    check('Elle annonce les PP du rang', /\+50 PP/.test(ceremony), ceremony.slice(0, 80));
    await dismissCeremonies(cp);
    await cp.waitForTimeout(500);

    check(
      'Le palier suivant prend le relais avec son propre compte',
      (await cp.locator('.next-title').first().textContent()) === '30 jours sans écran' &&
        (await cp.locator('.meter-count').first().textContent())?.includes('3 / 30'),
      await cp.locator('.meter-count').first().textContent(),
    );

    await cp.getByRole('button', { name: 'Objectifs' }).click();
    await cp.waitForSelector('.goal');
    await cp.locator('.goal-head').first().click();
    await cp.waitForTimeout(400);
    check(
      'Le palier atteint est daté dans l’échelle',
      (await cp.locator('.tier-date').first().textContent())?.startsWith('Validé le'),
      await cp.locator('.tier-date').first().textContent(),
    );
    check(
      'Chaque palier comptable a sa barre',
      (await cp.locator('.ladder .meter').count()) === 2,
      String(await cp.locator('.ladder .meter').count()),
    );

    // Décocher fait redescendre le compteur, mais ne reprend pas la victoire.
    await cp.getByRole('button', { name: 'Accueil' }).click();
    await cp.waitForSelector('.hub');
    await cp.locator('.checkin-chip.done').first().click();
    await cp.waitForTimeout(900);
    await dismissCeremonies(cp);
    await cp.getByRole('button', { name: 'Objectifs' }).click();
    await cp.waitForSelector('.goal');
    // L'échelle est restée dépliée depuis tout à l'heure : re-cliquer sur
    // l'en-tête la refermerait.
    if ((await cp.locator('.ladder').count()) === 0) {
      await cp.locator('.goal-head').first().click();
    }
    await cp.waitForSelector('.ladder');
    await cp.waitForTimeout(400);
    check(
      'Annuler une coche ne reprend jamais un palier acquis',
      (await cp.locator('.tier-date').count()) === 1,
      `${await cp.locator('.tier-date').count()} palier(s) encore daté(s)`,
    );
    check(
      'Mais le compteur, lui, redescend',
      (await cp.locator('.ladder .meter-count').last().textContent())?.includes('2 / 30'),
      await cp.locator('.ladder .meter-count').last().textContent(),
    );
    await fresh.close();
  }

  // --- Quantités, relevés et mesures ---------------------------------------
  // La promesse du lot : un appui reste un appui. La saisie n'apparaît que pour
  // un relevé (où elle est le geste) ou pour corriger.
  {
    const fresh = await browser.newContext({ viewport: { width: 1150, height: 1000 } });
    const qp = await fresh.newPage();
    qp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(qp, BASE);
    await qp.getByRole('button', { name: 'Passer' }).click();
    await qp.getByRole('button', { name: 'Charger des exemples' }).click();
    await qp.waitForSelector('.hub');

    await qp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const old = new Date(Date.now() - 30 * 86400000).toISOString();
      const g = snap.goals[0];
      g.createdAt = old;
      const base = {
        goalId: g.id, completedAt: null, createdAt: old,
        direction: 'hausse', mode: 'absolu', sources: [],
      };
      g.tiers = [
        { ...base, id: 'tq1', title: '20 km courus', rank: 'bronze', position: 0, kind: 'cumul', target: 20, unit: 'km' },
        { ...base, id: 'tq2', title: 'Perdre 2 kg', rank: 'argent', position: 1, kind: 'mesure', target: -2, unit: 'kg', direction: 'baisse', mode: 'delta' },
        { ...base, id: 'tq3', title: 'Faire un bilan', rank: 'or', position: 2, kind: 'jalon', target: null, unit: '' },
      ];
      snap.goals = [g];
      const a = snap.actions.find((x) => x.goalId === g.id);
      snap.actions = [
        { ...a, id: 'aq1', title: 'Sortie course', pp: 15, position: 0, unit: 'km', defaultValue: 8, isMeasure: false },
        { ...a, id: 'aq2', title: 'Me peser', pp: 5, position: 1, unit: 'kg', defaultValue: null, isMeasure: true },
      ];
      const d = new Date(Date.now() - 7 * 86400000);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // Une première pesée, la semaine dernière : le point de départ.
      snap.checkins = [
        { id: 'cq0', goalId: g.id, actionId: 'aq2', pp: 5, day, note: '', createdAt: `${day}T07:00:00.000Z`, value: 80 },
      ];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(qp);
    await qp.waitForSelector('.meter');
    await qp.waitForTimeout(400);

    const course = qp.locator('.checkin-chip', { hasText: 'Sortie course' });
    const balance = qp.locator('.checkin-chip', { hasText: 'Me peser' });
    const cumul = () =>
      qp.locator('.meter-count').first().textContent().then((t) => (t ?? '').replace(/\s+/g, ' '));

    check(
      'La pastille annonce ce que l’appui va enregistrer',
      (await course.locator('.checkin-amount').textContent()) === '8 km',
      await course.locator('.checkin-amount').textContent(),
    );
    check(
      'Un relevé n’annonce aucune valeur habituelle',
      (await balance.locator('.checkin-amount').count()) === 0,
    );
    check('Le relevé de la semaine dernière n’a pas nourri le cumul', (await cumul()).includes('0 / 20 km'), await cumul());

    // 1. Un appui, rien d'autre : pas de clavier sur le chemin.
    await course.click();
    await qp.waitForTimeout(800);
    check(
      'Cocher une action quantifiée n’ouvre aucun clavier',
      (await qp.locator('.checkin-value').count()) === 0,
    );
    check('Et la valeur habituelle nourrit le cumul', (await cumul()).includes('8 / 20 km'), await cumul());

    // 2. Ajuster : une correction, jamais un passage obligé.
    await qp.getByRole('button', { name: 'Ajuster la quantité de Sortie course', exact: true }).click();
    await qp.waitForSelector('.checkin-value input');
    check(
      'Ajuster propose la valeur déjà enregistrée',
      (await qp.locator('.checkin-value input').inputValue()) === '8',
      await qp.locator('.checkin-value input').inputValue(),
    );
    await qp.locator('.checkin-value input').fill('12,5');
    await qp.getByRole('button', { name: 'Enregistrer' }).click();
    await qp.waitForTimeout(700);
    check('La correction est reprise par le compteur', (await cumul()).includes('12,5 / 20 km'), await cumul());
    check(
      'Et affichée sur la pastille',
      (await course.locator('.checkin-amount').textContent()) === '12,5 km',
      await course.locator('.checkin-amount').textContent(),
    );

    // 3. Le relevé : la saisie EST le geste, rien n'est enregistré avant.
    await balance.click();
    await qp.waitForSelector('.checkin-value input');
    check('Un relevé ouvre la saisie au lieu de se cocher', await qp.locator('.checkin-value').isVisible());
    check(
      'Rien n’est enregistré tant que la valeur n’est pas donnée',
      !((await balance.getAttribute('class')) ?? '').includes('done'),
    );
    await qp.locator('.checkin-value input').fill('78');
    await qp.getByRole('button', { name: 'Enregistrer' }).click();
    await qp.waitForTimeout(1300);

    const mCeremony = (await qp.locator('.ceremony').first().innerText().catch(() => '')).replace(
      /\s+/g,
      ' ',
    );
    check(
      'Atteindre la cible d’une mesure déclenche la cérémonie',
      /PALIER VALIDÉ/i.test(mCeremony) && mCeremony.includes('Perdre 2 kg'),
      mCeremony.slice(0, 80),
    );
    await dismissCeremonies(qp);
    await qp.waitForTimeout(600);
    check(
      'Le relevé n’a pas gonflé le cumul de 78 kilomètres',
      (await cumul()).includes('12,5 / 20 km'),
      await cumul(),
    );

    // 4. La courbe : la pente, pas le pourcentage.
    await qp.getByRole('button', { name: 'Objectifs' }).click();
    await qp.waitForSelector('.goal');
    await qp.locator('.goal-head').first().click();
    await qp.waitForSelector('.ladder');
    await qp.waitForTimeout(400);
    check(
      'Une mesure a sa courbe dès le deuxième relevé',
      (await qp.locator('.measure-chart').count()) === 1,
      String(await qp.locator('.measure-chart').count()),
    );
    const foot = (await qp.locator('.measure-foot').innerText()).replace(/\s+/g, ' ');
    check(
      'La courbe rappelle le point de départ et la cible',
      /départ 80 kg/.test(foot) && /cible 78 kg/.test(foot),
      foot,
    );

    // 5. Un palier écrit à la main peut devenir comptable.
    check(
      'Un jalon n’affiche aucune barre',
      (await qp.locator('.ladder .meter').count()) === 2,
      String(await qp.locator('.ladder .meter').count()),
    );
    await qp.getByRole('button', { name: 'Façon de compter Faire un bilan' }).click();
    await qp.waitForSelector('.tier-counter');
    await qp.locator('.tier-counter').getByRole('button', { name: 'Jours' }).click();
    await qp.waitForTimeout(600);
    check(
      'Le passer en « Jours » lui donne une barre',
      (await qp.locator('.ladder .meter').count()) === 3,
      String(await qp.locator('.ladder .meter').count()),
    );
    check(
      'Avec une cible et une unité crédibles, pas un champ vide',
      ((await qp.locator('.ladder .meter-count').last().textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .includes('/ 30 jours'),
      await qp.locator('.ladder .meter-count').last().textContent(),
    );

    // 6. L'éditeur d'action : quantifier après coup, pas de formulaire à la création.
    await qp.getByRole('button', { name: 'Quantifier Me peser' }).click();
    await qp.waitForSelector('.action-quant');
    check(
      'La nature d’une action est reconnue',
      (await qp
        .locator('.action-quant')
        .getByRole('button', { name: 'Relevé' })
        .getAttribute('aria-pressed')) === 'true',
    );
    await qp.locator('.action-quant').getByRole('button', { name: 'Simple' }).click();
    await qp.waitForTimeout(600);
    check(
      'Revenir à « Simple » efface l’unité',
      (await qp.locator('.action-row-wrap', { hasText: 'Me peser' }).locator('.action-row-unit').count()) === 0,
    );

    // 7. Le chemin complet d'un modèle : ses paliers en kilos n'ont de sens que
    // si ses actions savent en produire. « Perdre du poids » était le cas le
    // plus grave — quatre paliers de mesure et aucune façon de les atteindre.
    await qp.getByRole('button', { name: 'Nouvel objectif' }).click();
    await qp.waitForSelector('.picker-card');
    await qp.getByRole('button', { name: 'Santé' }).click();
    await qp.waitForTimeout(200);
    await qp.locator('.picker-card', { hasText: 'Perdre du poids' }).click();
    await qp.waitForSelector('.preview-tiers');
    await qp.getByRole('button', { name: 'Choisir cet objectif' }).click();
    await qp.waitForSelector('.modal');
    await qp.getByRole('button', { name: "Créer l'objectif" }).click();
    await dismissCeremonies(qp);
    await qp.waitForSelector('.goal');
    await qp.waitForTimeout(600);
    const poids = qp.locator('.goal', { hasText: 'Perdre du poids' });
    // La carte d'un objectif tout juste créé s'ouvre d'elle-même : cliquer
    // l'en-tête la refermerait.
    if ((await poids.locator('.ladder').count()) === 0) await poids.locator('.goal-head').click();
    await qp.waitForSelector('.action-editor');
    await qp.waitForTimeout(500);
    check(
      'Un modèle de mesure arrive avec son relevé',
      (await poids.locator('.action-row-wrap', { hasText: 'Pesée' }).locator('.action-row-unit').textContent()) ===
        'relevé en kg',
      await poids.locator('.action-row-wrap', { hasText: 'Pesée' }).locator('.action-row-unit').textContent(),
    );
    await fresh.close();
  }

  // --- Mise en page de la création d'objectif ------------------------------
  // Ces vérifications sont géométriques, pas textuelles : la bibliothèque de
  // modèles a vécu une version entière sans une ligne de CSS, et tous les tests
  // passaient — ils comptaient des éléments, pas des pixels. Un titre qui passe
  // sous un badge, une puce native, un panneau plus large que le téléphone : ça
  // ne se voit qu'en mesurant.
  {
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 950 } });
    const lp = await fresh.newPage();
    lp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(lp, BASE);
    await lp.getByRole('button', { name: 'Passer' }).click();
    await lp.waitForSelector('.empty');
    await lp.getByRole('button', { name: 'Créer mon premier objectif' }).click();
    await lp.waitForSelector('.picker-card');
    await lp.waitForTimeout(300);

    check(
      'Les modèles sont disposés en grille, pas empilés en ligne',
      (await lp.locator('.picker-grid').evaluate((el) => getComputedStyle(el).display)) === 'grid',
    );
    {
      // Deux cartes côte à côte sur un large écran : si la grille n'existe pas,
      // elles se suivent sur la même ligne de texte.
      const a = await lp.locator('.picker-card').nth(0).boundingBox();
      const b = await lp.locator('.picker-card').nth(1).boundingBox();
      check(
        'Chaque modèle occupe sa propre carte, de hauteur lisible',
        a.height >= 44 && Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width - 2,
        `h=${Math.round(a.height)}`,
      );
    }

    await lp.locator('.picker-card').first().click();
    await lp.waitForSelector('.preview-tiers');
    await lp.waitForTimeout(250);

    check(
      'L’aperçu n’affiche pas de puce native',
      (await lp
        .locator('.preview-tiers li')
        .first()
        .evaluate((el) => getComputedStyle(el).listStyleType)) === 'none',
    );
    {
      // Le numéro collé au titre donnait « 15 pompes » pour l'étape n° 1
      // « 5 pompes » : deux nombres qui se lisent comme un seul.
      const index = await lp.locator('.preview-index').first().boundingBox();
      const title = await lp.locator('.preview-title').first().boundingBox();
      const badge = await lp.locator('.preview-tiers .rank-badge').first().boundingBox();
      check(
        'Numéro, titre et rang occupent trois colonnes distinctes',
        index.x + index.width <= title.x && title.x + title.width <= badge.x + 1,
        `${Math.round(index.x + index.width)} | ${Math.round(title.x)} → ${Math.round(title.x + title.width)} | ${Math.round(badge.x)}`,
      );
    }

    await lp.getByRole('button', { name: 'Choisir cet objectif' }).click();
    await lp.waitForSelector('.modal-foot');
    await lp.waitForTimeout(300);
    {
      // Le badge de rang change de largeur selon le mot : sans colonne fixe,
      // chaque ligne de l'échelle démarre à un endroit différent.
      // `> input` : le champ d'intitulé seul. Les champs de cible, eux, ont
    // leur propre colonne et une autre largeur.
    const widths = await lp.locator('.draft-tier > input').evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().width)),
      );
      check(
        'Les champs de l’échelle sont tous alignés',
        new Set(widths).size === 1,
        widths.join(' / '),
      );
    }

    await lp.getByRole('button', { name: "Créer l'objectif" }).click();
    await lp.waitForSelector('.ceremony-ladder');
    await lp.waitForTimeout(1200);
    {
      const row = await lp.locator('.ceremony-step-row').first().boundingBox();
      const title = await lp.locator('.ceremony-step-title').first().boundingBox();
      const rank = await lp.locator('.ceremony-step-rank').first().boundingBox();
      check(
        'L’échelle de la cérémonie tient sur des marches, titre et rang séparés',
        row.height >= 28 && title.x + title.width <= rank.x + 1,
        `h=${Math.round(row.height)}`,
      );
    }
    await fresh.close();
  }

  // --- Rattrapage silencieux d'un palier déjà atteint -----------------------
  // Une coche peut arriver d'un autre appareil ou d'un import : la barre serait
  // pleine à côté d'un palier non validé.
  {
    const fresh = await browser.newContext({ viewport: { width: 1150, height: 900 } });
    const rp = await fresh.newPage();
    rp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(rp, BASE);
    await rp.getByRole('button', { name: 'Passer' }).click();
    await rp.getByRole('button', { name: 'Charger des exemples' }).click();
    await rp.waitForSelector('.hub');
    await rp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const old = new Date(Date.now() - 60 * 86400000).toISOString();
      const g = snap.goals[0];
      g.createdAt = old;
      g.tiers = [{
        id: 'tr1', goalId: g.id, title: '2 jours', rank: 'bronze', position: 0,
        completedAt: null, createdAt: old, kind: 'compte', target: 2, unit: 'jours',
        direction: 'hausse', mode: 'absolu', sources: [],
      }];
      snap.goals = [g];
      const a = snap.actions.find((x) => x.goalId === g.id);
      snap.actions = [a];
      const day = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      // Deux coches venues d'ailleurs : la cible est franchie sans qu'un clic
      // ait eu lieu sur cet appareil.
      snap.checkins = [5, 6].map((n, i) => ({
        id: `sr${i}`, goalId: g.id, actionId: a.id, pp: a.pp,
        day: day(n), note: '', createdAt: `${day(n)}T09:00:00.000Z`, value: null,
      }));
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(rp);
    await rp.waitForSelector('.hub');
    await rp.waitForTimeout(800);
    check(
      'Un palier déjà atteint ailleurs se valide au chargement',
      (await rp.locator('.next-tier').count()) === 0,
      `${await rp.locator('.next-tier').count()} palier(s) encore en cours`,
    );
    check(
      'Sans cérémonie : on ne fête pas une victoire découverte en rechargeant',
      !(await rp.locator('.ceremony').isVisible().catch(() => false)),
    );
    await fresh.close();
  }

  {
    // Sur téléphone, un panneau plus large que l'écran cache ses propres
    // boutons — on ne peut littéralement plus choisir.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pp = await phone.newPage();
    pp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(pp, BASE);
    await pp.getByRole('button', { name: 'Passer' }).click();
    await pp.waitForSelector('.empty');
    await pp.getByRole('button', { name: 'Créer mon premier objectif' }).click();
    await pp.waitForSelector('.picker-card');
    await pp.waitForTimeout(300);
    const box = await pp.locator('.modal').boundingBox();
    check(
      'Le choix d’un modèle tient dans l’écran d’un téléphone',
      box.x >= 0 && box.x + box.width <= 391,
      `${Math.round(box.x)} → ${Math.round(box.x + box.width)} sur 390`,
    );
    const card = await pp.locator('.picker-card').first().boundingBox();
    check(
      'Et ses cartes aussi',
      card.x + card.width <= 391,
      `${Math.round(card.x + card.width)} sur 390`,
    );
    await phone.close();
  }

  // --- La grille des jours : la mémoire d'une habitude ---------------------
  {
    const fresh = await browser.newContext({ viewport: { width: 1180, height: 950 } });
    const hp = await fresh.newPage();
    hp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(hp, BASE);
    await hp.getByRole('button', { name: 'Passer' }).click();
    await hp.waitForSelector('.empty');

    // L'onglet « Habitudes » traverse les domaines au lieu de s'y ajouter :
    // méditer relève de l'esprit, arrêter de fumer de l'arrêt, et les deux sont
    // des habitudes.
    await hp.getByRole('button', { name: 'Créer mon premier objectif' }).click();
    await hp.waitForSelector('.picker-card');
    await hp.waitForTimeout(300);
    check(
      'La bibliothèque s’ouvre sur les habitudes',
      (await hp.locator('.picker-tab.active').textContent()) === 'Habitudes',
      await hp.locator('.picker-tab.active').textContent(),
    );
    check(
      'L’onglet traverse plusieurs domaines',
      (await hp.locator('.picker-card').count()) >= 12,
      String(await hp.locator('.picker-card').count()),
    );
    check(
      'Et « arrêter de me ronger les ongles » s’y trouve',
      (await hp.locator('.picker-card', { hasText: 'ronger les ongles' }).count()) === 1,
    );
    check(
      'Aucun modèle n’est dupliqué entre l’onglet et son domaine',
      await hp.evaluate(() => {
        const titles = [...document.querySelectorAll('.picker-title')].map((e) => e.textContent);
        return new Set(titles).size === titles.length;
      }),
    );
    await hp.getByRole('button', { name: 'Fermer' }).click();

    await hp.getByRole('button', { name: 'Charger des exemples' }).click();
    await hp.waitForSelector('.hub');
    await hp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const day = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const old = new Date(Date.now() - 100 * 86400000).toISOString();
      const iso = (n) => new Date(Date.now() - n * 86400000).toISOString();
      // `bornDaysAgo` place la naissance de l'objectif DANS la fenêtre de douze
      // semaines, ce qui garantit des cases « avant la création » quel que soit
      // le jour de la semaine. Sans ça, les seules cases hors période étaient
      // les jours à venir de la semaine en cours — et il n'y en a aucun le
      // dimanche, où la vérification correspondante mourait.
      const mk = (id, title, targets, allDone, gapYesterday, bornDaysAgo = 100) => {
        const born = bornDaysAgo === 100 ? old : iso(bornDaysAgo);
        const g = { id, title, description: '', emoji: '💅', position: 0, archived: false, createdAt: born,
          tiers: targets.map((t, i) => ({ id: id + 't' + i, goalId: id, title: `${t} jours réussis`,
            rank: ['bronze','argent','or'][i], position: i,
            completedAt: allDone || i === 0 ? born : null, createdAt: born,
            kind: 'compte', target: t, unit: 'jours', direction: 'hausse', mode: 'absolu', sources: [] })) };
        const a = { id: id + 'a', goalId: id, title: 'Journée tenue', pp: 10, position: 0,
          archived: false, createdAt: born, unit: '', defaultValue: null, isMeasure: false };
        const ck = [];
        // Aucune coche avant la naissance : une grille qui montrerait de
        // l'activité avant la création de l'objectif mentirait.
        const debut = Math.min(60, bornDaysAgo - 1);
        for (let n = debut; n >= (gapYesterday ? 2 : 0); n -= 2) {
          ck.push({ id: id + 'c' + n, goalId: id, actionId: a.id, pp: 10, day: day(n), note: '',
            createdAt: `${day(n)}T20:00:00.000Z`, value: null });
        }
        return { g, a, ck };
      };
      const A = mk('hb1', 'Arrêter de me ronger les ongles', [7, 30, 90], false, false);
      const B = mk('hb2', 'Méditer tous les jours', [7, 30, 90], true, false);
      // Celui-ci est né il y a quarante jours : c'est lui qui porte les cases
      // fantômes que la grille doit dessiner sans les confondre avec un oubli.
      const C = mk('hb3', 'Arrêter de me craquer les doigts', [7, 30, 90], false, true, 40);
      snap.goals = [A.g, B.g, C.g];
      snap.actions = [A.a, B.a, C.a];
      snap.checkins = [...A.ck, ...B.ck, ...C.ck];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(hp);
    await hp.waitForSelector('.hub');
    await hp.getByRole('button', { name: 'Objectifs' }).click();
    await hp.waitForSelector('.goal');
    await hp.waitForTimeout(700);

    check(
      'Chaque objectif porte sa grille de jours',
      (await hp.locator('.heat').count()) === 3,
      String(await hp.locator('.heat').count()),
    );
    check(
      'Douze semaines exactement',
      (await hp.locator('.heat').first().locator('.heat-cell').count()) === 84,
      String(await hp.locator('.heat').first().locator('.heat-cell').count()),
    );
    {
      // Une grille qui déborde de sa carte, c'est un scroll horizontal sur toute
      // la page — le défaut le plus pénible sur téléphone.
      const card = await hp.locator('.goal').first().boundingBox();
      const heat = await hp.locator('.heat').first().boundingBox();
      check(
        'Elle tient dans la carte',
        heat.x >= card.x && heat.x + heat.width <= card.x + card.width + 1,
        `${Math.round(heat.width)} px dans ${Math.round(card.width)} px`,
      );
    }
    {
      // Sur l'objectif né il y a quarante jours — donc à l'intérieur de la
      // fenêtre. L'ancienne version interrogeait la première grille, née bien
      // avant la fenêtre : ses seules cases hors période étaient les jours à
      // venir de la semaine en cours, et il n'y en a aucun le dimanche.
      const jeune = hp.locator('.goal', { hasText: 'craquer les doigts' }).locator('.heat');
      const ghosts = await jeune.locator('.heat-cell.ghost').count();
      check(
        'Rien n’est dessiné avant la création de l’objectif',
        ghosts > 0,
        `${ghosts} cases hors période`,
      );
    }
    check(
      'Aujourd’hui est repéré, une seule fois par grille',
      (await hp.locator('.heat').first().locator('.heat-cell.today').count()) === 1,
    );

    // La règle des deux jours : un seul repère, sur la seule habitude concernée.
    check(
      'La règle des deux jours ne se lève que là où hier est resté vide',
      (await hp.locator('.heat-cell.warn').count()) === 1,
      String(await hp.locator('.heat-cell.warn').count()),
    );

    // La grille dit « je m'y suis mis ». Sans le détail, elle ment par omission
    // dès qu'un objectif a plusieurs actions.
    check(
      'La grille invite à toucher un jour',
      (await hp.locator('.heat').first().locator('.heat-hint').isVisible()),
    );
    {
      // Le streak de CET objectif — la flamme du profil, elle, est globale et
      // compte les jours où on a fait *quelque chose*, tous objectifs confondus.
      const foot = (await hp.locator('.heat').first().locator('.heat-detail').innerText()).replace(
        /\s+/g,
        ' ',
      );
      check('La grille annonce le streak de son objectif', /🔥 \d+ jours? d'affilée/.test(foot), foot);
    }
    {
      const grid = hp.locator('.heat').first();
      const filled = grid.locator('.heat-cell[data-level="3"]').first();
      await filled.click();
      await hp.waitForTimeout(250);
      const text = (await grid.locator('.heat-detail').innerText()).replace(/\s+/g, ' ');
      check(
        'Toucher un jour nomme ce qui a été fait',
        /Journée tenue/.test(text),
        text,
      );
      check(
        'Et le jour lu est repéré dans la grille',
        (await grid.locator('.heat-cell.picked').count()) === 1,
      );
      await filled.click();
      await hp.waitForTimeout(200);
      check(
        'Re-toucher referme le détail',
        (await grid.locator('.heat-cell.picked').count()) === 0,
      );
    }
    {
      // Un jour vide doit le dire, pas rester muet.
      const grid = hp.locator('.heat').first();
      await grid.locator('.heat-cell[data-level="0"]:not(.ghost)').first().click();
      await hp.waitForTimeout(200);
      check(
        'Un jour sans rien le dit clairement',
        /rien ce jour-là/.test(await grid.locator('.heat-detail').innerText()),
        (await grid.locator('.heat-detail').innerText()).replace(/\s+/g, ' '),
      );
    }
    check(
      'La grille est atteignable au clavier, sans 84 arrêts de tabulation',
      (await hp.locator('.heat-grid').first().getAttribute('tabindex')) === '0' &&
        (await hp.locator('.heat-cell[tabindex]').count()) === 0,
    );
    check(
      'Une habitude à action unique ne propose pas de filtre',
      (await hp.locator('.heat').first().locator('.heat-filter').count()) === 0,
    );


    // Bascule vers l'année.
    {
      const heat = hp.locator('.heat').first();
      await heat.getByRole('button', { name: "Voir l'année entière" }).click();
      await hp.waitForTimeout(400);
      check(
        'La bascule ouvre les cinquante-trois semaines d’une année',
        (await heat.locator('.heat-cell').count()) === 53 * 7,
        String(await heat.locator('.heat-cell').count()),
      );
      check(
        'Et le pied le dit',
        /sur 1 an/.test(await heat.locator('.heat-detail').innerText()),
        (await heat.locator('.heat-detail').innerText()).replace(/\s+/g, ' '),
      );
      {
        // Une année de colonnes ne doit pas élargir la carte : elle défile.
        const card = await hp.locator('.goal').first().boundingBox();
        const heatBox = await heat.boundingBox();
        check(
          'La vue année ne fait pas déborder la carte',
          heatBox.x + heatBox.width <= card.x + card.width + 1,
          `${Math.round(heatBox.width)} px dans ${Math.round(card.width)} px`,
        );
      }
      await heat.getByRole('button', { name: 'Revenir aux douze dernières semaines' }).click();
      await hp.waitForTimeout(400);
      check(
        'Le retour ramène les douze semaines',
        (await heat.locator('.heat-cell').count()) === 84,
        String(await heat.locator('.heat-cell').count()),
      );
    }
    {
      // Régression : un contour posé AUTOUR de la case était rogné par le
      // conteneur de défilement — invisible en bas de la dernière ligne, et sur
      // les bords gauche et droit. L'anneau doit rester dans la boîte.
      const grid = hp.locator('.heat').first();
      // Un dimanche : la dernière ligne de la grille, celle où le rognage se
      // voyait. Les cases sont posées colonne par colonne, donc une sur sept.
      const last = grid.locator('.heat-cell:nth-child(7n):not(.ghost)').last();
      await last.click();
      await hp.waitForTimeout(250);
      const ring = await grid
        .locator('.heat-cell.picked')
        .evaluate((el) => getComputedStyle(el).boxShadow);
      check('L’anneau de sélection est dessiné dans la case, donc jamais rogné', /inset/.test(ring), ring);
      {
        const scroll = await grid.locator('.heat-scroll').boundingBox();
        const cellBox = await grid.locator('.heat-cell.picked').boundingBox();
        check(
          'Et la dernière ligne tient entièrement dans la zone visible',
          cellBox.y + cellBox.height <= scroll.y + scroll.height + 0.5,
          `${(cellBox.y + cellBox.height).toFixed(1)} ≤ ${(scroll.y + scroll.height).toFixed(1)}`,
        );
      }
      await last.click();
      await hp.waitForTimeout(150);
    }

    // On ne finit pas une habitude.
    check(
      'Tous les paliers validés + on coche encore = Entretien',
      (await hp.locator('.goal', { hasText: 'Méditer' }).locator('.goal-state.maint').textContent()) ===
        'Entretien',
      await hp.locator('.goal', { hasText: 'Méditer' }).locator('.goal-state').textContent(),
    );
    check(
      'Et « Objectif accompli » ne s’affiche plus à sa place',
      (await hp.locator('.goal-state.done').count()) === 0,
    );
    {
      // Une case vide doit se voir comme une case vide, pas comme un trou : sans
      // ça la grille se lit comme des carrés flottants au lieu d'un calendrier.
      const empty = hp.locator('.heat-cell[data-level="0"]:not(.ghost)').first();
      const bg = await empty.evaluate((el) => getComputedStyle(el).backgroundColor);
      check(
        'Un jour sans rien a bien une case dessinée',
        bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent',
        bg,
      );

      // Les jours d'avant la création de l'objectif ne comptent pas — mais les
      // effacer complètement faisait d'une grille neuve quatre-vingt-trois trous
      // et une case, ce qui ressemble à un bug. Ils gardent un contour, plus
      // léger que celui d'un jour réellement manqué.
      // Une case fantôme absente doit faire tomber CETTE ligne, pas emporter la
      // suite du fichier : `evaluate()` sur un locator vide attend trente
      // secondes puis lève, et tout ce qui vient après reste non vérifié.
      const ghosts = await hp.locator('.heat-cell.ghost').count();
      check('La grille comporte des jours hors période à dessiner', ghosts > 0, `${ghosts} cases`);
      if (ghosts > 0) {
        const ghost = hp.locator('.heat-cell.ghost').first();
        const ghostBorder = await ghost.evaluate((el) => getComputedStyle(el).borderTopColor);
        const emptyBorder = await empty.evaluate((el) => getComputedStyle(el).borderTopColor);
        check(
          'Les jours d’avant la création gardent un contour',
          ghostBorder !== 'rgba(0, 0, 0, 0)' && ghostBorder !== 'transparent',
          ghostBorder,
        );
        check(
          'Mais on ne les confond pas avec un jour manqué',
          ghostBorder !== emptyBorder &&
            (await ghost.evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgba(0, 0, 0, 0)',
          `${ghostBorder} contre ${emptyBorder}`,
        );
      }
    }
    await fresh.close();
  }

  // --- Filtrer la grille par action ----------------------------------------
  // La grille entière répond à « est-ce que je m'y suis mis ». Le filtre répond
  // à « laquelle de mes trois actions je ne fais jamais ».
  {
    const fresh = await browser.newContext({ viewport: { width: 1180, height: 950 } });
    const fp = await fresh.newPage();
    fp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(fp, BASE);
    await fp.getByRole('button', { name: 'Passer' }).click();
    await fp.waitForSelector('.empty');
    await fp.getByRole('button', { name: 'Charger des exemples' }).click();
    await fp.waitForSelector('.hub');
    await fp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const day = (n) => { const d = new Date(Date.now() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const old = new Date(Date.now() - 100 * 86400000).toISOString();
      const g = { id: 'fg', title: 'Courir un semi-marathon', description: '', emoji: '🏃',
        position: 0, archived: false, createdAt: old, tiers: [] };
      const acts = [
        { id: 'fa1', goalId: 'fg', title: 'Sortie longue', pp: 20, position: 0, archived: false, createdAt: old, unit: 'km', defaultValue: 12, isMeasure: false },
        { id: 'fa2', goalId: 'fg', title: 'Sortie course', pp: 15, position: 1, archived: false, createdAt: old, unit: 'km', defaultValue: 6, isMeasure: false },
        { id: 'fa3', goalId: 'fg', title: 'Renforcement', pp: 10, position: 2, archived: false, createdAt: old, unit: '', defaultValue: null, isMeasure: false },
        { id: 'fa4', goalId: 'fg', title: 'Me peser', pp: 5, position: 3, archived: false, createdAt: old, unit: 'kg', defaultValue: null, isMeasure: true },
      ];
      // 4 sorties longues, 20 sorties courses, jamais de renforcement, 3 pesées.
      const ck = [];
      for (let i = 0; i < 4; i++) ck.push({ id: 'l' + i, goalId: 'fg', actionId: 'fa1', pp: 20, day: day(3 + i * 14), note: '', createdAt: `${day(3 + i * 14)}T09:00:00.000Z`, value: 12 });
      for (let i = 0; i < 20; i++) ck.push({ id: 'c' + i, goalId: 'fg', actionId: 'fa2', pp: 15, day: day(2 + i * 3), note: '', createdAt: `${day(2 + i * 3)}T09:00:00.000Z`, value: 6 });
      const poids = [82, 81.2, 80.5];
      for (let i = 0; i < poids.length; i++) ck.push({ id: 'm' + i, goalId: 'fg', actionId: 'fa4', pp: 5, day: day(5 + i * 20), note: '', createdAt: `${day(5 + i * 20)}T08:00:00.000Z`, value: poids[i] });
      snap.goals = [g]; snap.actions = acts; snap.checkins = ck;
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(fp);
    await fp.waitForSelector('.hub');
    await fp.getByRole('button', { name: 'Objectifs' }).click();
    await fp.waitForSelector('.heat');
    await fp.waitForTimeout(700);

    check(
      'Un objectif à plusieurs actions propose de filtrer',
      (await fp.locator('.heat-chip').count()) === 5,
      String(await fp.locator('.heat-chip').count()),
    );
    check(
      '« Tout » est actif par défaut',
      (await fp.locator('.heat-chip.on').textContent()) === 'Tout',
      await fp.locator('.heat-chip.on').textContent(),
    );
    const lit = () => fp.locator('.heat-cell[data-level="3"], .heat-cell[data-level="2"], .heat-cell[data-level="1"]').count();
    const before = await lit();

    await fp.getByRole('button', { name: 'Sortie longue' }).click();
    await fp.waitForTimeout(350);
    check(
      'Filtrer sur une action réduit la grille à ses jours',
      (await lit()) === 4 && before > 4,
      `${before} → ${await lit()}`,
    );
    check(
      'Et la pastille dit laquelle on regarde',
      (await fp.locator('.heat-chip.on').textContent()) === 'Sortie longue',
    );

    // Le vrai service rendu : voir ce qu'on ne fait jamais.
    await fp.getByRole('button', { name: 'Renforcement' }).click();
    await fp.waitForTimeout(350);
    check(
      'Une action jamais faite le dit, au lieu de disparaître',
      (await lit()) === 0 &&
        /Jamais fait/.test(await fp.locator('.heat-detail').innerText()),
      (await fp.locator('.heat-detail').innerText()).replace(/\s+/g, ' '),
    );

    await fp.getByRole('button', { name: 'Tout', exact: true }).click();
    await fp.waitForTimeout(350);
    check('Revenir à « Tout » restaure la grille entière', (await lit()) === before);

    await fp.getByRole('button', { name: 'Sortie course' }).click();
    await fp.waitForTimeout(300);
    await fp.locator('.heat-cell[data-level="3"]').first().click();
    await fp.waitForTimeout(300);
    check(
      'Sous filtre, le détail d’un jour ne nomme que l’action filtrée',
      /Sortie course/.test(await fp.locator('.heat-detail').innerText()) &&
        !/Sortie longue/.test(await fp.locator('.heat-detail').innerText()),
      (await fp.locator('.heat-detail').innerText()).replace(/\s+/g, ' '),
    );

    // Une action de relevé ne se filtre pas en cases : elle se filtre en courbe.
    await fp.getByRole('button', { name: 'Me peser' }).click();
    await fp.waitForTimeout(350);
    check(
      'Filtrer sur un relevé remplace la grille par une courbe',
      (await fp.locator('.heat-grid').count()) === 0 &&
        (await fp.locator('.measure-chart').count()) === 1,
    );
    check(
      'Le bouton de zoom disparaît, sans objet sur une courbe',
      (await fp.locator('.heat-zoom').count()) === 0,
    );

    await fp.getByRole('button', { name: 'Tout', exact: true }).click();
    await fp.waitForTimeout(350);
    check(
      'Revenir à « Tout » restaure la grille, même après une courbe',
      (await fp.locator('.heat-grid').count()) === 1 &&
        (await fp.locator('.measure-chart').count()) === 0,
    );

    await fresh.close();
  }

  // --- L'accompagnement appartient à l'utilisateur, pas au navigateur -------
  // Le marqueur était global à l'appareil : un compte tout neuf créé dans un
  // navigateur déjà servi sautait l'accompagnement et atterrissait sur un écran
  // vide, sans savoir ce qu'est un palier.
  {
    const fresh = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const op = await fresh.newPage();
    op.on('pageerror', (e) => errors.push(e.message));

    await gotoZenith(op, BASE);
    await op.waitForSelector('.onboarding-card');
    check('Première visite : l’accompagnement s’affiche', await op.locator('.onboarding-card').isVisible());
    await op.getByRole('button', { name: 'Passer' }).click();
    await op.waitForSelector('.empty');
    check(
      'Le passer écrit un marqueur portant l’identifiant de l’utilisateur',
      (await op.evaluate(() => localStorage.getItem('zenith.onboarded.local'))) === '1',
      await op.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((k) => k.startsWith('zenith.onboarded')))),
    );
    await reloadZenith(op);
    await op.waitForSelector('.empty');
    check(
      'Et il ne se represente plus au rechargement',
      (await op.locator('.onboarding-card').count()) === 0,
    );

    // Le marqueur d'un autre compte ne doit rien faire pour celui-ci.
    await op.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('zenith.onboarded.autre-utilisateur', '1');
    });
    await reloadZenith(op);
    await op.waitForSelector('.onboarding-card');
    check(
      'Le marqueur du voisin ne saute pas l’accompagnement',
      await op.locator('.onboarding-card').isVisible(),
    );

    // L'ancien marqueur global est récupéré une fois, puis effacé.
    await op.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('zenith.onboarded', '1');
    });
    await reloadZenith(op);
    await op.waitForSelector('.empty');
    check(
      'L’ancien marqueur global est encore honoré',
      (await op.locator('.onboarding-card').count()) === 0,
    );
    check(
      'Mais il est converti puis effacé, pour ne servir qu’une fois',
      (await op.evaluate(() => localStorage.getItem('zenith.onboarded'))) === null &&
        (await op.evaluate(() => localStorage.getItem('zenith.onboarded.local'))) === '1',
    );
    await fresh.close();
  }


  // --- La nature d'un objectif, demandée une fois ---------------------------
  // Avant : chaque palier écrit à la main naissait « à cocher », et il fallait
  // le requalifier un par un dans la carte. Pire, les actions naissaient sans
  // unité, si bien qu'un palier « 100 km » restait à 0/100 quoi qu'on coche.
  {
    const fresh = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    const cp = await fresh.newPage();
    cp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(cp, BASE);
    await cp.waitForSelector('.onboarding-card');
    await cp.getByRole('button', { name: 'Passer' }).click();
    await cp.waitForSelector('.brand');
    await cp.getByRole('button', { name: 'Charger des exemples' }).click();
    await cp.waitForSelector('.hub');
    await cp.getByRole('button', { name: 'Nouvel objectif' }).click();
    await cp.waitForSelector('.picker-grid');
    await cp.getByRole('button', { name: 'Partir de zéro' }).click();
    await cp.waitForSelector('.draft-tier');

    await cp.locator('#goal-title').fill('Traverser la France à pied');
    const etapes = cp.locator('.draft-tier > input');
    await etapes.nth(0).fill('Courir 10 km');
    await etapes.nth(1).fill('Courir 21,1 km');
    await etapes.nth(2).fill('Courir 42,2 km');

    check(
      'Aucune cible demandée tant que les étapes sont « à cocher »',
      (await cp.locator('.draft-amount').count()) === 0,
    );

    await cp.locator('#goal-kind').selectOption('cumul');
    await cp.waitForTimeout(300);
    const valeurs = (sel) => cp.locator(sel).evaluateAll((els) => els.map((el) => el.value));
    const cibles = await valeurs('.draft-amount input:first-child');
    check(
      'La cible se lit dans l’intitulé, sans rien retaper',
      cibles.join(' ') === '10 21,1 42,2',
      cibles.join(' '),
    );
    check('Et la virgule française survit à l’affichage', cibles[1] === '21,1', cibles[1]);
    const unites = await valeurs('.draft-amount input:last-child');
    check("L’unité aussi", unites.every((u) => u === 'km'), unites.join(' '));

    await cp.getByRole('button', { name: "Créer l'objectif" }).click();
    await dismissCeremonies(cp);
    await cp.waitForTimeout(500);
    await cp.getByRole('button', { name: 'Objectifs' }).click();
    await cp.waitForSelector('.goal');
    const carte = cp.locator('.goal', { hasText: 'Traverser la France à pied' });
    if ((await carte.locator('.goal-head').getAttribute('aria-expanded')) !== 'true') {
      await carte.locator('.goal-head').click();
      await cp.waitForTimeout(400);
    }

    check(
      'La carte annonce la nature de l’objectif entier',
      (await carte.locator('.ladder-kind select').inputValue()) === 'cumul',
      await carte.locator('.ladder-kind select').inputValue(),
    );
    check(
      'Et l’unité qui va avec',
      (await carte.locator('.ladder-kind-unit').textContent()) === 'km',
      await carte.locator('.ladder-kind-unit').textContent(),
    );

    // Le trou le plus coûteux : sans unité sur les actions, un palier
    // « 100 km » reste à 0/100 quoi qu'on coche.
    await cp.getByRole('button', { name: 'Accueil' }).click();
    await cp.waitForSelector('.checkin-chips');
    const bloc = cp.locator('.today-goal', { hasText: 'Traverser la France à pied' });
    const montants = await bloc.locator('.checkin-amount').allTextContents();
    check(
      'Les actions de l’objectif portent son unité — sans quoi rien ne monterait',
      montants.length >= 2 && montants.every((m) => m.includes('km')),
      montants.join(' | '),
    );

    // Un palier ajouté ensuite hérite, sans rien demander.
    await cp.getByRole('button', { name: 'Objectifs' }).click();
    await cp.waitForSelector('.goal');
    await carte.locator('.ladder-add input').fill('Courir 100 km');
    await carte.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await cp.waitForTimeout(500);
    const ajoute = carte.locator('.tier', { hasText: 'Courir 100 km' });
    const jauge = await ajoute.locator('.meter-count').textContent();
    check(
      'Un palier ajouté ensuite hérite de la nature et lit sa cible',
      /100\s*km/.test(jauge ?? ''),
      jauge?.replace(/\s+/g, ' ') ?? 'aucune jauge',
    );

    // Intercaler une étape au milieu — le geste qui produisait une échelle
    // descendante quand il fallait « ajouter à la fin puis remonter ».
    const portes = carte.locator('.ladder-insert');
    check('Une porte d’insertion par palier', (await portes.count()) === 4, String(await portes.count()));
    await portes.nth(1).click();
    await cp.waitForSelector('.ladder-insert-bar input');
    await cp.locator('.ladder-insert-bar input').fill('Courir 40 km');
    await cp.locator('.ladder-insert-bar input').press('Enter');
    await cp.waitForTimeout(900);
    const titres = await carte.locator('.tier .tier-title').allTextContents();
    check(
      'L’étape se glisse à la place choisie, pas à la fin',
      titres[1] === 'Courir 40 km',
      titres.join(' | '),
    );
    const badges = await carte
      .locator('.tier .rank-badge')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    const echelle = ['Fer', 'Bronze', 'Argent', 'Or', 'Platine', 'Émeraude', 'Diamant', 'Maître',
      'Grand Maître', 'Challenger'];
    const rangs = badges.map((v) => echelle.indexOf(v ?? ''));
    check(
      'Et l’échelle des rangs ne redescend jamais',
      rangs.every((r, i) => i === 0 || r >= rangs[i - 1]),
      badges.join(' | '),
    );
    await fresh.close();
  }

  // --- Les PP servent enfin à quelque chose --------------------------------
  {
    const fresh = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    const pp = await fresh.newPage();
    pp.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(pp, BASE);
    await pp.waitForSelector('.onboarding-card');
    await pp.getByRole('button', { name: 'Passer' }).click();
    await pp.waitForSelector('.brand');
    await pp.getByRole('button', { name: 'Charger des exemples' }).click();
    await pp.waitForSelector('.hub');

    check(
      'Les PP se comptent à la semaine, et à un seul endroit',
      (await pp.locator('.week-label').first().textContent()) === 'PP gagnés' &&
        (await pp.locator('.stat-pp').count()) === 0,
      (await pp.locator('.week-label').first().textContent()) ?? '?',
    );
    // Tous les accesseurs Playwright (`textContent`, `isDisabled`, `evaluate`…)
    // attendent l'élément 30 s avant de lever, et cette exception tue le
    // fichier entier au lieu de nommer un échec — c'est ce qui avait masqué le
    // bug du dimanche pendant des semaines. Le bouton de gel est justement ce
    // qu'on vient de rendre conditionnel : toute lecture passe donc par ce
    // garde, qui rend `null` sur absence au lieu de bloquer.
    const lireBouton = async () => {
      const loc = pp.locator('.buy-freeze');
      if ((await loc.count()) !== 1) return null;
      return {
        texte: (await loc.textContent()) ?? '',
        classe: (await loc.getAttribute('class')) ?? '',
        inactif: await loc.isDisabled(),
        jauge: await loc.evaluate((el) => el.style.getPropertyValue('--freeze-fill')),
      };
    };

    {
      // La boutique reste visible hors de portée : c'est sa jauge qui apprend
      // à quoi servent les PP. Cachée jusqu'aux 200 PP, elle n'était trouvée
      // que par ceux qui avaient déjà de quoi payer.
      const b = await lireBouton();
      check(
        'La boutique reste visible même hors de portée',
        b !== null && b.inactif,
        b === null ? 'bouton absent' : b.texte,
      );
      check(
        'Et elle affiche le chemin qui reste, pas seulement le prix',
        b !== null && /\d+\/200/.test(b.texte),
        b === null ? 'bouton absent' : b.texte,
      );
      // La jauge doit valoir le solde, pas un décor : on la compare au solde
      // affiché juste à côté.
      const solde = Number(
        ((await pp.locator('.week-pp').textContent()) ?? '0').replace(/[^0-9]/g, ''),
      );
      const attendu = Math.max(0, Math.min(100, Math.round((solde / 200) * 100)));
      check(
        'La jauge du bouton vaut le solde de la semaine',
        b !== null && b.jauge === `${attendu}%`,
        b === null ? 'bouton absent' : `solde ${solde} PP → jauge ${b.jauge}, attendu ${attendu}%`,
      );
    }

    // Le halo de l'anneau terminé était tranché net au bord du viewport SVG.
    check(
      'Le halo de l’anneau n’est pas rogné par la boîte du SVG',
      (await pp.locator('.ring-wrap svg').evaluate((el) => getComputedStyle(el).overflow)) ===
        'visible',
      await pp.locator('.ring-wrap svg').evaluate((el) => getComputedStyle(el).overflow),
    );

    // Une grosse semaine : de quoi s'offrir un gel.
    await pp.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('palier.v1'));
      const d = new Date();
      const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      snap.checkins = [
        { id: 'pp1', goalId: snap.goals[0].id, actionId: null, pp: 300, day: jour, note: '',
          createdAt: new Date().toISOString(), value: null, title: 'grosse semaine' },
      ];
      localStorage.setItem('palier.v1', JSON.stringify(snap));
    });
    await reloadZenith(pp);
    await pp.waitForSelector('.hub');
    await pp.waitForTimeout(500);

    check(
      'Le solde de la semaine est celui qu’on dépense',
      (await pp.locator('.week-pp').textContent())?.replace(/[^0-9]/g, '') === '300',
      await pp.locator('.week-pp').textContent(),
    );
    {
      const b = await lireBouton();
      check(
        'Le bouton s’active quand le solde couvre le prix',
        b !== null && !b.inactif && !b.classe.includes('is-short'),
        b === null ? 'bouton absent' : b.classe,
      );
      check(
        'Et le bouton annonce ce qu’il reste',
        b !== null && /sur 300/.test(b.texte),
        b === null ? 'bouton absent' : b.texte,
      );
    }

    await pp.locator('.buy-freeze').click();
    await pp.waitForTimeout(1000);
    check(
      'L’achat crédite la réserve',
      (await pp.locator('.freeze').textContent()) === '❄×1',
      (await pp.locator('.freeze').textContent()) ?? 'aucun',
    );
    {
      const b = await lireBouton();
      check(
        'Et le solde dépensé rend le bouton inactif, sans le faire disparaître',
        b !== null && b.inactif,
        b === null ? 'bouton absent' : b.texte,
      );
      // 300 PP gagnés moins 200 dépensés : la jauge doit retomber à la moitié.
      // C'est la seule mesure de jauge à une valeur ni 0 ni 100 — sans elle,
      // une jauge figée à zéro passerait toutes les vérifications.
      check(
        'La jauge retombe à la moitié après la dépense',
        b !== null && b.jauge === '50%',
        b === null ? 'bouton absent' : b.jauge,
      );
    }
    // Journalisé, pas compté dans un solde : il survit au rechargement.
    await reloadZenith(pp);
    await pp.waitForSelector('.hub');
    await pp.waitForTimeout(400);
    check(
      'Le gel acheté survit au rechargement',
      (await pp.locator('.freeze').textContent()) === '❄×1',
      (await pp.locator('.freeze').textContent()) ?? 'aucun',
    );
    await fresh.close();
  }

  // --- L'accompagnement crée un objectif qui peut réellement avancer --------
  {
    // Le modèle « Sport » compte ses paliers en kilomètres. Ses actions
    // portent donc des kilomètres — et l'accompagnement les jetait, ne laissant
    // que les actions génériques de repli, sans unité : le premier objectif de
    // chaque nouveau venu restait bloqué à 0 / 5 km pour toujours. Ce bloc
    // termine le parcours pour de bon (les autres le « Passent ») et vérifie
    // qu'une action fait bouger le palier.
    const fresh = await browser.newContext({ viewport: { width: 1200, height: 950 } });
    const ob = await fresh.newPage();
    ob.on('pageerror', (e) => errors.push(e.message));
    await gotoZenith(ob, BASE);
    await ob.waitForSelector('.onboarding-card');
    for (let i = 0; i < 3; i++) await ob.getByRole('button', { name: 'Suivant' }).click();
    await ob.getByRole('button', { name: 'Créer et commencer' }).click();
    await ob.waitForSelector('.hub');
    await ob.waitForTimeout(600);

    const gestes = (await ob.locator('.hub button').allTextContents()).map((t) => t.trim());
    check(
      'L’objectif de départ hérite des actions de son modèle',
      gestes.some((t) => /Sortie course/.test(t)),
      gestes.filter((t) => /Sortie|effort|petit pas/i.test(t)).join(' | ') || 'aucune action',
    );
    check(
      'Et pas des actions génériques, qui ne portent aucune unité',
      !gestes.some((t) => /Un vrai effort/.test(t)),
      gestes.filter((t) => /effort|petit pas/i.test(t)).join(' | ') || 'aucune',
    );

    // La preuve par le geste : cocher doit faire monter le palier en km.
    const petite = ob.getByRole('button', { name: /Sortie de 15 min/ }).first();
    if ((await petite.count()) === 0) {
      check('Une action du modèle est cochable depuis l’accueil', false, 'action introuvable');
    } else {
      await petite.click();
      await ob.waitForTimeout(900);
      await ob.getByRole('button', { name: 'Objectifs' }).click();
      await ob.waitForSelector('.goal');
      // La carte est déjà dépliée : l'accompagnement ajoute l'objectif créé à
      // `expanded`. Cliquer l'en-tête la refermerait, et `.ladder` disparu,
      // toute lecture suivante attendrait 30 s avant de tuer le fichier — au
      // lieu de nommer un échec. On n'ouvre donc que si c'est nécessaire, et
      // on lit à travers un garde.
      const echelle = ob.locator('.ladder');
      if ((await echelle.count()) === 0) {
        await ob.locator('.goal').first().locator('.goal-head').click();
        await ob.waitForTimeout(400);
      }
      const compteur = ob.locator('.meter-count').first();
      const lu = (await compteur.count()) === 0 ? null : await compteur.textContent();
      const propre = (lu ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      check(
        'Cocher une action fait monter le palier, en kilomètres',
        /\b2\b\s*\/\s*5\s*km/.test(propre),
        lu === null ? 'aucun compteur lisible' : propre,
      );
    }
    await fresh.close();
  }

  check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

  await context.close();
}
