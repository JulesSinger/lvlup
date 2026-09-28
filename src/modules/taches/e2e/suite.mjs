/**
 * Suite e2e du module tâches (Polaris).
 *
 * Étape 3 (docs/etude-taches.md §15) : la V1. Un vrai parcours — l'ajout
 * rapide en français et ce qu'il a compris (annulable), Aujourd'hui, À
 * venir, la boîte de réception et les listes ; cocher et défaire, modifier,
 * sous-tâches, priorités, supprimer ; retrouver le tout après un
 * rechargement — plus le rendu téléphone.
 */

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');

async function openPolaris(page, BASE) {
  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Polaris/ }).click();
  await page.waitForSelector('.taches-quickadd');
}

async function type(page, value) {
  await page.getByLabel('Ajouter une tâche').fill(value);
}

async function add(page, value) {
  await type(page, value);
  await page.getByLabel('Ajouter une tâche').press('Enter');
  await page.waitForFunction(() => document.querySelector('.taches-quickadd-input')?.value === '');
}

const row = (page, title) => page.locator('.taches-row', { has: page.locator('.taches-row-title', { hasText: title }) });

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Polaris/ });
  check('La carte Polaris apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Polaris dit ce que fait le module', (await card.textContent())?.includes('Tâches') ?? false);
  await card.click();
  await page.waitForSelector('.taches-quickadd');
  check('Polaris s’ouvre sur Aujourd’hui', (await text(page.locator('.taches-title'))).startsWith('Aujourd’hui'));
  check('Aujourd’hui vide explique comment ajouter', (await text(page.locator('.taches-empty'))).includes('Rien de prévu'));

  // --- L'ajout rapide : ce qui a été compris, avant d'enregistrer ---------------------------
  await type(page, 'Appeler le garage demain 9h !');
  const tokens = await page.locator('.taches-token').allTextContents();
  check('Ce qui a été compris s’affiche avant d’enregistrer', tokens.length === 3 && tokens[0].includes('Demain') && tokens[1].includes('9 h') && tokens[2].includes('Importante'), tokens.join(' | '));
  await page.getByLabel('Ajouter une tâche').press('Enter');
  await page.locator('.taches-toast').waitFor();
  check('Une tâche rangée ailleurs le dit : « prévue demain »', (await text(page.locator('.taches-toast'))).includes('prévue demain'));
  check('… et n’encombre pas Aujourd’hui', (await row(page, 'Appeler le garage').count()) === 0);

  await type(page, 'Réunion de lundi');
  await page.locator('.taches-token-day').click();
  check('Toucher une pastille annule ce qui a été compris', (await page.locator('.taches-token').count()) === 0);
  await page.getByLabel('Ajouter une tâche').press('Enter');
  await row(page, 'Réunion de lundi').waitFor();
  check('Sans date, une tâche ajoutée dans Aujourd’hui est prévue aujourd’hui, titre intact', await row(page, 'Réunion de lundi').isVisible());

  await add(page, 'Impôts avant demain !!');
  await row(page, 'Impôts').waitFor();
  const impots = await text(row(page, 'Impôts'));
  check('Une échéance proche entre dans Aujourd’hui, marquée', impots.includes('Urgente') && impots.includes('à faire d’ici demain'), impots);
  check('La priorité colore la ligne', ((await row(page, 'Impôts').getAttribute('class')) ?? '').includes('taches-priority-urgente'));

  await page.getByRole('button', { name: 'À venir' }).click();
  const tomorrow = page.locator('.taches-day', { has: page.locator('.taches-section-title', { hasText: 'Demain' }) });
  check('À venir range la tâche sous « Demain », avec son heure', (await text(tomorrow)).includes('Appeler le garage') && (await text(tomorrow)).includes('9 h'));
  check('À venir montre 14 jours', (await page.locator('.taches-day').count()) === 14);

  // --- Les listes et la boîte de réception ---------------------------------------------------
  await page.getByRole('button', { name: '+ Liste' }).click();
  await page.locator('#taches-list-name').fill('Maison');
  await page.getByRole('radio', { name: 'Vert' }).click();
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.waitForSelector('.taches-list-editor', { state: 'detached' });
  check('Créer une liste l’ouvre', (await text(page.locator('.taches-title'))).includes('Maison') && (await text(page.locator('.taches-empty'))).includes('vide'));
  await add(page, 'Ampoule du salon');
  await row(page, 'Ampoule du salon').waitFor();
  check('Ajouter dans une liste l’y range', await row(page, 'Ampoule du salon').isVisible());

  await page.getByRole('button', { name: /^Aujourd’hui/ }).click();
  await add(page, 'Cartouches #maison');
  await row(page, 'Cartouches').waitFor();
  check('« #maison » range dans la liste, et la ligne le dit', (await text(row(page, 'Cartouches'))).includes('# Maison'));

  await page.getByRole('button', { name: /^Boîte de réception/ }).click();
  await add(page, 'Idée de cadeau');
  await row(page, 'Idée de cadeau').waitFor();
  check('La boîte de réception garde ce qui n’a pas de liste, daté ou non', (await row(page, 'Idée de cadeau').isVisible()) && (await row(page, 'Réunion de lundi').isVisible()) && (await row(page, 'Ampoule').count()) === 0);

  // --- Cocher, et défaire ------------------------------------------------------------------------
  await page.getByRole('button', { name: /^Aujourd’hui/ }).click();
  await page.getByRole('checkbox', { name: 'Cocher « Réunion de lundi »' }).click();
  await row(page, 'Réunion de lundi').waitFor({ state: 'detached' });
  check('Cocher une tâche la retire d’Aujourd’hui', (await row(page, 'Réunion de lundi').count()) === 0);
  check('… et propose d’annuler', (await text(page.locator('.taches-toast'))).includes('faite'));
  await page.locator('.taches-toast').getByRole('button', { name: 'Annuler' }).click();
  await row(page, 'Réunion de lundi').waitFor();
  check('Annuler la remet, pas cochée', (await page.getByRole('checkbox', { name: 'Cocher « Réunion de lundi »' }).count()) === 1);

  // --- Modifier : priorité, échéance, sous-tâches -------------------------------------------------
  await row(page, 'Impôts').locator('.taches-row-body').click();
  await page.waitForSelector('.taches-editor');
  check('Toucher une tâche l’ouvre, échéance déjà affichée', (await page.locator('#taches-due').inputValue()) !== '');
  await page.getByRole('radio', { name: 'Importante' }).click();
  for (const s of ['Formulaire', 'Justificatifs']) {
    await page.locator('#taches-new-subtask').fill(s);
    await page.locator('#taches-new-subtask').press('Enter');
    await page.locator('.taches-editor-subtasks li', { hasText: s }).waitFor();
  }
  await page.getByRole('checkbox', { name: 'Cocher « Formulaire »' }).click();
  await page.getByRole('checkbox', { name: 'Décocher « Formulaire »' }).waitFor();
  check('Les sous-tâches s’ajoutent et se cochent dans la fenêtre', (await page.locator('.taches-editor-subtasks li').count()) === 2);
  await page.locator('#taches-title').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  check('Un titre vide est refusé, en français', (await text(page.locator('.taches-editor .notice.error'))).includes('titre'));
  await page.locator('#taches-title').fill('Déclarer les impôts');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.taches-editor', { state: 'detached' });
  const edited = row(page, 'Déclarer les impôts');
  check('La modification se voit : titre, priorité', (await text(edited)).includes('Importante') && !(await text(edited)).includes('Urgente'));
  check('La ligne compte ses sous-tâches faites', (await text(edited.locator('.taches-subtoggle'))).includes('1/2'));
  await edited.locator('.taches-subtoggle').click();
  check('Les sous-tâches se déplient sous la tâche', (await edited.locator('.taches-subtask').count()) === 2);

  // --- Après un rechargement ------------------------------------------------------------------------
  await page.getByRole('button', { name: 'À venir' }).click();
  await openPolaris(page, BASE);
  check('La dernière vue est retenue', (await text(page.locator('.taches-title'))).startsWith('À venir'));
  await page.getByRole('button', { name: /^Aujourd’hui/ }).click();
  check(
    'Tâches, liste et sous-tâches sont toujours là',
    (await row(page, 'Déclarer les impôts').isVisible()) && (await text(row(page, 'Déclarer les impôts'))).includes('1/2') && (await page.getByRole('button', { name: /^Maison/ }).isVisible()),
  );

  // --- Supprimer ------------------------------------------------------------------------------------------
  await row(page, 'Déclarer les impôts').locator('.taches-row-body').click();
  await page.locator('.taches-editor').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForSelector('.taches-editor', { state: 'detached' });
  check('Supprimer une tâche (après confirmation) la retire, avec ses sous-tâches', (await row(page, 'Déclarer les impôts').count()) === 0);

  await page.getByRole('button', { name: /^Maison/ }).click();
  await page.getByRole('button', { name: 'Modifier la liste' }).click();
  await page.locator('.taches-list-editor').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.taches-list-editor', { state: 'detached' });
  check(
    'Supprimer une liste renvoie ses tâches à la boîte de réception',
    (await text(page.locator('.taches-title'))).includes('Boîte de réception') && (await row(page, 'Ampoule du salon').isVisible()) && (await page.getByRole('button', { name: /^Maison/ }).count()) === 0,
  );
  check('Aucune erreur JavaScript sur ordinateur', errors.length === 0, errors.join(' | '));
  await context.close();

  // --- Téléphone ---------------------------------------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(e.message));
  await openPolaris(mobile, BASE);
  for (const t of ['Appeler le garage à 9h !', 'Un titre de tâche assez long pour tenir sur plusieurs lignes à l’écran avant le 30']) await add(mobile, t);
  await mobile.getByRole('button', { name: '+ Liste' }).click();
  await mobile.locator('#taches-list-name').fill('Papiers administratifs');
  await mobile.getByRole('button', { name: 'Créer' }).click();
  await mobile.waitForSelector('.taches-list-editor', { state: 'detached' });
  await mobile.getByRole('button', { name: /^Aujourd’hui/ }).click();
  const noOverflow = () => mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check('Sur téléphone, rien ne déborde, même avec une liste au nom long', await noOverflow());
  check('Sur téléphone, les vues tiennent sur une ligne', (await mobile.locator('.taches-nav').evaluate((el) => getComputedStyle(el).flexWrap)) === 'nowrap');
  await row(mobile, 'Appeler le garage').locator('.taches-row-body').click();
  await mobile.waitForSelector('.taches-editor');
  const box = await mobile.locator('.taches-editor').boundingBox();
  check('Sur téléphone, la fenêtre d’une tâche tient dans l’écran', (await noOverflow()) && box !== null && box.x >= 0 && box.x + box.width <= 391);
  check('Aucune erreur JavaScript sur téléphone', mobileErrors.length === 0, mobileErrors.join(' | '));
  await phone.close();
}
