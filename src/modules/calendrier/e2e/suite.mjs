/**
 * Suite e2e du module calendrier (Éclipse).
 *
 * Étapes 3 à 5 (docs/etude-calendrier.md §15-§17). Un vrai parcours —
 * FullCalendar chargé seulement à l'ouverture, vue semaine par défaut,
 * créer (horaire, journée entière sur plusieurs jours, glisser sur un
 * créneau), refuser une fin avant le début, modifier, supprimer ; puis une
 * série de sept jours, modifiée, déplacée et supprimée « cet événement »,
 * « les suivants » ou « tous » ; changer de vue, retrouver le tout après un
 * rechargement — plus le rendu téléphone, et les calques des autres modules.
 *
 * Les dates sont celles du jour de l'exécution : la vue semaine s'ouvre sur
 * la semaine en cours, c'est là que tout se passe.
 */

const pad = (n) => String(n).padStart(2, '0');
const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');
function day(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function openEclipse(page, BASE) {
  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Éclipse/ }).click();
  await page.waitForSelector('.fc');
}

/** Remplit la fenêtre d'un nouvel événement ouverte par le bouton du haut. */
async function createEvent(page, { title, start, end = start, from, to, allDay = false, color }) {
  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.locator('#calendrier-title').fill(title);
  if (allDay) await page.locator('.calendrier-allday input').check();
  await page.locator('#calendrier-start-day').fill(start);
  await page.locator('#calendrier-end-day').fill(end);
  if (!allDay) {
    await page.locator('#calendrier-start-time').fill(from);
    await page.locator('#calendrier-end-time').fill(to);
  }
  if (color) await page.getByRole('radio', { name: color }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  await page.locator('.fc-event', { hasText: title }).first().waitFor();
}

/** Le lundi de la semaine en cours, et les jours qui suivent : la vue semaine les montre tous. */
function weekDay(index) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + index);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const dayColumn = (page, dayValue) => page.locator(`.fc-timegrid-col[data-date="${dayValue}"]`);

