/**
 * Suite e2e du module Sport.
 *
 * Étape 3 (docs/etude-sport.md §12) : l'écran vide, une sortie notée à la
 * main, sa fiche et sa correction, la fréquence cardiaque et ses zones, la
 * reprise d'une archive Strava (un vrai zip fabriqué ici, avec un GPX
 * compressé), le tableau de bord, les records, la suppression, le téléphone.
 */
import { gzipSync, strToU8, zipSync } from 'fflate';

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Une date à la façon de l'archive Strava, `n` jours avant aujourd'hui, à 7 h UTC. */
const stravaDate = (n) => {
  const d = new Date(Date.now() - n * 86_400_000);
  return `"${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, 7:00:00 AM"`;
};
const isoAt = (n, minutes) => {
  const d = new Date(Date.now() - n * 86_400_000);
  d.setUTCHours(7, minutes, 0, 0);
  return d.toISOString();
};

/** Un GPX de 2 km en ligne droite le long de l'équateur, 5:00 au kilomètre. */
const DEG_PER_KM = 360 / (2 * Math.PI * 6371);
const gpx = (n) =>
  `<gpx><trk><trkseg>${[0, 1, 2]
    .map((k) => `<trkpt lat="0" lon="${k * DEG_PER_KM}"><time>${isoAt(n, k * 5)}</time><extensions><hr>${140 + k * 5}</hr></extensions></trkpt>`)
    .join('')}</trkseg></trk></gpx>`;

