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
 *
 * Étape 4 (§17) : les photos, avec de vrais JPEG fabriqués dans le
 * navigateur (l'un porte une date EXIF) et les vrais sélecteurs de fichiers —
 * choisir à la création, la date de la photo proposée, la couverture dans la
 * frise, la visionneuse, changer de couverture, retirer, ajouter depuis la
 * fiche, et les fichiers qui partent avec leur haut fait.
 */

/**
 * Rouvre Atlas sur la liste des modules, par un vrai rechargement. Depuis le
 * 30/09/2026, Atlas rouvre le dernier module ouvert (et l'adresse le garde) :
 * on passe donc l'adresse à `#/`, la liste, avant de recharger.
 */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');

async function openModule(page, BASE) {
  await page.goto(BASE);
  await toHub(page);
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

/** Un vrai JPEG, dessiné dans le navigateur : un dégradé et un disque, à la teinte donnée. */
async function jpeg(page, hue, { width = 1600, height = 1200 } = {}) {
  const base64 = await page.evaluate(
    ([hue, width, height]) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, `hsl(${hue}, 70%, 35%)`);
      g.addColorStop(1, `hsl(${hue + 60}, 70%, 60%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `hsl(${hue + 180}, 80%, 70%)`;
      ctx.beginPath();
      ctx.arc(width * 0.7, height * 0.4, height * 0.2, 0, Math.PI * 2);
      ctx.fill();
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    [hue, width, height],
  );
  return Buffer.from(base64, 'base64');
}

/** Glisse un segment EXIF (DateTimeOriginal) juste après le début d'un JPEG, comme un appareil photo. */
function withExifDate(buffer, date) {
  const le16 = (v) => [v & 0xff, v >> 8];
  const le32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
  const text = [...date].map((c) => c.charCodeAt(0)).concat(0);
  // En-tête TIFF (8), IFD0 à 8 avec le pointeur vers l'IFD Exif (18), IFD Exif à 26 (18), la date à 44.
  const tiff = [0x49, 0x49, ...le16(42), ...le32(8), ...le16(1), ...le16(0x8769), ...le16(4), ...le32(1), ...le32(26), ...le32(0)];
  tiff.push(...le16(1), ...le16(0x9003), ...le16(2), ...le32(20), ...le32(44), ...le32(0), ...text);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const segment = Buffer.from([0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1]);
  return Buffer.concat([buffer.subarray(0, 2), segment, buffer.subarray(2)]);
}

const file = (name, buffer) => ({ name, mimeType: 'image/jpeg', buffer });

/** Le nombre d'images rangées dans IndexedDB (grandes versions et miniatures). */
const storedImages = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('atlas-hautsfaits');
        request.onsuccess = () => {
          const count = request.result.transaction('photos').objectStore('photos').count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );

/** Attend la fin d'un envoi de photos. */
async function uploaded(page) {
  await page.waitForSelector('.hautsfaits-toast', { state: 'detached' });
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
  await toHub(page);
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

  // --- Les photos (étape 4) ----------------------------------------------------------------------
  const blue = await jpeg(page, 210);
  const sunset = withExifDate(await jpeg(page, 20), '2023:06:17 15:30:00');
  await page.getByRole('button', { name: '＋ Haut fait' }).click();
  await page.locator('#hautsfaits-title').fill('Mariage de Léa');
  await page.getByRole('button', { name: /Famille & amis/ }).click();
  await page.getByText('Un des grands').click();
  await page.locator('.hautsfaits-editor input[type="file"]').setInputFiles([file('ciel.jpg', blue), file('soir.jpg', sunset)]);
  await page.waitForFunction(() => document.querySelectorAll('.hautsfaits-pending li').length === 2);
  check('À la création, les photos choisies s’affichent avant d’enregistrer', (await page.locator('.hautsfaits-pending img').count()) === 2);
  check('La date lue dans une photo est proposée', (await text(page.locator('.hautsfaits-date-suggestion'))).includes('Photo prise le 17 juin 2023'));
  await page.getByRole('button', { name: 'Utiliser cette date' }).click();
  check('… et la prendre remplit la date', (await page.locator('#hautsfaits-start-day').inputValue()) === '2023-06-17' && (await page.locator('.hautsfaits-date-suggestion').count()) === 0);
  await save(page);
  await uploaded(page);
  const mariage = page.locator('.hautsfaits-card', { hasText: 'Mariage de Léa' });
  await mariage.locator('.hautsfaits-cover.has-photo img').waitFor();
  const coverWidth = await mariage.locator('.hautsfaits-cover img').evaluate((img) => img.complete && img.naturalWidth);
  check('La première photo fait la couverture de la carte, en miniature', coverWidth === 720, `largeur ${coverWidth}`);
  check('La carte dit combien de photos', (await text(mariage)).includes('2 photos'));
  check('Deux images par photo, rangées dans IndexedDB', (await storedImages(page)) === 4);
  const exifKept = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('atlas-hautsfaits');
        request.onsuccess = () => {
          const all = request.result.transaction('photos').objectStore('photos').getAll();
          all.onsuccess = async () => {
            const texts = await Promise.all(all.result.map(async (blob) => new TextDecoder('latin1').decode(await blob.arrayBuffer())));
            resolve(texts.some((t) => t.includes('Exif') || t.includes('2023:06:17')));
          };
        };
      }),
  );
  check('Les copies rangées n’ont plus de métadonnées (date d’origine, position GPS)', exifKept === false);

  await openFeat(page, 'Mariage de Léa');
  const gallery = page.locator('.hautsfaits-gallery');
  check('La fiche montre la galerie, la couverture marquée', (await gallery.locator('.hautsfaits-gallery-thumb').count()) === 2 && (await text(gallery.locator('.hautsfaits-gallery-item').first())).includes('Couverture'));
  // L'image d'origine fait 1 600 px : la grande version la garde telle quelle, jamais agrandie.
  await page.waitForFunction(() => document.querySelector('.hautsfaits-sheet .hautsfaits-cover img')?.naturalWidth === 1600);
  check('La couverture de la fiche passe à la grande version, sans l’agrandir', true);
  const secondSrc = await gallery.locator('.hautsfaits-gallery-thumb img').nth(1).getAttribute('src');
  await gallery.getByRole('button', { name: 'Voir la photo 2' }).click();
  const lightbox = page.locator('.hautsfaits-lightbox');
  await lightbox.waitFor();
  check('Toucher une photo ouvre la visionneuse', (await text(lightbox.locator('.hautsfaits-lightbox-count'))) === '2 / 2');
  await page.keyboard.press('ArrowRight');
  check('Les flèches passent d’une photo à l’autre', (await text(lightbox.locator('.hautsfaits-lightbox-count'))) === '1 / 2');
  await page.keyboard.press('Escape');
  await lightbox.waitFor({ state: 'detached' });
  check('Échap ferme la visionneuse, pas la fiche', await page.locator('.hautsfaits-sheet').isVisible());

  await gallery.getByRole('button', { name: 'Arranger' }).click();
  await gallery.getByRole('button', { name: 'En couverture' }).click();
  await page.waitForFunction((src) => document.querySelector('.hautsfaits-gallery-thumb img')?.getAttribute('src') === src, secondSrc);
  check('« En couverture » fait passer une photo en tête', (await gallery.locator('.hautsfaits-gallery-thumb img').first().getAttribute('src')) === secondSrc);
  await gallery.getByRole('button', { name: 'Retirer', exact: true }).nth(1).click();
  check('Retirer demande un second toucher', (await gallery.getByRole('button', { name: 'Retirer pour de bon' }).count()) === 1 && (await gallery.locator('.hautsfaits-gallery-thumb').count()) === 2);
  await gallery.getByRole('button', { name: 'Retirer pour de bon' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.hautsfaits-gallery-thumb').length === 1);
  check('… puis retire la photo et ses deux fichiers', (await storedImages(page)) === 2);
  await gallery.locator('input[type="file"]').setInputFiles([file('vert.jpg', await jpeg(page, 120)), file('rose.jpg', await jpeg(page, 320, { width: 900, height: 1400 }))]);
  await uploaded(page);
  await page.waitForFunction(() => document.querySelectorAll('.hautsfaits-gallery-thumb').length === 3);
  check('Ajouter des photos depuis la fiche, à la suite', (await text(page.locator('.hautsfaits-card', { hasText: 'Mariage de Léa' }))).includes('3 photos'));
  await closeSheet(page);

  await openFeat(page, 'Premier appartement');
  await page.locator('.hautsfaits-sheet input[type="file"]').setInputFiles([file('cles.jpg', await jpeg(page, 45))]);
  await uploaded(page);
  await page.locator('.hautsfaits-sheet .hautsfaits-gallery-thumb').waitFor();
  check('Une ligne compacte montre sa photo en pastille', (await page.locator('.hautsfaits-line', { hasText: 'Premier appartement' }).locator('.hautsfaits-badge.has-photo img').count()) === 1);
  const beforeDelete = await storedImages(page);
  await closeSheet(page);

  // --- Supprimer ---------------------------------------------------------------------------------
  await openFeat(page, 'Premier appartement');
  await page.getByRole('button', { name: 'Supprimer…' }).click();
  check('Supprimer demande confirmation dans la fiche', (await text(page.locator('.hautsfaits-sheet-confirm'))).includes('pour de bon'));
  await page.getByRole('button', { name: 'Garder' }).click();
  await page.getByRole('button', { name: 'Supprimer…' }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.waitForSelector('.hautsfaits-sheet', { state: 'detached' });
  check('… puis supprime', (await page.locator('.hautsfaits-line', { hasText: 'Premier appartement' }).count()) === 0 && (await page.locator('.hautsfaits-memory').count()) === 0);
  check('Supprimer un haut fait emporte les fichiers de ses photos, pas ceux des autres', beforeDelete === 8 && (await storedImages(page)) === 6, `${beforeDelete} → ${await storedImages(page)}`);

  // --- Tout survit à un rechargement -------------------------------------------------------------
  await openModule(page, BASE);
  check(
    'Après un rechargement, la frise et l’âge sont là',
    JSON.stringify(await frise(page)) ===
      JSON.stringify(['2025', 'Semi-marathon de Paris 2025', '… 2024', '2023', 'Mariage de Léa', '… 2022', '2021', 'Six mois à Madrid', '… 2018 – 2020', '2017', 'Baccalauréat']) &&
      (await text(page.locator('.hautsfaits-year-label').first())).includes('26 ans'),
    (await frise(page)).join(' | '),
  );
  await page.locator('.hautsfaits-card', { hasText: 'Mariage de Léa' }).locator('.hautsfaits-cover.has-photo img').waitFor();
  check('… et les photos aussi', (await page.locator('.hautsfaits-card', { hasText: 'Mariage de Léa' }).locator('.hautsfaits-cover img').evaluate((img) => img.naturalWidth)) > 0);
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
