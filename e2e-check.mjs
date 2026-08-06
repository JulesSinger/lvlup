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
await page.getByRole('button', { name: '+ Objectif' }).click();
await page.waitForSelector('.picker-grid');
check(
  'Bibliothèque de modèles ouverte',
  (await page.locator('.picker-card').count()) >= 2,
  String(await page.locator('.picker-card').count()),
);
check(
  'Huit catégories proposées',
  (await page.locator('.picker-tab').count()) === 8,
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
  (await page.locator('.checkin-chip').count()) === 6,
  String(await page.locator('.checkin-chip').count()),
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
await page.locator('.action-row').first().locator('.btn-ghost').first().click();
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

// --- Réglages ---------------------------------------------------------
await page.getByRole('button', { name: 'Réglages' }).click();
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
  await authPage.getByRole('button', { name: 'Se connecter' }).first().click();
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

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