/** Ouvre l'occurrence d'un jour, change ce qu'il faut, enregistre, et répond à « laquelle ? ». */
async function editOccurrence(page, dayValue, change, scope) {
  await dayColumn(page, dayValue).locator('.fc-timegrid-event', { hasText: 'Méditation' }).click();
  await page.waitForSelector('.calendrier-editor');
  await change();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-scope');
  await page.locator('.calendrier-scope').getByRole('button', { name: scope, exact: true }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
}

async function deleteOccurrence(page, dayValue, scope) {
  await dayColumn(page, dayValue).locator('.fc-timegrid-event', { hasText: 'Méditation' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.calendrier-scope');
  await page.locator('.calendrier-scope').getByRole('button', { name: scope, exact: true }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
}

/** Les heures de la série, jour par jour du lundi au dimanche ; « - » quand elle n'y est pas. */
async function seriesWeek(page) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const ev = dayColumn(page, weekDay(i)).locator('.fc-timegrid-event', { hasText: 'Méditation' });
    // FullCalendar écrit « 7:00 » en français : on remet le zéro pour comparer.
    const time = (await ev.count()) === 0 ? null : ((await ev.first().textContent()) ?? '').match(/(\d{1,2}):(\d{2})/);
    out.push(time ? `${time[1].padStart(2, '0')}:${time[2]}` : '-');
  }
  return out.join(' ');
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const chunks = [];
  page.on('request', (r) => {
    if (r.url().includes('CalendarView')) chunks.push(r.url());
  });

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Éclipse/ });
  check('La carte Éclipse apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Éclipse dit ce que fait le module', (await card.textContent())?.includes('Calendrier') ?? false);
  check('FullCalendar n’est pas téléchargé tant qu’Éclipse n’est pas ouvert', chunks.length === 0);

  await card.click();
  await page.waitForSelector('.fc');
  check('Ouvrir Éclipse télécharge FullCalendar, dans son propre fichier', chunks.length > 0, chunks.join(', '));
  check('La vue semaine s’ouvre par défaut sur ordinateur', await page.locator('.fc-timeGridWeek-view').isVisible());
  const weekText = (await page.locator('.fc-timeGridWeek-view').textContent()) ?? '';
  check('Les jours et la bande des journées entières sont en français', weekText.includes('lun.') && weekText.includes('Journée'));

  // --- Créer ---------------------------------------------------------------------
  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.waitForSelector('.calendrier-editor');
  check('Un nouvel événement propose aujourd’hui ou demain par défaut', [day(0), day(1)].includes(await page.locator('#calendrier-start-day').inputValue()));
  check('… et une heure pleine', (await page.locator('#calendrier-start-time').inputValue()).endsWith(':00'));
  await page.locator('#calendrier-title').fill('Rendez-vous impossible');
  await page.locator('#calendrier-start-day').fill(day(0));
  await page.locator('#calendrier-end-day').fill(day(0));
  await page.locator('#calendrier-start-time').fill('15:00');
  await page.locator('#calendrier-end-time').fill('14:00');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  check(
    'Une fin avant le début est refusée, en français, et la fenêtre reste remplie',
    (await page.locator('.calendrier-editor .notice.error').isVisible()) &&
      (await page.locator('#calendrier-title').inputValue()) === 'Rendez-vous impossible',
  );
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });

  await createEvent(page, { title: 'Dentiste', start: day(0), from: '10:00', to: '10:30', color: 'Rose' });
  const dentist = page.locator('.fc-timegrid-event', { hasText: 'Dentiste' });
  check('Un événement horaire apparaît dans la grille de la semaine', await dentist.isVisible());
  check('… avec ses heures', (await dentist.textContent())?.includes('10:00') ?? false);
  check('… et la couleur choisie', ((await dentist.getAttribute('class')) ?? '').includes('calendrier-event-rose'));

  await createEvent(page, { title: 'Séjour à Lisbonne', start: day(0), end: day(2), allDay: true });
  const trip = page.locator('.fc-daygrid-event', { hasText: 'Séjour à Lisbonne' }).first();
  check('Une journée entière s’affiche dans la bande « Journée »', await trip.isVisible());
  const tripBox = await trip.boundingBox();
  const dayWidth = (await page.locator('.fc-col-header-cell').first().boundingBox())?.width ?? 0;
  const isSunday = new Date().getDay() === 0;
  check(
    'Un séjour de plusieurs jours s’étend sur plusieurs colonnes',
    isSunday || (tripBox?.width ?? 0) > dayWidth * 1.5,
    `${tripBox?.width} contre ${dayWidth} par jour`,
  );

  // Glisser dans la grille ouvre la fenêtre sur le créneau choisi.
  const column = await page.locator('.fc-timegrid-col.fc-day-today').boundingBox();
  const slot16 = await page.locator('.fc-timegrid-slot-lane[data-time="16:00:00"]').boundingBox();
  const slot17 = await page.locator('.fc-timegrid-slot-lane[data-time="17:00:00"]').boundingBox();
  if (column && slot16 && slot17) {
    const x = column.x + column.width / 2;
    await page.mouse.move(x, slot16.y + slot16.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, slot17.y + slot17.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForSelector('.calendrier-editor', { timeout: 3000 }).catch(() => {});
  check(
    'Glisser sur un créneau ouvre la fenêtre sur ces heures',
    (await page.locator('#calendrier-start-time').inputValue().catch(() => '')) === '16:00' &&
      (await page.locator('#calendrier-end-time').inputValue().catch(() => '')) === '17:30',
  );
  if (await page.locator('.calendrier-editor').isVisible()) {
    await page.locator('#calendrier-title').fill('Sport');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  }
  check('… et l’événement créé ainsi prend sa place', await page.locator('.fc-timegrid-event', { hasText: 'Sport' }).isVisible());

  // --- Modifier, supprimer -----------------------------------------------------------
  await dentist.click();
  await page.waitForSelector('.calendrier-editor');
  check('Toucher un événement l’ouvre pour le modifier', (await page.locator('#calendrier-title').inputValue()) === 'Dentiste');
  await page.locator('#calendrier-title').fill('Dentiste (Dr Martin)');
  await page.locator('#calendrier-start-time').fill('11:00');
  await page.locator('#calendrier-end-time').fill('11:45');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  const moved = page.locator('.fc-timegrid-event', { hasText: 'Dentiste (Dr Martin)' });
  await moved.waitFor();
  check('La modification se voit tout de suite, nouvelle heure comprise', (await moved.textContent())?.includes('11:00') ?? false);

  await page.locator('.fc-timegrid-event', { hasText: 'Sport' }).click();
  await page.waitForSelector('.calendrier-editor');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  await page.locator('.fc-timegrid-event', { hasText: 'Sport' }).waitFor({ state: 'detached' });
  check('Supprimer (après confirmation) retire l’événement', (await page.locator('.fc-event', { hasText: 'Sport' }).count()) === 0);

  // --- Les séries (étape 4) ------------------------------------------------------------
  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.locator('#calendrier-title').fill('Méditation');
  await page.locator('#calendrier-start-day').fill(weekDay(0));
  await page.locator('#calendrier-end-day').fill(weekDay(0));
  await page.locator('#calendrier-start-time').fill('07:00');
  await page.locator('#calendrier-end-time').fill('07:30');
  await page.locator('#calendrier-repeat').selectOption('daily');
  await page.locator('#calendrier-end-kind').selectOption('count');
  await page.locator('#calendrier-count').fill('7');
  check(
    'La répétition se relit en toutes lettres avant d’enregistrer',
    ((await page.locator('.calendrier-recurrence-summary').textContent()) ?? '').includes('Tous les jours, 7 fois'),
  );
  await page.locator('#calendrier-repeat').selectOption('weekly');
  check(
    'Toutes les semaines propose le jour du début, déjà choisi',
    (await page.getByRole('button', { name: 'lundi' }).getAttribute('aria-pressed')) === 'true' &&
      (await page.getByRole('button', { name: 'mardi' }).getAttribute('aria-pressed')) === 'false',
  );
  await page.locator('#calendrier-repeat').selectOption('daily');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  await dayColumn(page, weekDay(6)).locator('.fc-timegrid-event', { hasText: 'Méditation' }).waitFor();
  check('Une série de 7 jours s’affiche chaque jour de la semaine', (await seriesWeek(page)) === '07:00 07:00 07:00 07:00 07:00 07:00 07:00', await seriesWeek(page));
  check(
    'Une occurrence de série est marquée comme telle',
    ((await dayColumn(page, weekDay(0)).locator('.fc-timegrid-event', { hasText: 'Méditation' }).getAttribute('class')) ?? '').includes('calendrier-event-recurring'),
  );

  await editOccurrence(page, weekDay(2), () => page.locator('#calendrier-title').fill('Méditation longue'), 'Cet événement');
  check(
    '« Cet événement » ne change que lui',
    (await dayColumn(page, weekDay(2)).locator('.fc-timegrid-event', { hasText: 'Méditation longue' }).count()) === 1 &&
      (await page.locator('.fc-timegrid-event', { hasText: 'Méditation longue' }).count()) === 1,
  );

  await editOccurrence(
    page,
    weekDay(4),
    async () => {
      await page.locator('#calendrier-start-time').fill('06:00');
      await page.locator('#calendrier-end-time').fill('06:30');
    },
    'Cet événement et les suivants',
  );
  await page.waitForFunction(() => [...document.querySelectorAll('.fc-timegrid-event')].some((e) => /^\s*0?6:00/.test(e.textContent ?? '')));
  check('« Les suivants » change celui-ci et la suite, pas ce qui précède', (await seriesWeek(page)) === '07:00 07:00 07:00 07:00 06:00 06:00 06:00', await seriesWeek(page));
  check('… et l’occurrence modifiée à part avant la coupure le reste', (await dayColumn(page, weekDay(2)).textContent())?.includes('Méditation longue') ?? false);

  await deleteOccurrence(page, weekDay(1), 'Cet événement');
  await dayColumn(page, weekDay(1)).locator('.fc-timegrid-event', { hasText: 'Méditation' }).waitFor({ state: 'detached' });
  check('Supprimer « cet événement » n’en retire qu’un', (await seriesWeek(page)) === '07:00 - 07:00 07:00 06:00 06:00 06:00', await seriesWeek(page));

  // Changer la règle ne peut pas valoir pour une seule occurrence.
  await dayColumn(page, weekDay(5)).locator('.fc-timegrid-event', { hasText: 'Méditation' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.locator('#calendrier-interval').fill('2');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-scope');
  check(
    'Changer la répétition ne propose pas « cet événement » seul',
    (await page.locator('.calendrier-scope').getByRole('button', { name: 'Cet événement', exact: true }).count()) === 0 &&
      (await page.locator('.calendrier-scope').getByRole('button', { name: 'Tous les événements' }).isVisible()),
  );
  await page.keyboard.press('Escape');
  check('Échap ferme la question sans fermer la fenêtre', (await page.locator('.calendrier-scope').count()) === 0 && (await page.locator('.calendrier-editor').isVisible()));
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });

  // Glisser une occurrence : la même question, et « cet événement » la déplace seule.
  const monday = dayColumn(page, weekDay(0)).locator('.fc-timegrid-event', { hasText: 'Méditation' });
  await monday.scrollIntoViewIfNeeded();
  const from = await monday.boundingBox();
  const target = await page.locator('.fc-timegrid-slot-lane[data-time="08:00:00"]').boundingBox();
  if (from && target) {
    await page.mouse.move(from.x + from.width / 2, from.y + 5);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + 20, { steps: 4 });
    await page.mouse.move(from.x + from.width / 2, target.y + 5, { steps: 10 });
    await page.mouse.up();
  }
  const askedToMove = await page.waitForSelector('.calendrier-scope', { timeout: 3000 }).then(() => true, () => false);
  check('Glisser une occurrence demande laquelle déplacer', askedToMove && (await page.locator('.calendrier-scope').textContent())?.includes('Déplacer'));
  if (askedToMove) {
    await page.locator('.calendrier-scope').getByRole('button', { name: 'Cet événement', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.fc-timegrid-event')].some((e) => /^\s*0?8:00/.test(e.textContent ?? '')));
  }
  check('… et « cet événement » ne déplace que lui', (await seriesWeek(page)) === '08:00 - 07:00 07:00 06:00 06:00 06:00', await seriesWeek(page));

  await deleteOccurrence(page, weekDay(5), 'Tous les événements');
  await page.locator('.fc-timegrid-event', { hasText: 'Méditation' }).first().waitFor({ state: 'detached' }).catch(() => {});
  check(
    'Supprimer « tous les événements » retire la série qu’on a touchée, pas celle qu’on en a détachée',
    (await seriesWeek(page)) === '08:00 - 07:00 07:00 - - -',
    await seriesWeek(page),
  );

  // --- Tous les jours sauf le samedi et le dimanche (28/09/2026) ------------------------------
  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.locator('#calendrier-title').fill('Standup');
  await page.locator('#calendrier-start-day').fill(weekDay(0));
  await page.locator('#calendrier-end-day').fill(weekDay(0));
  await page.locator('#calendrier-start-time').fill('09:00');
  await page.locator('#calendrier-end-time').fill('09:15');
  await page.locator('#calendrier-repeat').selectOption('daily');
  await page.getByRole('button', { name: 'samedi' }).click();
  await page.getByRole('button', { name: 'dimanche' }).click();
  check(
    'Tous les jours, samedi et dimanche éteints : « Tous les jours sauf le samedi et le dimanche »',
    (await text(page.locator('.calendrier-recurrence-summary'))).includes('Tous les jours sauf le samedi et le dimanche'),
  );
  check('… que le menu reconnaît comme « jours ouvrés »', (await page.locator('#calendrier-repeat').inputValue()) === 'workdays');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });
  await dayColumn(page, weekDay(0)).locator('.fc-timegrid-event', { hasText: 'Standup' }).waitFor();
  const standup = [];
  for (let i = 0; i < 7; i++) standup.push(await dayColumn(page, weekDay(i)).locator('.fc-timegrid-event', { hasText: 'Standup' }).count());
  check('La série est là du lundi au vendredi, pas le week-end', standup.join('') === '1111100', standup.join(''));

  await page.getByRole('button', { name: 'Nouvel événement' }).click();
  await page.waitForSelector('.calendrier-editor');
  await page.locator('#calendrier-repeat').selectOption('monthly');
  const monthlyChoices = await page.locator('#calendrier-monthly option').allTextContents();
  check('Chaque mois : par date, ou par rang (« le 2e mardi de chaque mois »)', monthlyChoices.length >= 2 && monthlyChoices.some((c) => /le (1er|\de|dernier) \p{L}+ de chaque mois/u.test(c)), monthlyChoices.join(' | '));
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForSelector('.calendrier-editor', { state: 'detached' });

  // --- Les vues ----------------------------------------------------------------------------
  await page.locator('.fc-timeGridDay-button').click();
  check('Vue Jour', await page.locator('.fc-timeGridDay-view').isVisible());
  await page.locator('.fc-listWeek-button').click();
  check('Vue Agenda : la liste de la semaine', (await page.locator('.fc-list').textContent())?.includes('Dentiste (Dr Martin)') ?? false);
  await page.locator('.fc-dayGridMonth-button').click();
  check('Vue Mois', await page.locator('.fc-dayGridMonth-view').isVisible());
  check('Le mois montre l’événement horaire', (await page.locator('.fc-event', { hasText: 'Dentiste (Dr Martin)' }).count()) > 0);

  // --- Après un rechargement -------------------------------------------------------------------
  await openEclipse(page, BASE);
  check('La dernière vue choisie est retenue', await page.locator('.fc-dayGridMonth-view').isVisible());
  check(
    'Les événements sont toujours là après un rechargement',
    (await page.locator('.fc-event', { hasText: 'Dentiste (Dr Martin)' }).count()) > 0 &&
      (await page.locator('.fc-event', { hasText: 'Séjour à Lisbonne' }).count()) > 0,
  );
  check('Aucune erreur JavaScript sur ordinateur', errors.length === 0, errors.join(' | '));

  await page.getByRole('button', { name: 'Modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('« Modules » ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());
  await context.close();

  // --- Les calques des autres modules (étape 5) ---------------------------------------------
  // Seule entorse assumée à « une suite ne connaît pas un autre module » : le
  // lien est l'objet même de l'étape, comme la suite de Comète entre dans
  // Astra. Les données sont posées dans le stockage local plutôt que saisies
  // à travers quatre écrans, dans un contexte à part.
  const layered = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const lp = await layered.newPage();
  const layerErrors = [];
  lp.on('pageerror', (e) => layerErrors.push(e.message));
  await lp.goto(BASE);
  await lp.evaluate((today) => {
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    Object.assign(raw, {
      goals: [{ id: 'g1', title: 'Courir un marathon', description: '', emoji: '🏃', position: 0, archived: false, createdAt: '2026-01-01', tiers: [] }],
      actions: [{ id: 'a1', goalId: 'g1', title: 'Course', pp: 20, position: 0, archived: false, createdAt: '2026-01-01', unit: 'km', defaultValue: 8, isMeasure: false }],
      checkins: [{ id: 'c1', goalId: 'g1', actionId: 'a1', pp: 20, day: today, note: '', createdAt: '2026-01-01', value: 10.5, title: null }],
      flashcardsDecks: [{ id: 'd1', name: 'Anglais', emoji: '', position: 0, archived: false, createdAt: '' }],
      flashcardsCards: [1, 2].map((i) => ({ id: `k${i}`, deckId: 'd1', front: 'a', back: 'b', box: 1, dueDay: today, createdAt: '' })),
      flashcardsReviews: [],
      coursesTrips: [{ id: 't1', number: 1, day: today, storeId: null, storeName: 'Lidl', totalCents: 5420, note: '', createdAt: '' }],
      budgetCategories: [],
      budgetEntries: [{ id: 'b1', day: today, label: 'Boulangerie', amountCents: -1250, categoryId: null, source: 'manuelle', importKey: null, note: '', createdAt: '' }],
      tachesTasks: [
        { id: 'p1', listId: null, parentId: null, title: 'Rendre le livre', note: '', plannedDay: today, plannedTime: null, dueDay: null, priority: 'normale', recurrence: null, repeatFrom: 'schedule', position: 0, completedAt: null, createdAt: '' },
        { id: 'p2', listId: null, parentId: null, title: 'Appeler le garage', note: '', plannedDay: today, plannedTime: '14:00', durationMinutes: 90, dueDay: null, priority: 'urgente', recurrence: null, repeatFrom: 'schedule', position: 1, completedAt: null, createdAt: '' },
        { id: 'p3', listId: null, parentId: null, title: 'Faire les courses', note: '', plannedDay: today, plannedTime: null, dueDay: null, priority: 'normale', recurrence: { freq: 'weekly', interval: 1 }, repeatFrom: 'schedule', position: 2, completedAt: null, createdAt: '' },
      ],
    });
    localStorage.setItem('palier.v1', JSON.stringify(raw));
  }, day(0));
  await openEclipse(lp, BASE);
  const chips = await lp.locator('.calendrier-layer-chip').allTextContents();
  check('Un calque par module qui en déclare un', ['Zénith', 'Astra', 'Orbite', 'Comète', 'Polaris'].every((l) => chips.some((c) => c.includes(l))), chips.join(' | '));
  const pressed = async (label) => lp.locator('.calendrier-layer-chip', { hasText: label }).getAttribute('aria-pressed');
  check('Zénith, Orbite et Comète s’affichent d’office, Astra non', (await pressed('Zénith')) === 'true' && (await pressed('Orbite')) === 'true' && (await pressed('Comète')) === 'true' && (await pressed('Astra')) === 'false');

  const zenithMark = lp.locator('.calendrier-layer', { hasText: 'Course 10,5 km' });
  await zenithMark.first().waitFor();
  check('Zénith : ce qui a été fait, avec la quantité', await zenithMark.first().isVisible());
  check('Orbite : les cartes à réviser', await lp.locator('.calendrier-layer', { hasText: '2 cartes à réviser' }).first().isVisible());
  check('Comète : la course, magasin et total', ((await lp.locator('.calendrier-layer', { hasText: 'Lidl' }).first().textContent()) ?? '').replace(/\s/g, ' ').includes('Lidl · 54,20 €'));
  check('Astra, masqué, ne montre rien', (await lp.locator('.calendrier-layer', { hasText: 'dépensés' }).count()) === 0);
  check('Une marque dit d’où elle vient au survol', (await zenithMark.first().getAttribute('title')) === 'Zénith — Courir un marathon');

  await zenithMark.first().click();
  await lp.locator('.calendrier-mark-dialog').waitFor();
  check(
    'Toucher une marque ouvre sa fenêtre, avec son détail — pas celle d’un événement',
    (await lp.locator('.calendrier-editor').count()) === 0 && (await text(lp.locator('.calendrier-mark-dialog'))).includes('Courir un marathon'),
  );
  check('Une marque qui ne se coche pas n’a ni case ni « Modifier dans… »', (await lp.locator('.calendrier-mark-dialog .modal-foot button').count()) === 0);
  await lp.keyboard.press('Escape');
  await lp.locator('.calendrier-mark-dialog').waitFor({ state: 'detached' });

  // Polaris (étape 6 de Polaris) : les tâches, à cocher depuis le calendrier.
  const book = lp.locator('.calendrier-layer', { hasText: 'Rendre le livre' }).first();
  await book.waitFor();
  check('Polaris : une tâche du jour, avec son rond à cocher', (await book.getByRole('checkbox', { name: 'Cocher « Rendre le livre »' }).count()) === 1);
  check(
    'Polaris : une tâche à une heure se place dans la grille horaire',
    (await lp.locator('.fc-timegrid-event.calendrier-layer', { hasText: 'Appeler le garage' }).count()) === 1,
  );
  check(
    '… pour sa durée : 14 h – 15 h 30',
    (await text(lp.locator('.fc-timegrid-event.calendrier-layer', { hasText: 'Appeler le garage' }))).includes('15:30'),
  );

  // Glisser une tâche à 16 h, puis l'étirer d'une heure : Polaris la reprévoit (28/09/2026).
  {
    const task = (id) => lp.evaluate((tid) => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.id === tid), id);
    const garageEvent = lp.locator('.fc-timegrid-event.calendrier-layer', { hasText: 'Appeler le garage' });
    await garageEvent.scrollIntoViewIfNeeded();
    const g = await garageEvent.boundingBox();
    const lane16 = await lp.locator('.fc-timegrid-slot-lane[data-time="16:00:00"]').boundingBox();
    if (g && lane16) {
      await lp.mouse.move(g.x + g.width / 2, g.y + 3);
      await lp.mouse.down();
      await lp.mouse.move(g.x + g.width / 2, g.y + 20, { steps: 4 });
      await lp.mouse.move(g.x + g.width / 2, lane16.y + 3, { steps: 12 });
      await lp.mouse.up();
    }
    await lp.waitForFunction(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.id === 'p2')?.plannedTime === '16:00', null, { timeout: 4000 }).catch(() => {});
    const moved = await task('p2');
    check('Glisser une tâche dans la grille la reprévoit à 16 h, sa durée gardée', moved?.plannedTime === '16:00' && moved?.durationMinutes === 90, JSON.stringify(moved));
    await lp.locator('.calendrier-mark-dialog').waitFor({ state: 'detached', timeout: 500 }).catch(() => {});
    check('… sans ouvrir sa fenêtre', (await lp.locator('.calendrier-mark-dialog').count()) === 0);

    const moved16 = lp.locator('.fc-timegrid-event.calendrier-layer', { hasText: 'Appeler le garage' });
    await moved16.hover();
    const resizer = await moved16.locator('.fc-event-resizer-end').boundingBox();
    const slotH = (await lp.locator('.fc-timegrid-slot-lane[data-time="16:00:00"]').boundingBox())?.height ?? 17;
    if (resizer) {
      await lp.mouse.move(resizer.x + resizer.width / 2, resizer.y + resizer.height / 2);
      await lp.mouse.down();
      await lp.mouse.move(resizer.x + resizer.width / 2, resizer.y + resizer.height / 2 + slotH * 2, { steps: 10 });
      await lp.mouse.up();
    }
    await lp.waitForFunction(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.id === 'p2')?.durationMinutes === 150, null, { timeout: 4000 }).catch(() => {});
    check('Étirer son bord du bas allonge sa durée (1 h 30 → 2 h 30)', (await task('p2'))?.durationMinutes === 150, JSON.stringify(await task('p2')));
  }

  // Toucher la tâche ailleurs que sur son rond : sa fenêtre, sans la cocher.
  await book.locator('.calendrier-mark-title').click();
  await lp.locator('.calendrier-mark-dialog').waitFor();
  const dialog = await text(lp.locator('.calendrier-mark-dialog'));
  check('Toucher une tâche ouvre sa fenêtre : titre, source, à faire', dialog.includes('Rendre le livre') && dialog.includes('Polaris') && dialog.includes('À faire'), dialog);
  check('… sans la cocher', await lp.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.id === 'p1')?.completedAt === null));
  check('… ni ouvrir la fenêtre d’un événement', (await lp.locator('.calendrier-editor').count()) === 0);
  await lp.keyboard.press('Escape');
  await lp.locator('.calendrier-mark-dialog').waitFor({ state: 'detached' });

  // Le rond, lui, coche.
  await book.getByRole('checkbox', { name: 'Cocher « Rendre le livre »' }).click();
  await lp.locator('.calendrier-layer-done', { hasText: 'Rendre le livre' }).first().waitFor();
  check('Toucher le rond coche la tâche dans le calendrier…', (await lp.getByRole('checkbox', { name: 'Décocher « Rendre le livre »' }).count()) > 0);
  check(
    '… et vraiment dans Polaris',
    await lp.evaluate(() => JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks.find((t) => t.id === 'p1')?.completedAt !== null),
  );

  await lp.locator('.calendrier-layer-chip', { hasText: 'Astra' }).click();
  await lp.locator('.calendrier-layer', { hasText: 'dépensés' }).first().waitFor();
  check('Allumer Astra montre ce qui a été dépensé', ((await lp.locator('.calendrier-layer', { hasText: 'dépensés' }).first().textContent()) ?? '').includes('12,50 € dépensés'));
  await lp.locator('.calendrier-layer-chip', { hasText: 'Zénith' }).click();
  await zenithMark.first().waitFor({ state: 'detached' });
  check('Éteindre Zénith retire ses marques', (await zenithMark.count()) === 0);

  await openEclipse(lp, BASE);
  await lp.locator('.calendrier-layer', { hasText: 'dépensés' }).first().waitFor();
  check(
    'Le choix des calques est retenu après un rechargement',
    (await pressed('Astra')) === 'true' && (await pressed('Zénith')) === 'false' && (await zenithMark.count()) === 0,
  );
  // Une tâche répétée : la semaine suivante, sa prochaine fois en aperçu, en retrait et sans rond.
  await lp.locator('.fc-next-button').click();
  const forecast = lp.locator('.calendrier-layer-tentative', { hasText: 'Faire les courses' }).first();
  await forecast.waitFor();
  check('La semaine suivante montre la prochaine fois d’une tâche répétée, sans rond à cocher', (await forecast.getByRole('checkbox').count()) === 0);
  await forecast.click();
  await lp.locator('.calendrier-mark-dialog').waitFor();
  check('Sa fenêtre dit que c’est un aperçu, et propose de la modifier dans Polaris', (await text(lp.locator('.calendrier-mark-dialog'))).includes('Aperçu') && (await lp.getByRole('button', { name: 'Modifier dans Polaris' }).count()) === 1);
  await lp.keyboard.press('Escape');
  await lp.locator('.calendrier-mark-dialog').waitFor({ state: 'detached' });
  await lp.locator('.fc-today-button').click();

  // « Modifier dans Polaris » : Polaris s'ouvre sur la fenêtre de cette tâche.
  await lp.getByRole('button', { name: 'Polaris' }).first().waitFor();
  const garage = lp.locator('.calendrier-layer', { hasText: 'Appeler le garage' }).first();
  await garage.locator('.calendrier-mark-title').click();
  await lp.getByRole('button', { name: 'Modifier dans Polaris' }).click();
  await lp.locator('.taches-editor').waitFor();
  check('« Modifier dans Polaris » ouvre Polaris sur la fenêtre de la tâche', (await lp.locator('#taches-title').inputValue()) === 'Appeler le garage');
  check('Aucune erreur JavaScript avec les calques', layerErrors.length === 0, layerErrors.join(' | '));
  await layered.close();

  // --- Téléphone ------------------------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(e.message));
  await openEclipse(mobile, BASE);
  check('Sur téléphone, la vue Jour s’ouvre par défaut', await mobile.locator('.fc-timeGridDay-view').isVisible());
  check('Sur téléphone, les vues passent en bas de l’écran', await mobile.locator('.fc-footer-toolbar .fc-dayGridMonth-button').isVisible());
  check('Sur téléphone, rien ne déborde en largeur', await noOverflow(mobile));
  await mobile.getByRole('button', { name: 'Nouvel événement' }).click();
  await mobile.waitForSelector('.calendrier-editor');
  const editorBox = await mobile.locator('.calendrier-editor').boundingBox();
  check(
    'Sur téléphone, la fenêtre d’un événement tient dans l’écran',
    (await noOverflow(mobile)) && editorBox !== null && editorBox.x >= 0 && editorBox.x + editorBox.width <= 391,
  );
  await mobile.locator('#calendrier-title').fill('Café');
  await mobile.getByRole('button', { name: 'Enregistrer' }).click();
  await mobile.waitForSelector('.calendrier-editor', { state: 'detached' });
  await mobile.locator('.fc-footer-toolbar .fc-dayGridMonth-button').click();
  check('Sur téléphone, la vue Mois ne déborde pas', (await mobile.locator('.fc-dayGridMonth-view').isVisible()) && (await noOverflow(mobile)));
  check('Aucune erreur JavaScript sur téléphone', mobileErrors.length === 0, mobileErrors.join(' | '));
  await phone.close();
}
