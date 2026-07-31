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
await page.waitForSelector('.brand');

// 1. Écran vide (sur le hub) puis chargement des exemples
check('Écran vide affiché', await page.locator('.empty h3').isVisible());
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

// 5. Historique
await page.getByRole('button', { name: 'Historique' }).click();
await page.waitForSelector('.entry');
check('Historique daté alimenté', (await page.locator('.entry').count()) === 2);
await page.screenshot({ path: 'screens/historique.png', fullPage: true });

// 6. Création d'un objectif avec un nombre de paliers différent
await page.getByRole('button', { name: 'Objectifs' }).click();
await page.getByRole('button', { name: '+ Objectif' }).click();
await page.waitForSelector('.modal');
await page.locator('#goal-title').fill('Apprendre la guitare');
await page.locator('#goal-desc').fill('Jouer devant des amis sans trembler.');
const draftInputs = page.locator('.draft-tier input');
await draftInputs.nth(0).fill('Faire sonner un accord propre');
await draftInputs.nth(1).fill('Enchaîner 4 accords');
await draftInputs.nth(2).fill('Jouer un morceau entier');
// Les deux derniers paliers restent vides : ils doivent être ignorés.
await page.locator('.draft-tier select').nth(0).selectOption('fer');
await page.screenshot({ path: 'screens/creation.png' });
await page.getByRole('button', { name: "Créer l'objectif" }).click();
await page.waitForTimeout(400);
check('4e objectif créé', (await page.locator('.goal').count()) === 4);
check(
  'Paliers vides ignorés (3 paliers retenus sur 5 champs)',
  (await page.locator('.goal').nth(3).locator('.goal-count').textContent())?.includes('0/3'),
  await page.locator('.goal').nth(3).locator('.goal-count').textContent(),
);

// 7. Modification d'un objectif
await page.locator('.goal').nth(3).locator('.goal-actions button').first().click();
await page.waitForSelector('.modal');
await page.locator('#goal-title').fill('Apprendre la guitare folk');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.waitForTimeout(300);
check(
  'Objectif renommé',
  (await page.locator('.goal').nth(3).locator('.goal-title').textContent()) ===
    'Apprendre la guitare folk',
);

// 8. Suppression
page.once('dialog', (d) => d.accept());
await page.locator('.goal').nth(3).locator('.goal-actions button').nth(1).click();
await page.waitForTimeout(400);
check('Objectif supprimé', (await page.locator('.goal').count()) === 3);

// 9. Check-in quotidien, streak et trophées
await page.getByRole('button', { name: 'Accueil' }).click();
await page.waitForSelector('.checkin-chips');
check(
  'Section check-in affichée avec un chip par objectif',
  (await page.locator('.checkin-chip').count()) === 3,
  String(await page.locator('.checkin-chip').count()),
);
check(
  'Streak à 1 (les validations du jour comptent)',
  ((await page.locator('.stat-streak').textContent()) ?? '').includes('1'),
  await page.locator('.stat-streak').textContent(),
);
await page.locator('.checkin-chip').first().click();
await page.waitForSelector('.ceremony');
check(
  'Trophée « Premier pas » célébré au premier check-in',
  (await page.locator('.ceremony-rank').textContent()) === 'Premier pas',
  await page.locator('.ceremony-rank').textContent(),
);
await dismissCeremonies(page);
await page.waitForTimeout(1100);
check('Check-in marqué comme fait', await page.locator('.checkin-chip.done').isVisible());
check(
  'PP passés à 135 (+10 du check-in)',
  (await page.locator('.stat-pp').textContent()) === '135',
  await page.locator('.stat-pp').textContent(),
);

// Note libre optionnelle : l'éditeur s'ouvre après le check-in
check('Éditeur de note ouvert après le check-in', await page.locator('.checkin-note input').isVisible());
await page.locator('.checkin-note input').fill('8 km ce matin, dur mais fait');
await page.locator('.checkin-note input').press('Enter');
await page.waitForTimeout(400);
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
  'Récap « Cette semaine » : 1 check-in',
  (await page.locator('.week-stats > div').nth(1).locator('.week-value').textContent()) === '1',
  await page.locator('.week-stats > div').nth(1).locator('.week-value').textContent(),
);

// Persistance du check-in après rechargement
await page.reload();
await page.waitForSelector('.checkin-chips');
check(
  'Check-in persistant après rechargement',
  (await page.locator('.checkin-chip.done').count()) === 1,
);

// Annulation : re-cliquer le chip rend les PP
await page.locator('.checkin-chip.done').click();
await page.waitForTimeout(1200);
check(
  "Annulation du check-in : les PP retombent à 125",
  (await page.locator('.stat-pp').textContent()) === '125',
  await page.locator('.stat-pp').textContent(),
);

// Salle des trophées
await page.getByRole('button', { name: 'Trophées' }).click();
await page.waitForSelector('.trophy-grid');
check('12 trophées listés', (await page.locator('.trophy').count()) === 12, String(await page.locator('.trophy').count()));
check(
  '2 trophées débloqués (Premier sang, Stratège)',
  (await page.locator('.trophy.unlocked').count()) === 2,
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
await mobile.getByRole('button', { name: 'Objectifs' }).click();
await mobile.waitForSelector('.goal');
await mobile.locator('.goal-head').first().click();
await mobile.waitForTimeout(200);
await mobile.screenshot({ path: 'screens/mobile.png', fullPage: true });
check('Rendu mobile sans débordement horizontal', await mobile.evaluate(
  () => document.documentElement.scrollWidth <= window.innerWidth + 1,
));

check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