/** Un jour local, `n` jours après aujourd'hui, au format d'un champ date. */
const localDay = (n) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function archive() {
  const csv = [
    'Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Max Heart Rate,Filename,Elapsed Time,Moving Time,Distance,Average Heart Rate,Elevation Gain,Workout Type',
    `9001,${stravaDate(20)},Dix bornes,Run,3000,10.0,182,,3000,3000,10000,165,40,`,
    `9002,${stravaDate(12)},Avec tracé,Run,600,2.0,150,activities/9002.gpx.gz,600,600,2000,,10,`,
    `9003,${stravaDate(8)},Vélotaf,Ride,1800,12.0,,,1800,1800,12000,,,`,
    `9004,${stravaDate(5)},Footing du lac,Run,2700,8.0,160,,2700,2700,8000,145,60,`,
  ].join('\n');
  return Buffer.from(
    zipSync({
      'export_42/activities.csv': strToU8(csv),
      'export_42/activities/9002.gpx.gz': gzipSync(strToU8(gpx(12))),
    }),
  );
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await toHub(page);

  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Sport' });
  check('La carte Sport apparaît sur l’écran de choix', await card.isVisible());
  await card.click();
  await page.waitForSelector('.sport-empty');
  check('Sans sortie, Sport propose de reprendre l’historique, de relier la montre ou de noter une sortie', (await page.locator('.sport-empty button').count()) === 3);
  check('L’adresse dit le module ouvert', page.url().endsWith('#/sport'));
  check('Le lien avec Objectifs se choisit dès l’écran vide', await page.locator('.sport-empty .sport-objectifs').isVisible());

  const modal = page.locator('.sport-modal');

  // --- Noter une sortie à la main ------------------------------------------------
  await page.getByRole('button', { name: 'Noter une sortie' }).click();
  await page.waitForSelector('.sport-modal');
  await modal.getByRole('button', { name: 'Ajouter', exact: true }).click();
  check('Une sortie sans distance est refusée, avec la raison', (await text(page.locator('.sport-error'))).includes('distance'));
  await page.locator('#sport-run-km').fill('10,2');
  await page.locator('#sport-run-duration').fill('52:30');
  await page.locator('#sport-run-avghr').fill('148');
  await page.locator('#sport-run-maxhr').fill('171');
  await page.locator('#sport-run-title').fill('Tour du lac');
  await modal.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForSelector('.sport-dash');
  check('La sortie compte dans la semaine', (await text(page.locator('.sport-week .sport-stat').first())).includes('10,2 km'));
  check('Elle est la dernière sortie', (await text(page.locator('.sport-run').first())).includes('Tour du lac'));
  check('Avec son allure, calculée', (await text(page.locator('.sport-run').first())).includes('5:09 /km'));

  // --- La fiche, et la corriger ---------------------------------------------------
  await page.locator('.sport-run').first().click();
  await page.waitForSelector('.sport-modal .sport-stats');
  check('La fiche dit distance, durée, allure et FC', (await text(modal.locator('.sport-stats'))).includes('148 bpm'));
  await modal.getByRole('button', { name: 'Modifier' }).click();
  await page.locator('#sport-run-kind').selectOption('seuil');
  await page.locator('#sport-run-effort').selectOption('7');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.sport-modal .sport-sheet-date');
  check('Corriger la sorte se voit aussitôt', (await text(modal.locator('.sport-sheet-date'))).includes('Seuil'));
  check('Et le ressenti', (await text(modal.locator('.sport-stats'))).includes('7 / 10'));
  await modal.getByRole('button', { name: 'Fermer' }).click();

  // --- La fréquence cardiaque -----------------------------------------------------
  check(
    'Sans FC max, pas encore de zones, mais la plus haute vue est proposée',
    (await page.locator('.sport-zone').count()) === 0 && (await text(page.locator('.sport-hr'))).includes('171'),
  );
  await page.getByRole('button', { name: 'La reprendre' }).click();
  await page.getByLabel('FC de repos').fill('50');
  await page.locator('.sport-hr').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(300);
  check('Les cinq zones de Karvonen apparaissent', (await page.locator('.sport-zone').count()) === 5);
  check('Zone 2 de 123 à 134 pour 171 et 50', (await text(page.locator('.sport-zone-2'))).includes('123–134'), await text(page.locator('.sport-zone-2')));
  await page.getByLabel('FC de repos').fill('190');
  await page.locator('.sport-hr').getByRole('button', { name: 'Enregistrer' }).click();
  check('Une FC de repos au-dessus du maximum est refusée', (await text(page.locator('.sport-hr .sport-error'))).includes('repos'));
  await page.getByLabel('FC de repos').fill('50');

  // --- Reprendre l'archive Strava ---------------------------------------------------
  await page.getByRole('button', { name: 'Reprendre l’historique Strava' }).first().click();
  await page.waitForSelector('.sport-file');
  await page.getByLabel('Archive Strava').setInputFiles({ name: 'export_42.zip', mimeType: 'application/zip', buffer: archive() });
  await page.waitForSelector('.sport-import-preview');
  const preview = await text(page.locator('.sport-import-preview'));
  check('L’aperçu compte les courses à ajouter, avant d’écrire', preview.includes('3 courses à ajouter'), preview);
  check('Il dit le vélo laissé de côté', preview.includes('1 autre activité'), preview);
  check('Et la sortie complétée par son tracé', preview.includes('1 avec leurs temps au kilomètre'), preview);
  await page.getByRole('button', { name: 'Importer 3 sorties' }).click();
  await page.waitForSelector('.sport-import-done');
  check('L’import dit ce qu’il a ajouté', (await text(page.locator('.sport-import-done'))).includes('3 sorties ajoutées'));
  await modal.getByRole('button', { name: 'Fermer', exact: true }).last().click();

  await page.getByRole('button', { name: 'Reprendre l’historique Strava' }).first().click();
  await page.getByLabel('Archive Strava').setInputFiles({ name: 'export_42.zip', mimeType: 'application/zip', buffer: archive() });
  await page.waitForSelector('.sport-import-preview');
  const again = await text(page.locator('.sport-import-preview'));
  check('La même archive une seconde fois n’ajoute rien', again.includes('0 course à ajouter') && again.includes('3 déjà dans Sport'), again);
  check('Et le bouton d’import est inactif', await page.getByRole('button', { name: 'Importer 0 sortie' }).isDisabled());
  await page.getByRole('button', { name: 'Annuler' }).click();

  // --- Le tableau de bord et les records -------------------------------------------------
  const records = await text(page.locator('.sport-records'));
  check('Le 10 km de l’archive devient un record', records.includes('10 km') && records.includes('50:00'), records);
  const prediction = await text(page.locator('.sport-prediction').first());
  check('Une prédiction au marathon, dite comme une estimation', /≈ 3:5\d:\d\d/.test(prediction) && prediction.includes('estimation'), prediction);

  // --- Le journal -------------------------------------------------------------------------
  await page.getByRole('button', { name: /^Journal/ }).click();
  await page.waitForSelector('.sport-journal');
  check('Le journal liste les quatre sorties', (await page.locator('.sport-run').count()) === 4);
  check('Sans le vélo', (await page.locator('.sport-run', { hasText: 'Vélotaf' }).count()) === 0);
  await page.locator('.sport-run', { hasText: 'Avec tracé' }).click();
  await page.waitForSelector('.sport-splits');
  check('Une sortie avec tracé montre ses temps au kilomètre', (await page.locator('.sport-splits tbody tr').count()) === 2);
  check('Et la FC lue dans le fichier, absente du CSV', (await text(modal.locator('.sport-stats'))).includes('145 bpm'));
  page.once('dialog', (d) => d.accept());
  await modal.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(400);
  check('Supprimer une sortie la retire du journal', (await page.locator('.sport-run').count()) === 3);

  // --- Le plan marathon (étape 4) -------------------------------------------------------------
  await page.getByRole('button', { name: /^Plan/ }).click();
  await page.waitForSelector('.sport-empty');
  check('Sans plan, Sport propose d’en créer un', (await text(page.locator('.sport-empty'))).includes('Prépare ton marathon'));
  await page.getByRole('button', { name: 'Créer le plan' }).click();
  await page.waitForSelector('.sport-plan-preview');
  check('Le temps de référence est proposé d’après le meilleur 10 km récent', (await page.locator('#sport-plan-reftime').inputValue()) === '50:00', await page.locator('#sport-plan-reftime').inputValue());
  await page.locator('#sport-plan-race').fill(localDay(200));
  await page.waitForTimeout(200);
  const planPreview = await text(page.locator('.sport-plan-preview'));
  check('L’aperçu dit les semaines, les phases et le pic avant de créer', /\d+ semaines/.test(planPreview) && planPreview.includes('bloc spécifique') && planPreview.includes('Prédiction'), planPreview);
  await modal.getByRole('button', { name: 'Créer le plan' }).click();
  await page.waitForSelector('.sport-plan-head');
  const head = await text(page.locator('.sport-plan-head'));
  check('Le plan dit sa course, sa date à confirmer et le compte à rebours', head.includes('Marathon d’Annecy') && head.includes('à confirmer') && head.includes('J-200'), head);
  check('La semaine en cours a ses quatre séances', (await page.locator('.sport-plan-current .sport-session').count()) === 4);
  check('La sortie du jour s’est rattachée d’elle-même à une séance', (await page.locator('.sport-plan-current .sport-session-faite').count()) === 1);
  check('Une seule séance est marquée « prochaine »', (await page.locator('.sport-session-next').count()) === 1);
  const weeksBefore = (await page.locator('.sport-week-item').count()) + 1;

  // Modifier une séance.
  await page.locator('.sport-session-next .sport-session-body').click();
  await page.waitForSelector('#sport-session-title');
  await page.locator('#sport-session-title').fill('Footing du lac');
  await page.locator('#sport-session-km').fill('7,5');
  await page.locator('#sport-session-pacemin').fill('6:40');
  await page.locator('#sport-session-pacemax').fill('6:10');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  check('Des allures à l’envers sont refusées, avec la raison', (await text(modal.locator('.sport-error'))).includes('plus rapide'));
  await page.locator('#sport-session-pacemin').fill('6:10');
  await page.locator('#sport-session-pacemax').fill('6:40');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  // Visée par son titre : la séance modifiée peut avoir pris une sortie de la semaine (un dimanche,
  // toutes les sorties d'exemple y tombent) et n'être alors plus « la prochaine ».
  const editedSession = page.locator('.sport-plan-current .sport-session', { hasText: 'Footing du lac' });
  await editedSession.waitFor();
  const edited = await text(editedSession);
  check('La séance modifiée se voit dans la semaine', ['Footing du lac', '7,5 km', '6:10–6:40 /km'].every((t) => edited.includes(t)), edited);

  // La fiche d'une sortie dit sa séance, et permet d'en choisir une autre.
  await page.locator('.sport-plan-current .sport-session-run').first().click();
  await page.waitForSelector('#sport-run-session');
  check('La fiche d’une sortie propose sa séance du plan', (await text(page.locator('#sport-run-session option').first())).startsWith('Automatique ('));
  await modal.getByRole('button', { name: 'Fermer' }).click();

  // Changer la date de la course.
  await page.getByRole('button', { name: 'Changer la date' }).click();
  await page.locator('#sport-race-day').fill(localDay(207));
  await modal.locator('.sport-check input').check();
  await modal.getByRole('button', { name: 'Recaler le plan' }).click();
  await page.waitForTimeout(500);
  const moved = await text(page.locator('.sport-plan-head'));
  check('Une semaine plus tard : J-207, et la date n’est plus « à confirmer »', moved.includes('J-207') && !moved.includes('à confirmer'), moved);
  check('Le plan compte une semaine de plus', (await page.locator('.sport-week-item').count()) + 1 === weeksBefore + 1);

  await page.getByRole('button', { name: /^Tableau de bord/ }).click();
  const summary = await text(page.locator('.sport-plan-summary'));
  check('Le tableau de bord commence par le plan et sa prochaine séance', summary.includes('J-207') && summary.includes('Prochaine séance'), summary);
  await page.getByRole('button', { name: /^Journal/ }).click();

  // --- La progression (étape 6) ---------------------------------------------------------------
  await page.getByRole('button', { name: /^Progression/ }).click();
  await page.waitForSelector('.sport-progress');
  const volTitle = () => text(page.locator('.sport-progress-volume .sport-panel-title'));
  check('La progression s’ouvre sur trois mois, semaine par semaine', (await volTitle()).includes('par semaine') && (await page.locator('.sport-progress-bars .sport-weeks-col').count()) === 13);
  await page.getByRole('button', { name: '1 an', exact: true }).click();
  check('Sur un an, le volume se compte par mois', (await volTitle()).includes('par mois') && (await page.locator('.sport-progress-bars .sport-weeks-col').count()) === 12);
  check('L’allure des footings a sa courbe', (await page.locator('.sport-trend svg').count()) >= 1);
  check('Le temps par zone a ses cinq zones et les sorties sans FC', (await page.locator('.sport-zone-legend li').count()) === 6);
  check('La prédiction au marathon est dite comme une estimation', (await text(page.locator('.sport-panel', { hasText: 'Prédiction au marathon' }))).includes('≈'));
  const recordLine = page.locator('.sport-record-history summary').first();
  check('Le record du 10 km a son histoire', (await text(recordLine)).includes('10 km') && (await text(recordLine)).includes('50:00'), await text(recordLine));
  await recordLine.click();
  await page.locator('.sport-record-steps .sport-link').first().click();
  await page.waitForSelector('.sport-modal');
  check('Toucher un record ouvre la sortie où il est tombé', (await text(modal)).includes('10,0 km'), await text(modal));
  await modal.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: /^Journal/ }).click();

  // --- Les liens (étape 7) : Objectifs, puis Calendar ---------------------------------------------
  // Un objectif posé dans les données d'Objectifs, comme la suite de Calendar le fait pour ses
  // calques : le lien entre modules est l'objet même de l'étape. Et une coche faite à la main
  // aujourd'hui, que Sport ne doit pas toucher.
  await page.evaluate((today) => {
    const blob = JSON.parse(localStorage.getItem('palier.v1') || '{}');
    const at = '2000-01-01T12:00:00.000Z';
    blob.goals = [...(blob.goals ?? []), { id: 'g-mara', title: 'Courir un marathon', description: '', emoji: '🏃', position: 0, archived: false, createdAt: at, tiers: [] }];
    blob.actions = [...(blob.actions ?? []), { id: 'a-run', goalId: 'g-mara', title: 'Sortie course', pp: 20, position: 0, archived: false, createdAt: at, unit: 'km', defaultValue: null, isMeasure: false }];
    blob.checkins = [...(blob.checkins ?? []), { id: 'c-hand', goalId: 'g-mara', actionId: 'a-run', pp: 20, day: today, note: '', createdAt: at, value: 5, title: null }];
    localStorage.setItem('palier.v1', JSON.stringify(blob));
  }, localDay(0));
  await page.reload();
  await page.getByRole('button', { name: /^Tableau de bord/ }).click();
  await page.waitForSelector('#sport-objectifs-action');
  await page.locator('#sport-objectifs-action').selectOption({ label: 'Courir un marathon — Sortie course (km)' });
  await page.waitForFunction(() => document.querySelector('.sport-objectifs')?.textContent?.includes('Dernière mise à jour'));
  const goalCheckins = () => page.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') || '{}').checkins ?? []);
  let held = await goalCheckins();
  const bySport = held.filter((c) => c.ref?.startsWith('sport:jour:'));
  const runDays = await page.evaluate(() => [...new Set((JSON.parse(localStorage.getItem('palier.v1') || '{}').sportRuns ?? []).map((r) => r.day))]);
  check('Chaque jour couru coche l’action choisie, une fois, avec ses km', bySport.length === runDays.length - 1 && bySport.every((c) => c.actionId === 'a-run' && c.value > 0 && c.pp === 20), JSON.stringify(bySport.map((c) => [c.day, c.value])));
  check('La coche faite à la main aujourd’hui n’est pas touchée', held.some((c) => c.id === 'c-hand' && c.value === 5 && !c.ref) && !bySport.some((c) => c.day === localDay(0)));
  check('Sport le dit', (await text(page.locator('.sport-objectifs'))).includes('déjà coché à la main'), await text(page.locator('.sport-objectifs')));

  // Le calque de Sport dans Calendar : la sortie du jour, à son heure.
  await page.evaluate(() => (location.hash = '#/calendrier'));
  await page.waitForSelector('.fc-event', { timeout: 20_000 });
  await page.waitForTimeout(500);
  const calendarText = await text(page.locator('.fc'));
  check('Calendar montre la sortie du jour, au calque de Sport', /✓ [^✓]*? · \d+,\d km/.test(calendarText), calendarText.slice(0, 300));
  check('Et la semaine du plan, le lundi', calendarText.includes('🏃 Semaine 1 ·'));
  await page.evaluate(() => (location.hash = '#/sport'));
  await page.waitForSelector('#sport-objectifs-action');

  // Défaire le lien retire les coches de Sport, jamais celle faite à la main.
  await page.locator('#sport-objectifs-action').selectOption({ label: 'Aucune' });
  await page.waitForTimeout(400);
  held = await goalCheckins();
  check('Ne plus cocher retire les coches de Sport, et elles seules', !held.some((c) => c.ref) && held.some((c) => c.id === 'c-hand'));
  await page.getByRole('button', { name: /^Journal/ }).click();

  // --- Relier Strava (§21), puis l'Apple Watch (étape 5) -------------------------------------
  await page.getByRole('button', { name: 'Relier Strava' }).click();
  await page.waitForSelector('.sport-strava-intro');
  check('Sans compte, « Relier Strava » dit qu’il en faut un', (await text(page.locator('.sport-strava-local'))).includes('connecté avec un compte'));
  check('Sans compte, aucun bouton ne part chez Strava', (await page.locator('.sport-strava-connect').count()) === 0);
  await page.getByRole('button', { name: 'Relier l’Apple Watch par un raccourci' }).click();
  await page.waitForSelector('.sport-shortcut-intro');
  check('Sans compte, la fenêtre dit qu’il en faut un pour le raccourci', (await text(page.locator('.sport-shortcut-local'))).includes('connecté avec un compte'));
  check('Sans compte, aucun jeton ne se crée (il ne servirait à rien)', (await page.locator('.sport-token-new').count()) === 0);
  await modal.getByRole('button', { name: 'Fermer' }).click();

  // --- Renforcement et vélo dans le plan (12/10/2026) ----------------------------------------
  await page.getByRole('button', { name: /^Plan/ }).click();
  await page.locator('.sport-plan-current .sport-session-a-faire .sport-session-body').first().click();
  await page.waitForSelector('#sport-session-kind');
  await page.locator('#sport-session-kind').selectOption('renfo');
  check('Un renforcement n’a ni allure ni distance, mais une durée', (await page.locator('#sport-session-pacemin').count()) === 0 && (await page.locator('#sport-session-km').count()) === 0 && (await page.locator('#sport-session-duration').count()) === 1);
  await page.locator('#sport-session-title').fill('Gainage');
  await page.locator('#sport-session-duration').fill('30');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  const renfo = page.locator('.sport-plan-current .sport-session', { hasText: 'Gainage' });
  await renfo.waitFor();
  check('Le renforcement se voit dans la semaine, avec sa sorte et sa durée', (await text(renfo)).includes('Renforcement') && (await text(renfo)).includes('30 min'), await text(renfo));
  await renfo.getByRole('checkbox', { name: 'Cocher « Gainage »' }).click();
  await renfo.getByRole('checkbox', { name: 'Décocher « Gainage »' }).waitFor();
  check('Il se coche à la main, et compte comme fait', ((await renfo.getAttribute('class')) ?? '').includes('sport-session-faite'));

  // --- Ajouter une séance d'escalade à la semaine (16/10/2026) --------------------------------
  const before = await page.locator('.sport-plan-current .sport-session').count();
  await page.locator('.sport-plan-current').getByRole('button', { name: '＋ Ajouter une séance' }).click();
  await page.waitForSelector('#sport-session-kind');
  check('Une séance ajoutée part sur l’escalade, sans distance ni allure', (await page.locator('#sport-session-kind').inputValue()) === 'escalade' && (await page.locator('#sport-session-km').count()) === 0 && (await page.locator('#sport-session-pacemin').count()) === 0);
  check('Une séance nouvelle ne se « retire » pas', (await modal.getByRole('button', { name: 'Retirer' }).count()) === 0);
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7));
  const sundayDay = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  await page.locator('#sport-session-duration').fill('90');
  await page.locator('#sport-session-day').fill(sundayDay);
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  const climb = page.locator('.sport-plan-current .sport-session', { hasText: 'Escalade' });
  await climb.waitFor();
  check('L’escalade s’ajoute à la semaine, nommée d’après sa sorte, le dimanche', (await page.locator('.sport-plan-current .sport-session').count()) === before + 1 && (await climb.count()) === 1, await text(climb));
  await climb.getByRole('checkbox', { name: 'Cocher « Escalade »' }).click();
  await climb.getByRole('checkbox', { name: 'Décocher « Escalade »' }).waitFor();
  check('Elle se coche à la main, comme le renfo', ((await climb.getAttribute('class')) ?? '').includes('sport-session-faite'));
  // Le foot (un five en salle) : pareil, une durée sans distance.
  await page.locator('.sport-plan-current').getByRole('button', { name: '＋ Ajouter une séance' }).click();
  await page.locator('#sport-session-kind').selectOption('foot');
  check('Le foot n’a ni distance ni allure', (await page.locator('#sport-session-km').count()) === 0 && (await page.locator('#sport-session-pacemin').count()) === 0);
  await page.locator('#sport-session-title').fill('Five en salle');
  await page.locator('#sport-session-duration').fill('60');
  await modal.getByRole('button', { name: 'Enregistrer' }).click();
  const five = page.locator('.sport-plan-current .sport-session', { hasText: 'Five en salle' });
  await five.waitFor();
  check('Le foot s’ajoute à la semaine, avec sa sorte', (await text(five)).includes('Foot'), await text(five));
  await page.getByRole('button', { name: /^Journal/ }).click();

  // --- Rechargement, puis téléphone ----------------------------------------------------------
  await page.reload();
  await page.waitForSelector('.sport-journal');
  check('Tout est retenu après un rechargement, vue comprise', (await page.locator('.sport-run').count()) === 3);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await phone.newPage();
  mobile.on('pageerror', (e) => errors.push(e.message));
  await mobile.goto(BASE);
  await toHub(mobile);
  await mobile.locator('.hub-picker-card', { hasText: 'Sport' }).click();
  await mobile.waitForSelector('.sport-empty');
  await mobile.getByRole('button', { name: 'Reprendre l’historique Strava' }).last().click();
  await mobile.getByLabel('Archive Strava').setInputFiles({ name: 'export_42.zip', mimeType: 'application/zip', buffer: archive() });
  await mobile.getByRole('button', { name: 'Importer 3 sorties' }).click();
  await mobile.waitForSelector('.sport-import-done');
  await mobile.locator('.sport-modal').getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await mobile.waitForSelector('.sport-dash');
  check('Sur téléphone, le tableau de bord tient dans la largeur', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await mobile.getByRole('button', { name: /^Journal/ }).click();
  await mobile.waitForSelector('.sport-journal');
  check('Le journal aussi', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await phone.close();

  // --- Une séance de renfo venue de Strava, dans le journal (12/10/2026) ----------------------
  // En local, Strava ne parle pas à Atlas : la séance est posée dans les données, comme une sauvegarde l'apporterait.
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const pa = await ctxA.newPage();
  pa.on('pageerror', (e) => errors.push(e.message));
  await pa.goto(BASE);
  await pa.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    const day = new Date().toISOString().slice(0, 10);
    raw.sportRuns = [{ id: 'r1', startedAt: `${day}T07:00:00.000Z`, day, distanceM: 8000, durationS: 2700, elevationM: null, avgHr: null, maxHr: null, kind: 'footing', effort: null, title: '', note: '', source: 'manuel', sourceRef: null, sessionId: null, splitsS: null, createdAt: '' }];
    raw.sportActivities = [{ id: 'a1', startedAt: `${day}T18:00:00.000Z`, day, sport: 'renfo', durationS: 2400, distanceM: null, elevationM: null, avgHr: 118, maxHr: 142, title: 'Renfo du soir', source: 'strava', sourceRef: 'strava:77', sessionId: null, createdAt: '' }];
    localStorage.setItem('palier.v1', JSON.stringify(raw));
    localStorage.setItem('sport.view.v1', 'journal');
  });
  await pa.evaluate(() => history.replaceState(null, '', '#/sport'));
  await pa.reload();
  await pa.waitForSelector('.sport-journal');
  const renfoRow = pa.locator('.sport-run-activity');
  check('Le journal montre la séance de renfo de Strava, avec sa durée et sa FC', (await renfoRow.count()) === 1 && (await text(renfoRow)).includes('Renfo du soir') && (await text(renfoRow)).includes('40 min') && (await text(renfoRow)).includes('♥ 118'));
  check('… sans la compter comme une sortie', (await text(pa.locator('.sport-month-total').first())).includes('1 sortie · 8,0 km · 1 séance d’à côté'));
  await renfoRow.click();
  await pa.getByRole('dialog', { name: 'Renfo du soir' }).waitFor();
  check('Sa fiche dit qu’aucune séance du plan ne lui correspondait', (await text(pa.getByRole('dialog'))).includes('Aucune séance du plan'));
  pa.on('dialog', (d) => d.accept());
  await pa.getByRole('dialog').getByRole('button', { name: 'Retirer' }).click();
  await renfoRow.waitFor({ state: 'detached' });
  check('Elle se retire du journal', (await pa.locator('.sport-run-activity').count()) === 0);
  await ctxA.close();

  check('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await context.close();
}
