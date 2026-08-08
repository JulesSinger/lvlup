/**
 * Vérification de bout en bout du parcours principal, exécutée sur le build de
 * production servi par `npm run preview`.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const results = [];

function check(label, condition, detail = '') {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Referme les cérémonies de célébration (elles peuvent s'enchaîner :
 * palier validé puis montée de rang du profil).
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

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE);

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
  'PP du profil cumulés (Bronze 50 + Argent 75 = 125)',
  (await page.locator('.stat-pp').textContent()) === '125',
  await page.locator('.stat-pp').textContent(),
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
await page.locator('.ladder-add select').selectOption('maitre');
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.waitForTimeout(300);
check('Palier ajouté', (await page.locator('.goal-count').first().textContent())?.includes('2/6'));

// 4. Persistance après rechargement (retour sur le hub par défaut)
await page.reload();
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
  'Courbe des PP tracée (aire + ligne)',
  (await page.locator('.chart-wrap svg path').count()) === 2,
  String(await page.locator('.chart-wrap svg path').count()),
);
check(
  'Étiquette de fin = total des PP',
  (await page.locator('.chart-endlabel').textContent()) === '125',
  await page.locator('.chart-endlabel').textContent(),
);
// Régression : si la graduation haute est sous le maximum, le dernier point
// et son étiquette sortent du cadre par le haut.
{
  const label = await page.locator('.chart-endlabel').boundingBox();
  const svg = await page.locator('.chart-wrap svg').boundingBox();
  check(
    'Étiquette de fin à l’intérieur du cadre',
    label.y >= svg.y && label.y + label.height <= svg.y + svg.height,
    `label ${Math.round(label.y)}–${Math.round(label.y + label.height)} / svg ${Math.round(svg.y)}–${Math.round(svg.y + svg.height)}`,
  );
}
await page.locator('.chart-wrap svg').hover();
await page.waitForTimeout(200);
check('Infobulle au survol de la courbe', await page.locator('.chart-tooltip').isVisible());
await page.getByRole('button', { name: 'Voir le tableau' }).click();
await page.waitForSelector('.chart-table');
check(
  'Vue tableau : les valeurs sont lisibles sans survol',
  (await page.locator('.chart-table tbody tr').count()) >= 1,
  String(await page.locator('.chart-table tbody tr').count()),
);
await page.getByRole('button', { name: 'Voir la courbe' }).click();
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
await page.reload();
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
await page.reload();
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

// PWA : manifest et service worker servis
check('Manifest PWA lié dans la page', (await page.locator('link[rel="manifest"]').count()) === 1);
check('manifest.webmanifest servi', (await page.request.get(`${BASE}/manifest.webmanifest`)).ok());
check('Service worker servi', (await page.request.get(`${BASE}/sw.js`)).ok());
check('Icône 192 servie', (await page.request.get(`${BASE}/icons/icon-192.png`)).ok());

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
await riskPage.goto(BASE);
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
await riskPage.reload();
await riskPage.waitForSelector('.hub');
check(
  "Bannière « streak en jeu » quand rien n'est fait aujourd'hui",
  await riskPage.locator('.streak-banner').isVisible(),
);
await riskCtx.close();

const mobile = await page.context().newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(BASE);
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

// --- Service worker : les rappels reposent sur ces gestionnaires ---------
{
  const sw = await (await fetch(`${BASE}/sw.js`)).text();
  check(
    "Le service worker écoute l'arrivée d'une notification",
    sw.includes("addEventListener('push'"),
  );
  check(
    'Un clic sur la notification ramène vers l’app',
    sw.includes("addEventListener('notificationclick'"),
  );
  check('Une notification est toujours affichée (exigence iOS)', sw.includes('showNotification'));
}

// Écran d'authentification : il n'apparaît qu'en mode Supabase, on le vérifie
// donc sur un build de démonstration servi séparément si disponible.
if (process.env.AUTH_BASE) {
  const authPage = await context.newPage();
  await authPage.goto(process.env.AUTH_BASE);

  // Chaque bouton de la présentation doit ouvrir le formulaire qu'il annonce.
  // « Créer mon compte » qui tombait sur la connexion obligeait à recliquer
  // sur « En créer un » — sur le tout premier écran, avant même le compte.
  await authPage.waitForSelector('.lp-hero');
  for (const [libelle, attendu] of [
    ['Créer mon compte', 'Créer mon compte'],
    ['Commencer — c’est gratuit', 'Créer mon compte'],
    ['Se connecter', 'Se connecter'],
  ]) {
    await authPage
      .getByRole('button', { name: libelle.replace('’', "'"), exact: true })
      .first()
      .click();
    await authPage.waitForSelector('.auth-card');
    check(
      `« ${libelle} » ouvre le bon formulaire`,
      (await authPage.locator('.auth-card .btn-primary').textContent()) === attendu,
      await authPage.locator('.auth-card .btn-primary').textContent(),
    );
    await authPage.getByRole('button', { name: 'Revenir à la présentation' }).click();
    await authPage.waitForSelector('.lp-hero');
  }
  // L'appel final en bas de page mène là aussi à l'inscription.
  await authPage.locator('.lp-final .lp-cta').click();
  await authPage.waitForSelector('.auth-card');
  check(
    'L’appel final de la page mène aussi à l’inscription',
    (await authPage.locator('.auth-card .btn-primary').textContent()) === 'Créer mon compte',
    await authPage.locator('.auth-card .btn-primary').textContent(),
  );
  check(
    'Le champ mot de passe demande d’en choisir un, pas d’en retrouver un',
    (await authPage.locator('#password').getAttribute('autocomplete')) === 'new-password',
    await authPage.locator('#password').getAttribute('autocomplete'),
  );
  await authPage.getByRole('button', { name: 'Se connecter' }).click();
  await authPage.waitForTimeout(150);
  check(
    'Depuis l’inscription, on rejoint la connexion sans repasser par la présentation',
    (await authPage.locator('.auth-card .btn-primary').textContent()) === 'Se connecter',
    await authPage.locator('.auth-card .btn-primary').textContent(),
  );
  await authPage.waitForSelector('#password');
  check(
    'Mot de passe masqué par défaut',
    (await authPage.locator('#password').getAttribute('type')) === 'password',
  );
  await authPage.locator('.password-toggle').click();
  check(
    'Le bouton œil rend le mot de passe visible',
    (await authPage.locator('#password').getAttribute('type')) === 'text',
    await authPage.locator('#password').getAttribute('type'),
  );
  // Le bouton doit être DANS le champ : sans positionnement il retombait
  // dessous, à l'air libre, et ne ressemblait plus à rien.
  {
    const placement = await authPage.evaluate(() => {
      const input = document.querySelector('#password').getBoundingClientRect();
      const eye = document.querySelector('.password-toggle').getBoundingClientRect();
      return {
        dedans:
          eye.top >= input.top - 1 &&
          eye.bottom <= input.bottom + 1 &&
          eye.right <= input.right + 1 &&
          eye.left > input.left,
        ecart: Math.round(eye.top - input.top),
      };
    });
    check(
      "L'œil est posé dans le champ, pas en dessous",
      placement.dedans,
      `décalage vertical ${placement.ecart}px`,
    );
  }

  // Mot de passe oublié : accessible depuis la connexion, demande l'adresse
  // seule, et sait revenir en arrière.
  await authPage.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await authPage.waitForTimeout(200);
  check(
    'Le mot de passe oublié masque le champ mot de passe',
    (await authPage.locator('#password').count()) === 0,
  );
  check(
    'Le bouton d’envoi du lien est proposé',
    await authPage.getByRole('button', { name: 'Envoyer le lien' }).isVisible(),
  );
  await authPage.getByRole('button', { name: 'Revenir à la connexion' }).click();
  await authPage.waitForTimeout(200);
  check('On peut revenir à la connexion', (await authPage.locator('#password').count()) === 1);
  await authPage.close();
}

// --- Revenir sur les jours précédents ----------------------------------
// Contexte neuf : ce bloc dépend de l'ancienneté des objectifs, on ne veut pas
// polluer l'état des vérifications précédentes.
{
  const fresh = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  const rp = await fresh.newPage();
  rp.on('pageerror', (e) => errors.push(e.message));
  await rp.goto(BASE);
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
  await rp.reload();
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

  await rp.reload();
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
  await cp.goto(BASE);
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
  await cp.reload();
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
  await qp.goto(BASE);
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
  await qp.reload();
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
  await lp.goto(BASE);
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
    const widths = await lp.locator('.draft-tier input').evaluateAll((els) =>
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
  await rp.goto(BASE);
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
  await rp.reload();
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
  await pp.goto(BASE);
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
  await hp.goto(BASE);
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
    const mk = (id, title, targets, allDone, gapYesterday) => {
      const g = { id, title, description: '', emoji: '💅', position: 0, archived: false, createdAt: old,
        tiers: targets.map((t, i) => ({ id: id + 't' + i, goalId: id, title: `${t} jours réussis`,
          rank: ['bronze','argent','or'][i], position: i,
          completedAt: allDone || i === 0 ? old : null, createdAt: old,
          kind: 'compte', target: t, unit: 'jours', direction: 'hausse', mode: 'absolu', sources: [] })) };
      const a = { id: id + 'a', goalId: id, title: 'Journée tenue', pp: 10, position: 0,
        archived: false, createdAt: old, unit: '', defaultValue: null, isMeasure: false };
      const ck = [];
      for (let n = 60; n >= (gapYesterday ? 2 : 0); n -= 2) {
        ck.push({ id: id + 'c' + n, goalId: id, actionId: a.id, pp: 10, day: day(n), note: '',
          createdAt: `${day(n)}T20:00:00.000Z`, value: null });
      }
      return { g, a, ck };
    };
    const A = mk('hb1', 'Arrêter de me ronger les ongles', [7, 30, 90], false, false);
    const B = mk('hb2', 'Méditer tous les jours', [7, 30, 90], true, false);
    const C = mk('hb3', 'Arrêter de me craquer les doigts', [7, 30, 90], false, true);
    snap.goals = [A.g, B.g, C.g];
    snap.actions = [A.a, B.a, C.a];
    snap.checkins = [...A.ck, ...B.ck, ...C.ck];
    localStorage.setItem('palier.v1', JSON.stringify(snap));
  });
  await hp.reload();
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
  check(
    'Rien n’est dessiné avant la création de l’objectif',
    (await hp.locator('.heat').first().locator('.heat-cell.ghost').count()) > 0,
  );
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
  await fresh.close();
}

// --- Filtrer la grille par action ----------------------------------------
// La grille entière répond à « est-ce que je m'y suis mis ». Le filtre répond
// à « laquelle de mes trois actions je ne fais jamais ».
{
  const fresh = await browser.newContext({ viewport: { width: 1180, height: 950 } });
  const fp = await fresh.newPage();
  fp.on('pageerror', (e) => errors.push(e.message));
  await fp.goto(BASE);
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
    ];
    // 4 sorties longues, 20 sorties courses, jamais de renforcement.
    const ck = [];
    for (let i = 0; i < 4; i++) ck.push({ id: 'l' + i, goalId: 'fg', actionId: 'fa1', pp: 20, day: day(3 + i * 14), note: '', createdAt: `${day(3 + i * 14)}T09:00:00.000Z`, value: 12 });
    for (let i = 0; i < 20; i++) ck.push({ id: 'c' + i, goalId: 'fg', actionId: 'fa2', pp: 15, day: day(2 + i * 3), note: '', createdAt: `${day(2 + i * 3)}T09:00:00.000Z`, value: 6 });
    snap.goals = [g]; snap.actions = acts; snap.checkins = ck;
    localStorage.setItem('palier.v1', JSON.stringify(snap));
  });
  await fp.reload();
  await fp.waitForSelector('.hub');
  await fp.getByRole('button', { name: 'Objectifs' }).click();
  await fp.waitForSelector('.heat');
  await fp.waitForTimeout(700);

  check(
    'Un objectif à plusieurs actions propose de filtrer',
    (await fp.locator('.heat-chip').count()) === 4,
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

  await op.goto(BASE);
  await op.waitForSelector('.onboarding-card');
  check('Première visite : l’accompagnement s’affiche', await op.locator('.onboarding-card').isVisible());
  await op.getByRole('button', { name: 'Passer' }).click();
  await op.waitForSelector('.empty');
  check(
    'Le passer écrit un marqueur portant l’identifiant de l’utilisateur',
    (await op.evaluate(() => localStorage.getItem('zenith.onboarded.local'))) === '1',
    await op.evaluate(() => JSON.stringify(Object.keys(localStorage).filter((k) => k.startsWith('zenith.onboarded')))),
  );
  await op.reload();
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
  await op.reload();
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
  await op.reload();
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

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
