/**
 * Suite e2e du module tâches (Polaris).
 *
 * Étapes 3 et 4 (docs/etude-taches.md §15-§16) : la V1, puis la
 * répétition réglée à l'écran, la vue Terminées, « Faire le point » et
 * réordonner une liste. Un vrai parcours — l'ajout
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

const pad = (n) => String(n).padStart(2, '0');
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function edit(page, title, change) {
  await row(page, title).getByRole('button', { name: /^Modifier « / }).click();
  await page.waitForSelector('.taches-editor');
  await change();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.taches-editor', { state: 'detached' });
}

const titles = (page) => page.locator('.taches-row-title').allTextContents();

const row = (page, title) => page.locator('.taches-row:not(.taches-forecast)', { has: page.locator('.taches-row-title', { hasText: title }) });

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
  await row(page, 'Impôts').locator('.taches-row-title').click({ clickCount: 3 });
  check('Toucher le texte d’une tâche n’ouvre pas sa fenêtre…', (await page.locator('.taches-editor').count()) === 0);
  check('… et le texte se sélectionne, pour le copier', (await page.evaluate(() => window.getSelection()?.toString() ?? '')).includes('Impôts'));
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await row(page, 'Impôts').getByRole('button', { name: /^Modifier « / }).click();
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
  await row(page, 'Déclarer les impôts').getByRole('button', { name: /^Modifier « / }).click();
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
  // Les rappels (étape 5) : en mode local, la section explique qu'il faut un compte, sans interrupteur inutile.
  await page.getByRole('button', { name: 'Réglages' }).click();
  const settings = page.locator('.taches-settings');
  await settings.waitFor();
  check(
    'Réglages : la section des rappels de Polaris dit qu’ils demandent un compte',
    (await text(settings)).includes('Rappels des tâches') && (await text(settings)).includes('demandent un compte') && (await settings.locator('.switch').count()) === 0,
  );
  await page.locator('.modal-foot').getByRole('button', { name: 'Fermer' }).click();
  await settings.waitFor({ state: 'detached' });
  check('Aucune erreur JavaScript sur ordinateur', errors.length === 0, errors.join(' | '));
  await context.close();

  // --- Étape 4 : répéter, Terminées, Faire le point, réordonner -----------------------------
  const ctx4 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p4 = await ctx4.newPage();
  const errors4 = [];
  p4.on('pageerror', (e) => errors4.push(e.message));
  p4.on('dialog', (d) => d.accept());
  await openPolaris(p4, BASE);

  await add(p4, 'Arroser les plantes');
  await row(p4, 'Arroser les plantes').waitFor();
  await edit(p4, 'Arroser les plantes', async () => {
    await p4.locator('#taches-repeat').selectOption('daily');
    await p4.getByRole('radio', { name: /Après l’avoir faite/ }).click();
    await p4.locator('#taches-interval').fill('5');
    check('La répétition se relit en toutes lettres', (await text(p4.locator('.taches-repeat-summary'))).includes('5 jours après l’avoir faite'));
  });
  check('Une tâche répétée le montre sur sa ligne', (await text(row(p4, 'Arroser les plantes'))).includes('↻'));
  await p4.getByRole('checkbox', { name: 'Cocher « Arroser les plantes »' }).click();
  await p4.locator('.taches-toast').waitFor();
  check('Cocher une tâche répétée annonce la prochaine', (await text(p4.locator('.taches-toast'))).includes('la prochaine'));
  await row(p4, 'Arroser les plantes').waitFor({ state: 'detached' });
  await p4.getByRole('button', { name: 'Terminées' }).click();
  check(
    'Terminées garde la trace, sous « Aujourd’hui », cochée',
    (await text(p4.locator('.taches-section', { hasText: 'Aujourd’hui' }))).includes('Arroser les plantes') &&
      (await p4.getByRole('checkbox', { name: 'Décocher « Arroser les plantes »' }).count()) === 1,
  );
  check('Terminées n’a pas de barre d’ajout', (await p4.locator('.taches-quickadd').count()) === 0);
  await p4.getByRole('button', { name: 'À venir' }).click();
  check('… et la tâche est repartie cinq jours plus tard', (await row(p4, 'Arroser les plantes').count()) === 1);

  await p4.getByRole('button', { name: /^Aujourd’hui/ }).click();
  for (const t of ['Rappeler la banque', 'Renvoyer le colis']) {
    await add(p4, t);
    await row(p4, t).waitFor();
    await edit(p4, t, () => p4.locator('#taches-day').fill(day(-1)));
  }
  await p4.locator('.taches-triage-banner').waitFor();
  check('Des retards font apparaître « Faire le point »', (await text(p4.locator('.taches-triage-banner'))).includes('2 tâches en retard'));
  await p4.getByRole('button', { name: 'Faire le point' }).click();
  const item = (t) => p4.locator('.taches-triage-item', { hasText: t });
  await item('Rappeler la banque').getByRole('button', { name: 'Demain' }).click();
  await item('Rappeler la banque').waitFor({ state: 'detached' });
  check('Un geste trie une tâche : elle quitte la liste', (await p4.locator('.taches-triage-item').count()) === 1);
  await item('Renvoyer le colis').getByRole('button', { name: '✓ Faite' }).click();
  await p4.waitForSelector('.taches-triage', { state: 'detached' });
  check('Tout trié : la fenêtre se ferme, le bandeau disparaît', (await p4.locator('.taches-triage-banner').count()) === 0);
  await p4.getByRole('button', { name: 'À venir' }).click();
  const tomorrow4 = p4.locator('.taches-day', { has: p4.locator('.taches-section-title', { hasText: 'Demain' }) });
  check('« Demain » l’a bien reprévue demain', (await text(tomorrow4)).includes('Rappeler la banque'));

  await p4.getByRole('button', { name: '+ Liste' }).click();
  await p4.locator('#taches-list-name').fill('Courses');
  await p4.getByRole('button', { name: 'Créer' }).click();
  await p4.waitForSelector('.taches-list-editor', { state: 'detached' });
  for (const t of ['Pain', 'Lait', 'Œufs']) {
    await add(p4, t);
    await row(p4, t).waitFor();
  }
  check('Une liste garde l’ordre d’ajout', JSON.stringify(await titles(p4)) === JSON.stringify(['Pain', 'Lait', 'Œufs']));
  await p4.getByRole('button', { name: /Déplacer « Pain »/ }).focus();
  await p4.keyboard.press('ArrowDown');
  await p4.waitForFunction(() => document.querySelector('.taches-row-title')?.textContent === 'Lait');
  check('Au clavier, la flèche descend la tâche d’un cran', JSON.stringify(await titles(p4)) === JSON.stringify(['Lait', 'Pain', 'Œufs']));
  const handle = await p4.getByRole('button', { name: /Déplacer « Œufs »/ }).boundingBox();
  const first = await row(p4, 'Lait').boundingBox();
  if (handle && first) {
    await p4.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await p4.mouse.down();
    await p4.mouse.move(handle.x + handle.width / 2, first.y + 4, { steps: 12 });
    await p4.mouse.up();
  }
  await p4.waitForFunction(() => document.querySelector('.taches-row-title')?.textContent === 'Œufs', null, { timeout: 3000 }).catch(() => {});
  check('Glisser la poignée remonte la tâche en tête', JSON.stringify(await titles(p4)) === JSON.stringify(['Œufs', 'Lait', 'Pain']), (await titles(p4)).join(', '));
  await openPolaris(p4, BASE);
  await row(p4, 'Œufs').waitFor();
  check('Le nouvel ordre est gardé après un rechargement', JSON.stringify(await titles(p4)) === JSON.stringify(['Œufs', 'Lait', 'Pain']));
  check('Aucune erreur JavaScript à l’étape 4', errors4.length === 0, errors4.join(' | '));
  await ctx4.close();

  // --- Étape 7 : la file hors ligne ---------------------------------------------------------
  // Le mode local ne perd jamais le réseau : on pose directement dans la file
  // une tâche notée « sans réseau » lors d'une visite précédente, et on vérifie
  // qu'elle part dès l'ouverture de Polaris — le rejeu au démarrage.
  const ctx7 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p7 = await ctx7.newPage();
  await p7.goto(BASE);
  await p7.evaluate((today) => {
    localStorage.setItem(
      'taches.outbox.v1',
      JSON.stringify([{ id: 'op1', at: Date.now(), kind: 'create', taskId: 'hors-ligne-1', input: { title: 'Notée dans le métro', plannedDay: today } }]),
    );
  }, day(0));
  await openPolaris(p7, BASE);
  await row(p7, 'Notée dans le métro').waitFor();
  await p7.waitForFunction(() => localStorage.getItem('taches.outbox.v1') === null);
  check('Une tâche restée en file hors ligne part à l’ouverture, et s’affiche', await row(p7, 'Notée dans le métro').isVisible());
  check(
    '… enregistrée avec l’identifiant choisi avant l’envoi, sans doublon',
    await p7.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.filter((t) => t.id === 'hors-ligne-1').length === 1),
  );
  check('Rien en attente : pas de message « en attente d’envoi »', (await p7.locator('.taches-waiting-notice').count()) === 0);

  // Un titre long (plus de 200 caractères, la limite d'avant le 28/09/2026) s'ajoute sans erreur.
  const longTitle = `Préparer le dossier de la mutuelle : ${'relevés, attestations, justificatifs de soins, '.repeat(6)}fin`;
  await add(p7, longTitle);
  await row(p7, 'Préparer le dossier de la mutuelle').waitFor();
  check(
    'Un titre de plus de 200 caractères s’enregistre, sans message d’erreur',
    longTitle.length > 200 && (await p7.locator('.notice.error').count()) === 0 && (await text(row(p7, 'Préparer le dossier de la mutuelle').locator('.taches-row-title'))).endsWith('fin'),
  );
  check('… et ne fait pas déborder la page', await p7.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  // Les répétitions dans l'ajout rapide (28/09/2026) : un anniversaire revient tous les ans.
  await type(p7, 'Anniversaire Léa 15 03');
  const bdayTokens = (await p7.locator('.taches-token').allTextContents()).join(' | ');
  check('« Anniversaire Léa 15 03 » : la date et « tous les ans » sont compris', bdayTokens.includes('15 mars') && bdayTokens.includes('Tous les ans le 15 mars'), bdayTokens);
  await p7.getByLabel('Ajouter une tâche').press('Enter');
  await p7.locator('.taches-toast').waitFor();
  const bday = await p7.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.title === 'Anniversaire Léa'));
  check(
    '… et la tâche est enregistrée, répétée tous les ans, au prochain 15 mars',
    bday?.recurrence?.freq === 'yearly' && bday?.plannedDay?.endsWith('-03-15') && bday?.repeatFrom === 'schedule',
    JSON.stringify(bday),
  );
  await add(p7, 'Sport tous les lundis 18h');
  // Prévue au premier lundi à partir d'aujourd'hui : dans Aujourd'hui un lundi, dans À venir sinon.
  if ((await row(p7, 'Sport').count()) === 0) await p7.getByRole('button', { name: 'À venir' }).click();
  await row(p7, 'Sport').first().waitFor();
  const sport = await p7.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.title === 'Sport'));
  check(
    '« tous les lundis 18h » : une tâche répétée chaque lundi, à 18 h, marquée ↻',
    (await text(row(p7, 'Sport').first())).includes('↻') && JSON.stringify(sport?.recurrence?.byWeekday) === '[1]' && sport?.plannedTime === '18:00' && new Date(`${sport?.plannedDay}T12:00`).getDay() === 1,
    JSON.stringify(sport),
  );
  // L'aperçu des prochaines fois (28/09/2026) : dans À venir, en retrait, sans case à cocher.
  await p7.getByRole('button', { name: 'À venir' }).click();
  const ghosts = p7.locator('.taches-forecast', { hasText: 'Sport' });
  await ghosts.first().waitFor();
  check(
    'À venir montre les prochains lundis de « Sport », en aperçu, sans case à cocher',
    (await ghosts.count()) >= 1 && (await ghosts.first().getByRole('checkbox').count()) === 0 && (await text(ghosts.first())).includes('prochaine fois'),
  );
  await ghosts.first().getByRole('button', { name: /^Modifier « / }).click();
  await p7.locator('.taches-editor').waitFor();
  check('Le ✎ d’un aperçu ouvre la tâche elle-même, avec sa répétition', (await p7.locator('#taches-repeat').inputValue()) === 'weekly');
  await p7.keyboard.press('Escape');

  await ctx7.close();

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
  await row(mobile, 'Appeler le garage').getByRole('button', { name: /^Modifier « / }).click();
  await mobile.waitForSelector('.taches-editor');
  const box = await mobile.locator('.taches-editor').boundingBox();
  check('Sur téléphone, la fenêtre d’une tâche tient dans l’écran', (await noOverflow()) && box !== null && box.x >= 0 && box.x + box.width <= 391);
  check('Aucune erreur JavaScript sur téléphone', mobileErrors.length === 0, mobileErrors.join(' | '));
  await phone.close();
}
