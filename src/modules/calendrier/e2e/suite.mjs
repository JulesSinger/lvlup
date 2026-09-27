/**
 * Suite e2e du module calendrier (Éclipse).
 *
 * Étape 3 (docs/etude-calendrier.md §15) : la V1. Un vrai parcours —
 * FullCalendar chargé seulement à l'ouverture, vue semaine par défaut,
 * créer (horaire, journée entière sur plusieurs jours, glisser sur un
 * créneau), refuser une fin avant le début, modifier, supprimer, changer de
 * vue, retrouver le tout après un rechargement — plus le rendu téléphone.
 *
 * Les dates sont celles du jour de l'exécution : la vue semaine s'ouvre sur
 * la semaine en cours, c'est là que tout se passe.
 */

const pad = (n) => String(n).padStart(2, '0');
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
