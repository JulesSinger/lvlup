/**
 * Suite e2e du module Projets.
 *
 * Étape 3 (docs/etude-projets.md §15) : la V1. Un vrai parcours — l'écran
 * vide, créer un projet et son client d'après le modèle « Site vitrine »,
 * les chantiers repliés puis ouverts, cocher, une tâche qui attend le
 * client, ajouter une tâche et un chantier, l'attente posée sur le projet,
 * le journal, le tableau de bord (cette semaine, attente, carte, danger),
 * un second projet en piste, les projets par statut, les clients, les infos
 * et la suppression, le tout retrouvé après un rechargement — plus le rendu
 * téléphone.
 */

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');

const pad = (n) => String(n).padStart(2, '0');
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function openModule(page) {
  await toHub(page);
  await page.waitForSelector('.hub-picker-card');
  await page.locator('.hub-picker-card', { hasText: 'Projets' }).click();
  await page.waitForSelector('.projets-main');
}

const ws = (page, title) => page.locator(`section[aria-label="Chantier ${title}"]`);
const groupOf = (page, label) => page.locator('.projets-ws-group', { has: page.locator('.projets-section-title', { hasText: label }) });

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => void d.accept());

  await page.goto(BASE);
  await toHub(page);
  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Projets' });
  check('La carte Projets apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Projets dit ce que fait le module', (await card.textContent())?.includes('projets clients') ?? false);
  await card.click();
  await page.waitForSelector('.projets-main');
  check('L’adresse dit le module ouvert', page.url().endsWith('#/projets'));

  // --- L'écran vide -------------------------------------------------------
  check('Sans projet, le tableau de bord invite à en créer un', await page.locator('.projets-empty', { hasText: 'Aucun projet' }).isVisible());

  // --- Créer un projet et son client, d'après le modèle ----------------------
  await page.locator('.projets-empty').getByRole('button', { name: '+ Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  check('Sans client, la fenêtre propose d’en créer un', (await page.locator('#projets-new-client').inputValue()) === '__new__');
  check('Le titre suit le modèle choisi', (await page.locator('#projets-new-title').inputValue()) === 'Site vitrine');
  await dialog.getByRole('radio', { name: /Boutique en ligne/ }).click();
  check('Changer de modèle change le titre tant qu’on ne l’a pas écrit', (await page.locator('#projets-new-title').inputValue()) === 'Boutique en ligne');
  await dialog.getByRole('radio', { name: /Site vitrine/ }).click();
  await page.fill('#projets-new-client-name', 'Fleurs de Lou');
  await page.selectOption('#projets-new-client-trade', 'fleuriste');
  await page.selectOption('#projets-new-status', 'production');
  await page.fill('#projets-new-due', inDays(5));
  await page.fill('#projets-new-price', 'neuf cents');
  await dialog.getByRole('button', { name: 'Créer le projet' }).click();
  check('Un prix illisible est refusé en clair', (await text(dialog.locator('.notice.error'))).includes('montant positif'));
  await page.fill('#projets-new-price', '900');
  await dialog.getByRole('button', { name: 'Créer le projet' }).click();
  await page.waitForSelector('.projets-sheet');
  check('Le projet créé s’ouvre sur sa fiche', (await text(page.locator('.projets-sheet-title'))) === 'Site vitrine');
  check('La fiche dit le client et son métier', (await text(page.locator('.projets-sheet-client'))).includes('Fleurs de Lou · Fleuriste'));
  check('Le modèle a posé ses 8 chantiers', (await page.locator('.projets-ws').count()) === 8);
  check('Et ses 45 tâches, aucune faite', (await text(page.locator('.projets-sheet-progress'))).includes('0 / 45 tâches'));
  check('Le prix et l’échéance sont dans l’en-tête', (await text(page.locator('.projets-sheet-meta'))).includes('900 €') && (await text(page.locator('.projets-sheet-meta'))).includes('dans 5 j'));
  check('Rien de commencé : tout est « À faire », replié', (await groupOf(page, 'À faire').locator('.projets-ws').count()) === 8 && (await page.locator('.projets-task').count()) === 0);

  // --- Cocher : le chantier passe « En cours » -------------------------------
  await ws(page, 'Découverte').locator('.projets-ws-toggle').click();
  check('Ouvrir un chantier montre ses tâches', (await ws(page, 'Découverte').locator('.projets-task').count()) === 5);
  await page.getByRole('button', { name: 'Cocher « Premier rendez-vous avec le client »' }).click();
  await page.waitForFunction(() => document.querySelector('.projets-sheet-progress')?.textContent?.includes('1 / 45'));
  check('Cocher fait avancer le projet', (await text(page.locator('.projets-sheet-progress'))).includes('1 / 45 tâches'));
  check('Le chantier commencé passe dans « En cours »', (await groupOf(page, 'En cours').locator('.projets-ws-title').allTextContents()).join() === 'Découverte');

  // --- Ajouter une tâche sur place -----------------------------------------
  await page.getByLabel('Ajouter une tâche à Découverte').fill('Appeler pour le logo');
  await page.getByLabel('Ajouter une tâche à Découverte').press('Enter');
  await page.waitForFunction(() => document.querySelector('.projets-sheet-progress')?.textContent?.includes('/ 46'));
  check('Une tâche s’ajoute au bout de son chantier', (await ws(page, 'Découverte').locator('.projets-task-title').last().textContent()) === 'Appeler pour le logo');
  check('Le champ se vide après l’ajout', (await page.getByLabel('Ajouter une tâche à Découverte').inputValue()) === '');

  // --- Une tâche qui attend le client, prévue aujourd'hui ----------------------
  await ws(page, 'Contenus').locator('.projets-ws-toggle').click();
  await page.getByRole('button', { name: 'Modifier « Recevoir les photos »' }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Modifier la tâche' });
  await page.fill('#projets-task-planned', inDays(0));
  await taskDialog.getByLabel(/attend quelque chose du client/).check();
  await taskDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await taskDialog.waitFor({ state: 'detached' });
  check('Une tâche qui attend le client le dit', (await text(ws(page, 'Contenus').locator('.projets-task', { hasText: 'Recevoir les photos' }))).includes('attend le client'));
  check('Son chantier passe dans « Attend le client »', (await groupOf(page, 'Attend le client').locator('.projets-ws-title').allTextContents()).join() === 'Contenus');

  // --- Un nouveau chantier --------------------------------------------------
  await page.getByRole('button', { name: '+ Ajouter un chantier' }).click();
  await page.fill('#projets-ws-title', 'Référencement local');
  await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByRole('button', { name: 'Créer' }).click();
  await page.waitForSelector('section[aria-label="Chantier Référencement local"]');
  check('Un chantier sans tâche se range à part, ouvert pour y ajouter', (await groupOf(page, 'Sans tâche').locator('.projets-ws-title').allTextContents()).join() === 'Référencement local');

  // --- L'attente posée sur le projet ----------------------------------------
  await page.getByRole('button', { name: /J’attends quelque chose du client/ }).click();
  await page.getByLabel('Ce que tu attends du client').fill('la validation des tarifs');
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector('.projets-waitbar b');
  check('L’attente du client s’affiche, depuis aujourd’hui', (await text(page.locator('.projets-waitbar'))).includes('la validation des tarifs, depuis aujourd’hui'));

  // --- Le journal -------------------------------------------------------------
  await page.getByRole('tab', { name: 'Journal' }).click();
  check('Le journal vide dit à quoi il sert', await page.locator('.projets-journal .projets-hint').isVisible());
  await page.getByLabel('Note', { exact: true }).fill('Appel : elle veut une page Mariages');
  await page.getByRole('button', { name: 'Ajouter au journal' }).click();
  await page.waitForSelector('.projets-note');
  check('Une note datée entre au journal', (await text(page.locator('.projets-note-text'))) === 'Appel : elle veut une page Mariages');
  check('L’onglet compte ses notes', (await text(page.getByRole('tab', { name: /Journal/ }))) === 'Journal (1)');

  // --- Le tableau de bord ----------------------------------------------------
  await page.getByRole('button', { name: '← Retour' }).click();
  await page.waitForSelector('.projets-card');
  const week = page.locator('section[aria-label="Cette semaine"]');
  check('Cette semaine montre la tâche prévue aujourd’hui, avec son client', (await text(week)).includes('Recevoir les photos') && (await text(week)).includes('Fleurs de Lou'));
  const waiting = page.locator('section[aria-label="En attente du client"]');
  check('L’attente du projet et la tâche qui attend remontent', (await text(waiting)).includes('la validation des tarifs') && (await text(waiting)).includes('Recevoir les photos'));
  const projectCard = page.locator('.projets-card', { hasText: 'Fleurs de Lou' });
  check('La carte du projet dit son statut et ses chantiers en cours', (await text(projectCard)).includes('En production') && (await text(projectCard)).includes('Découverte 1/6'));
  check('Échéance proche et presque tout à faire : le projet est en danger', (await text(projectCard.locator('.projets-risk'))).includes('Mise en ligne dans 5 j'));
  await week.getByRole('button', { name: 'Cocher « Recevoir les photos »' }).click();
  await page.waitForFunction(() => !document.querySelector('section[aria-label="Cette semaine"]')?.textContent?.includes('Recevoir les photos'));
  check('Une tâche cochée depuis le tableau de bord quitte la semaine', !(await text(week)).includes('Recevoir les photos'));

  // --- Un second projet, client existant ou nouveau ------------------------
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
  check('Un client existant est proposé d’office', (await page.locator('#projets-new-client option:checked').textContent()) === 'Fleurs de Lou');
  await page.selectOption('#projets-new-client', '__new__');
  await page.fill('#projets-new-client-name', 'Le Camion Gourmand');
  await page.selectOption('#projets-new-client-trade', 'foodtruck');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('radio', { name: /Projet vide/ }).click();
  await page.fill('#projets-new-title', 'Site et emplacements');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('button', { name: 'Créer le projet' }).click();
  await page.waitForSelector('.projets-sheet');
  check('Un projet vide n’a aucun chantier', (await page.locator('.projets-ws').count()) === 0 && (await text(page.locator('.projets-sheet-progress'))).includes('—'));
  check('Le statut par défaut est « Piste »', (await page.locator('.projets-status-select').inputValue()) === 'lead');

  await page.getByRole('button', { name: /^Projets/ }).click();
  const groups = await page.locator('.projets-status-group .projets-section-title').allTextContents();
  check('Tous les projets, rangés par statut de la relation', groups.length === 2 && groups[0].startsWith('Piste') && groups[1].startsWith('En production'));
  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  await page.waitForSelector('.projets-card');
  check('Une piste n’est pas un projet actif du tableau de bord', (await page.locator('.projets-card').count()) === 1);

  // --- Les clients ------------------------------------------------------------
  await page.getByRole('button', { name: /^Clients/ }).click();
  check('Les deux clients, avec leur métier', (await page.locator('.projets-client').count()) === 2 && (await text(page.locator('.projets-client', { hasText: 'Le Camion Gourmand' }))).includes('Food truck'));
  await page.getByRole('button', { name: 'Modifier Fleurs de Lou' }).click();
  const clientDialog = page.getByRole('dialog', { name: 'Modifier le client' });
  check('Un client qui a des projets s’archive, il ne se supprime pas', (await clientDialog.getByRole('button', { name: 'Archiver' }).isVisible()) && (await clientDialog.getByRole('button', { name: 'Supprimer' }).count()) === 0);
  await page.fill('#projets-client-phone', '06 12 34 56 78');
  await clientDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await clientDialog.waitFor({ state: 'detached' });
  check('Le téléphone se touche pour appeler', (await page.locator('.projets-client', { hasText: 'Fleurs de Lou' }).locator('a[href="tel:0612345678"]').count()) === 1);

  // --- Infos du projet, et le supprimer --------------------------------------
  await page.locator('.projets-client', { hasText: 'Le Camion Gourmand' }).getByRole('button', { name: 'Site et emplacements' }).click();
  await page.getByRole('tab', { name: 'Infos' }).click();
  await page.fill('#projets-infos-price', '1 200');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.projets-infos .notice.success');
  check('Les infos s’enregistrent, le prix passe dans l’en-tête', (await text(page.locator('.projets-sheet-meta'))).includes('1 200 €'));
  check('Le numéro du projet est affiché', (await text(page.locator('.projets-infos'))).includes('Projet n° 2'));
  await page.getByRole('button', { name: 'Supprimer le projet' }).click();
  await page.waitForFunction(() => !document.querySelector('.projets-sheet'));
  await page.getByRole('button', { name: /^Projets/ }).click();
  check('Le projet supprimé a disparu', (await page.locator('.projets-row').count()) === 1);

  // --- Rechargement -----------------------------------------------------------
  await openModule(page);
  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  await page.waitForSelector('.projets-card');
  check('Après un rechargement, le projet et son avancement sont là', (await text(page.locator('.projets-card'))).includes('2 / 46 tâches'));
  await page.locator('.projets-card').click();
  check('Le chantier ajouté, l’attente et le journal sont gardés', (await page.locator('section[aria-label="Chantier Référencement local"]').count()) === 1 && (await text(page.locator('.projets-waitbar'))).includes('la validation des tarifs'));
  await page.getByRole('button', { name: 'C’est reçu' }).click();
  await page.waitForSelector('.projets-wait-btn');
  check('« C’est reçu » lève l’attente', (await page.locator('.projets-waitbar').count()) === 0);

  check('Aucune erreur JavaScript dans le parcours', errors.length === 0);
  await context.close();

  // --- Sur téléphone ------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  mobile.on('dialog', (d) => void d.accept());
  await mobile.goto(BASE);
  await mobile.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    const now = new Date().toISOString();
    raw.projetsClients = [{ id: 'c1', name: 'Boulangerie Ferrand et fils', trade: 'boulangerie', contactName: '', phone: '', email: '', address: '', note: '', archived: false, createdAt: now }];
    raw.projetsProjects = [
      { id: 'p1', clientId: 'c1', number: 1, title: 'Site vitrine avec un titre un peu long', template: 'vitrine', status: 'production', waitingFor: 'les photos de la vitrine', waitingSince: null, startDay: null, dueDay: null, priceCents: 90000, needs: {}, note: '', createdAt: now, updatedAt: now },
    ];
    raw.projetsWorkstreams = [{ id: 'w1', projectId: 'p1', title: 'Hébergement & domaine', position: 0, dueDay: null }];
    raw.projetsTasks = [{ id: 't1', projectId: 'p1', workstreamId: 'w1', title: 'Acheter ou transférer le nom de domaine, au nom du client', note: '', plannedDay: null, dueDay: null, waitingClient: false, position: 0, completedAt: now, createdAt: now }];
    raw.projetsNotes = [];
    localStorage.setItem('palier.v1', JSON.stringify(raw));
  });
  await openModule(mobile);
  await mobile.getByRole('button', { name: 'Tableau de bord' }).click();
  await mobile.waitForSelector('.projets-card');
  const noOverflow = () => mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check('Sur téléphone, le tableau de bord tient dans la largeur', await noOverflow());
  await mobile.locator('.projets-card').click();
  await mobile.locator('section[aria-label="Chantier Hébergement & domaine"] .projets-ws-toggle').click();
  check('Sur téléphone, la fiche tient dans la largeur', await noOverflow());
  await mobile.getByRole('tab', { name: 'Journal' }).click();
  check('Sur téléphone, le journal tient dans la largeur', await noOverflow());
  await phone.close();
}
