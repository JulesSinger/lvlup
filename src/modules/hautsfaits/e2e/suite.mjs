/**
 * Suite e2e du module Hauts faits.
 *
 * Étape 3 (docs/etude-hauts-faits.md §16) : la frise sans photos. Un vrai
 * parcours — l'écran vide et ses idées, graver un haut fait à l'année près
 * puis au jour près, une période, la frise dans l'ordre récent avec les
 * années vides resserrées, la fiche, la date de naissance réglée dans le
 * panneau commun, « Ce jour-là », filtrer, modifier, refuser une date à
 * venir, supprimer, retrouver le tout après un rechargement — plus le rendu
 * téléphone.
 */

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');

async function openModule(page, BASE) {
  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Hauts faits/ }).click();
  await page.waitForSelector('.hautsfaits-empty, .hautsfaits-timeline');
}

const pad = (n) => String(n).padStart(2, '0');
function yearsAgo(years) {
  const d = new Date();
  return `${d.getFullYear() - years}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Les lignes de la frise, lues comme on les voit : années, resserrements, titres. */
async function frise(page) {
  return page.locator('.hautsfaits-timeline > li').evaluateAll((items) =>
    items.map((li) => {
      if (li.classList.contains('hautsfaits-year')) return li.querySelector('.hautsfaits-year-label').firstChild.textContent.trim();
      if (li.classList.contains('hautsfaits-gap')) return `… ${li.textContent.trim()}`;
      return li.querySelector('.hautsfaits-cover-title, .hautsfaits-line-title').textContent.trim();
    }),
  );
}

async function save(page) {
  await page.locator('.hautsfaits-editor button[type="submit"]').click();
  await page.waitForSelector('.hautsfaits-editor', { state: 'detached' });
}

async function openFeat(page, title) {
  await page.locator('.hautsfaits-card, .hautsfaits-line', { hasText: title }).first().click();
  await page.waitForSelector('.hautsfaits-sheet');
}

async function closeSheet(page) {
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.waitForSelector('.hautsfaits-sheet', { state: 'detached' });
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Hauts faits/ });
  check('La carte Hauts faits apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Hauts faits dit ce que fait le module', (await card.textContent())?.includes('grands moments') ?? false);
  await card.click();
  await page.waitForSelector('.hautsfaits-empty');
  check('L’écran vide explique et propose des idées', (await text(page.locator('.hautsfaits-empty'))).includes('l’année suffit') && (await page.locator('.hautsfaits-idea').count()) === 9);

  // --- Une idée : le bac, à l'année près ---------------------------------------------------------
  await page.locator('.hautsfaits-idea', { hasText: 'Baccalauréat' }).click();
  await page.waitForSelector('.hautsfaits-editor');
  check(
    'Une idée pré-remplit le titre, la catégorie et la précision',
    (await page.locator('#hautsfaits-title').inputValue()) === 'Baccalauréat' &&
      (await page.getByRole('button', { name: /Études/, pressed: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Année', pressed: true }).count()) === 1,
  );
  await page.locator('#hautsfaits-start-year').fill('');
  await page.locator('.hautsfaits-editor button[type="submit"]').click();
  check('Une année manquante est dite, et la fenêtre reste ouverte', (await text(page.locator('.hautsfaits-editor .notice.error'))).includes('Écris l’année'));
  await page.locator('#hautsfaits-start-year').fill('2017');
  await page.locator('#hautsfaits-highlight').fill('Mention Bien');
  await page.getByText('Un des grands').click();
  await save(page);
  check('Le bac est gravé en grande carte, son chiffre clé en médaillon', (await text(page.locator('.hautsfaits-card', { hasText: 'Baccalauréat' }))).includes('Mention Bien'));
  check('… avec sa cérémonie', (await page.locator('.hautsfaits-item.new').count()) === 1);

  // --- Au jour près, avec un récit ---------------------------------------------------------------
  await page.getByRole('button', { name: '＋ Haut fait' }).click();
  await page.locator('#hautsfaits-title').fill('Semi-marathon de Paris');
  await page.getByRole('button', { name: /Sport/ }).click();
  await page.locator('#hautsfaits-start-day').fill('2025-03-02');
  await page.locator('#hautsfaits-highlight').fill('1 h 52 min');
  await page.locator('#hautsfaits-place').fill('Paris');
  await page.locator('#hautsfaits-story').fill('Le mur au 17e kilomètre.');
  await save(page);

  // --- Une période, au mois près -----------------------------------------------------------------
  await page.getByRole('button', { name: '＋ Haut fait' }).click();
  await page.locator('#hautsfaits-title').fill('Six mois à Madrid');
  await page.getByRole('button', { name: /Voyage/ }).click();
  await page.getByRole('group', { name: 'Précision : date' }).getByRole('button', { name: 'Mois' }).click();
  await page.locator('#hautsfaits-start-month').selectOption('1');
  await page.locator('#hautsfaits-start-year').fill('2021');
  await page.getByText('C’est une période').click();
  check('Une période reprend la précision du début pour sa fin', (await page.getByRole('group', { name: 'Précision : fin' }).getByRole('button', { name: 'Mois', pressed: true }).count()) === 1);
  await page.locator('#hautsfaits-end-month').selectOption('6');
  await page.locator('#hautsfaits-end-year').fill('2021');
  await save(page);
  check('Une période se dit sans répéter l’année, avec sa durée', (await text(page.locator('.hautsfaits-line', { hasText: 'Madrid' }))).includes('janvier – juin 2021 · 6 mois'));

  check(
    'La frise : le plus récent en haut, les années vides resserrées',
    JSON.stringify(await frise(page)) ===
      JSON.stringify(['2025', 'Semi-marathon de Paris', '… 2022 – 2024', '2021', 'Six mois à Madrid', '… 2018 – 2020', '2017', 'Baccalauréat']),
    (await frise(page)).join(' | '),
  );
  check('L’en-tête compte les hauts faits et dit depuis quand', (await text(page.locator('.hautsfaits-count'))) === '3 hauts faits · depuis 2017');

  // --- Une date à venir est refusée --------------------------------------------------------------
  await page.getByRole('button', { name: '＋ Haut fait' }).click();
  await page.locator('#hautsfaits-title').fill('Marathon');
  await page.locator('#hautsfaits-start-day').fill(`${new Date().getFullYear() + 1}-04-01`);
  await page.locator('.hautsfaits-editor button[type="submit"]').click();
  check('Un haut fait à venir est refusé : c’est le rôle d’Objectifs', (await text(page.locator('.hautsfaits-editor .notice.error'))).includes('déjà arrivé'));
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForSelector('.hautsfaits-editor', { state: 'detached' });

  // --- La fiche, sans date de naissance ----------------------------------------------------------
  await openFeat(page, 'Semi-marathon');
  const sheet = page.locator('.hautsfaits-sheet');
  check('La fiche dit la date, le lieu et le récit', (await text(sheet)).includes('2 mars 2025 · Paris') && (await text(sheet)).includes('Le mur au 17e kilomètre.'));
  check('Sans date de naissance, la fiche propose de l’ajouter', (await text(sheet)).includes('Ajoute ta date de naissance'));
  await page.getByRole('button', { name: 'Ajoute ta date de naissance' }).click();

  // --- La date de naissance, dans le panneau commun ----------------------------------------------
  const settings = page.locator('.hautsfaits-settings');
  await settings.waitFor();
  await settings.getByLabel('Date de naissance').fill('1999-03-12');
  await page.locator('.modal-foot').getByRole('button', { name: 'Fermer' }).click();
  await settings.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('.hautsfaits-year-label small')?.textContent?.includes('26 ans'));
  check('La date de naissance donne l’âge atteint chaque année, sans recharger', (await text(page.locator('.hautsfaits-year-label').first())).includes('2025 · 26 ans'));
  check('… et l’âge de chaque haut fait, sans deviner quand on ne sait que l’année', (await text(page.locator('.hautsfaits-card', { hasText: 'Baccalauréat' }))).includes('l’année de tes 18 ans'));
  await openFeat(page, 'Semi-marathon');
  check('La fiche dit l’âge qu’on avait', (await text(page.locator('.hautsfaits-sheet-since'))).includes('tu avais 25 ans'));

  // --- Modifier ----------------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Modifier' }).click();
  await page.waitForSelector('.hautsfaits-editor');
  check('Modifier rouvre la fenêtre remplie', (await page.locator('#hautsfaits-start-day').inputValue()) === '2025-03-02');
  await page.locator('#hautsfaits-title').fill('Semi-marathon de Paris 2025');
  await save(page);
  check('La modification revient sur la fiche', (await text(page.locator('#hautsfaits-sheet-title'))) === 'Semi-marathon de Paris 2025');
  await closeSheet(page);

  // --- Ce jour-là --------------------------------------------------------------------------------
  await page.getByRole('button', { name: '＋ Haut fait' }).click();
  await page.locator('#hautsfaits-title').fill('Premier appartement');
  await page.getByRole('button', { name: /Chez-soi/ }).click();
  await page.locator('#hautsfaits-start-day').fill(yearsAgo(3));
  await save(page);
  check('« Ce jour-là » : un haut fait daté d’aujourd’hui, il y a 3 ans', (await text(page.locator('.hautsfaits-memory'))).includes('Il y a 3 ans aujourd’hui') && (await text(page.locator('.hautsfaits-memory'))).includes('Premier appartement'));
  await page.locator('.hautsfaits-memory').click();
  await page.waitForSelector('.hautsfaits-sheet');
  check('… et l’ouvre en un toucher', (await text(page.locator('#hautsfaits-sheet-title'))) === 'Premier appartement');
  await closeSheet(page);

  // --- Filtrer -----------------------------------------------------------------------------------
  await page.getByRole('group', { name: 'Filtrer par catégorie' }).getByRole('button', { name: /Études/ }).click();
  check('Filtrer ne garde que la catégorie choisie', JSON.stringify(await frise(page)) === JSON.stringify(['2017', 'Baccalauréat']));
  await page.getByRole('button', { name: 'Tout', exact: true }).click();

  // --- Supprimer ---------------------------------------------------------------------------------
  await openFeat(page, 'Premier appartement');
  await page.getByRole('button', { name: 'Supprimer…' }).click();
  check('Supprimer demande confirmation dans la fiche', (await text(page.locator('.hautsfaits-sheet-confirm'))).includes('pour de bon'));
  await page.getByRole('button', { name: 'Garder' }).click();
  await page.getByRole('button', { name: 'Supprimer…' }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForSelector('.hautsfaits-sheet', { state: 'detached' });
  check('… puis supprime', (await page.locator('.hautsfaits-line', { hasText: 'Premier appartement' }).count()) === 0 && (await page.locator('.hautsfaits-memory').count()) === 0);

  // --- Tout survit à un rechargement -------------------------------------------------------------
  await openModule(page, BASE);
  check('Après un rechargement, la frise et l’âge sont là', (await frise(page)).length === 8 && (await text(page.locator('.hautsfaits-year-label').first())).includes('26 ans'));
  check('Aucune erreur JavaScript sur ordinateur', errors.length === 0, errors.join(' | '));
  await context.close();

  // --- Téléphone ---------------------------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(e.message));
  await openModule(mobile, BASE);
  await mobile.getByRole('button', { name: '＋ Autre chose' }).click();
  await mobile.locator('#hautsfaits-title').fill('Un titre de haut fait assez long pour passer sur plusieurs lignes de la carte');
  await mobile.locator('#hautsfaits-highlight').fill('Mention Très bien avec les félicitations');
  await mobile.getByText('Un des grands').click();
  const box = await mobile.locator('.hautsfaits-editor').boundingBox();
  const noOverflow = () => mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check('Sur téléphone, la fenêtre tient dans l’écran', (await noOverflow()) && box !== null && box.x >= 0 && box.x + box.width <= 391);
  await save(mobile);
  check('Sur téléphone, la frise ne déborde pas, même avec un titre long', await noOverflow());
  check('Sur téléphone, l’axe passe à gauche : une seule colonne', (await mobile.locator('.hautsfaits-item').first().evaluate((el) => el.getBoundingClientRect().width)) > 300);
  await mobile.locator('.hautsfaits-card').first().click();
  await mobile.waitForSelector('.hautsfaits-sheet');
  const sheetBox = await mobile.locator('.hautsfaits-sheet').boundingBox();
  check('Sur téléphone, la fiche prend tout l’écran', sheetBox !== null && sheetBox.width >= 389 && (await noOverflow()));
  check('Aucune erreur JavaScript sur téléphone', mobileErrors.length === 0, mobileErrors.join(' | '));
  await phone.close();
}
