/**
 * Suite e2e du module Tier lists (docs/etude-tierlists.md) : créer une liste,
 * ajouter du texte et des images, glisser à la souris et au doigt, classer
 * sans glisser (« Envoyer à »), rangées renommées, recolorées, ajoutées,
 * supprimées, le rechargement, tout remettre à classer, supprimer.
 */

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();

/** Un vrai JPEG, dessiné dans le navigateur (même motif que Recettes). */
async function jpeg(page, hue) {
  const base64 = await page.evaluate((hue) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.fillRect(0, 0, 600, 600);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, hue);
  return Buffer.from(base64, 'base64');
}

const row = (page, label) =>
  page.locator('.tierlists-row').filter({ has: page.getByRole('button', { name: `Rangée ${label}, la modifier`, exact: true }) });
const tilesOf = async (locator) => (await locator.locator('.tierlists-tile').allTextContents()).map((t) => t.trim());
const reserve = (page) => page.locator('.tierlists-reserve');

/** Glisser à la souris une tuile vers un point d'une zone : au bout, ou juste avant une tuile. */
async function drag(page, source, target, where = 'end') {
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 6, { steps: 3 });
  const x = where === 'start' ? b.x + 3 : b.x + b.width - 8;
  await page.mouse.move(x, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function addText(page, label) {
  await page.getByLabel('Nouvel élément').fill(label);
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.locator('.tierlists-tile', { hasText: label }).first().waitFor();
}

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => void d.accept());
  await page.goto(BASE);
  await toHub(page);

  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Tier lists' });
  check('La carte Tier lists apparaît sur l’écran de choix', await card.isVisible());
  await card.click();
  await page.waitForSelector('.tierlists-empty');
  check('Sans liste, l’écran propose d’en créer une', (await text(page.locator('.tierlists-empty'))).includes('Créer une tier list'));

  // --- Créer --------------------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Créer une tier list' }).click();
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  check('Une liste sans titre est refusée, avec la raison', (await text(page.locator('.tierlists-modal .tierlists-error'))).includes('titre'));
  await page.locator('#tierlists-title').fill('Champions LoL');
  await page.locator('#tierlists-description').fill('Mes mains en mid');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await page.waitForSelector('.tierlists-board');
  const labels = await page.locator('.tierlists-row-label').allTextContents();
  check('La liste part des rangées S, A, B, C, D', labels.join(',') === 'S,A,B,C,D', labels.join(','));
  check(
    'Le titre et la description sont en haut',
    (await text(page.locator('.tierlists-board-title h1'))) === 'Champions LoL' && (await text(page.locator('.tierlists-board-title p'))) === 'Mes mains en mid',
  );

  // --- Ajouter ------------------------------------------------------------------------------------
  for (const name of ['Ahri', 'Jinx', 'Garen']) await addText(page, name);
  await page.locator('.tierlists-file').setInputFiles([{ name: 'Lux.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 200) }]);
  await page.waitForSelector('.tierlists-tile.has-image img.tierlists-img');
  check('Trois textes et une image attendent à classer', (await tilesOf(reserve(page))).join(',') === 'Ahri,Jinx,Garen,Lux', (await tilesOf(reserve(page))).join(','));
  check('L’image reprend le nom de son fichier', (await text(page.locator('.tierlists-tile.has-image'))) === 'Lux');
  check('Le compteur dit combien attendent', (await text(page.locator('.tierlists-count'))) === '4');

  // --- Glisser à la souris -----------------------------------------------------------------------
  await drag(page, page.locator('.tierlists-tile', { hasText: 'Ahri' }), row(page, 'S').locator('.tierlists-row-items'));
  check('Ahri glissé dans S', (await tilesOf(row(page, 'S'))).join(',') === 'Ahri');
  await drag(page, page.locator('.tierlists-tile', { hasText: 'Jinx' }), row(page, 'S').locator('.tierlists-tile', { hasText: 'Ahri' }), 'start');
  check('Jinx lâché avant Ahri prend sa place', (await tilesOf(row(page, 'S'))).join(',') === 'Jinx,Ahri', (await tilesOf(row(page, 'S'))).join(','));
  await drag(page, page.locator('.tierlists-tile', { hasText: 'Lux' }), row(page, 'A').locator('.tierlists-row-items'));
  check('Une image se glisse comme un texte', (await tilesOf(row(page, 'A'))).join(',') === 'Lux');
  check('Un simple glisser n’ouvre pas la tuile', (await page.locator('.tierlists-modal').count()) === 0);
  await drag(page, page.locator('.tierlists-tile', { hasText: 'Ahri' }), row(page, 'S').locator('.tierlists-tile', { hasText: 'Jinx' }), 'start');
  check('Dans la même rangée, l’ordre se change', (await tilesOf(row(page, 'S'))).join(',') === 'Ahri,Jinx');

  // --- Classer sans glisser ----------------------------------------------------------------------
  await page.locator('.tierlists-tile', { hasText: 'Garen' }).click();
  await page.waitForSelector('.tierlists-modal');
  await page.locator('.tierlists-send').getByRole('button', { name: 'B', exact: true }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('« Envoyer à » range Garen dans B', (await tilesOf(row(page, 'B'))).join(',') === 'Garen');
  check('Tout est classé', (await text(reserve(page))).includes('Tout est classé'));

  // --- Renommer un élément -----------------------------------------------------------------------
  await page.locator('.tierlists-tile', { hasText: 'Lux' }).click();
  await page.locator('#tierlists-item-label').fill('Lux (support)');
  await page.locator('.tierlists-modal').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Un élément se renomme', (await tilesOf(row(page, 'A'))).join(',') === 'Lux (support)');

  // --- Les rangées --------------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Rangée S, la modifier', exact: true }).click();
  await page.locator('#tierlists-tier-label').fill('Top');
  await page.getByRole('radio', { name: 'Violet' }).click();
  await page.locator('.tierlists-modal').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Une rangée se renomme et garde ses éléments', (await tilesOf(row(page, 'Top'))).join(',') === 'Ahri,Jinx');
  const color = await row(page, 'Top').evaluate((el) => el.style.getPropertyValue('--tierlists-color'));
  check('Une rangée se recolore', color.includes('--violet'), color);

  await page.getByRole('button', { name: '+ Ajouter une rangée' }).click();
  await page.locator('.tierlists-modal').getByRole('button', { name: 'Ajouter' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Une rangée s’ajoute en bas', (await page.locator('.tierlists-row-label').allTextContents()).join(',') === 'Top,A,B,C,D,F');

  await page.getByRole('button', { name: 'Rangée D, la modifier', exact: true }).click();
  await page.locator('.tierlists-modal').getByRole('button', { name: '↑ Monter' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Une rangée se déplace', (await page.locator('.tierlists-row-label').allTextContents()).join(',') === 'Top,A,B,D,C,F');

  await page.getByRole('button', { name: 'Rangée B, la modifier', exact: true }).click();
  await page.locator('.tierlists-modal').getByRole('button', { name: 'Supprimer la rangée' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Supprimer une rangée renvoie ses éléments à classer', (await tilesOf(reserve(page))).join(',') === 'Garen');

  // --- Rechargement ------------------------------------------------------------------------------
  await page.reload();
  await page.locator('.tierlists-card', { hasText: 'Champions LoL' }).click();
  await page.waitForSelector('.tierlists-board');
  await page.waitForSelector('.tierlists-tile.has-image img.tierlists-img');
  check(
    'Après un rechargement, tout est à sa place',
    (await tilesOf(row(page, 'Top'))).join(',') === 'Ahri,Jinx' && (await tilesOf(row(page, 'A'))).join(',') === 'Lux (support)' && (await tilesOf(reserve(page))).join(',') === 'Garen',
  );

  // --- Tout remettre, supprimer ------------------------------------------------------------------
  await page.getByRole('button', { name: '✎ Modifier' }).click();
  await page.getByRole('button', { name: '↺ Tout remettre à classer' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Tout remettre à classer vide les rangées, dans l’ordre', (await tilesOf(reserve(page))).join(',') === 'Ahri,Jinx,Lux (support),Garen', (await tilesOf(reserve(page))).join(','));

  await page.locator('.tierlists-tile', { hasText: 'Garen' }).click();
  await page.locator('.tierlists-modal').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForSelector('.tierlists-modal', { state: 'detached' });
  check('Un élément se supprime', !(await tilesOf(reserve(page))).includes('Garen'));

  await page.getByRole('button', { name: '← Mes tier lists' }).click();
  check('La grille montre la liste', (await text(page.locator('.tierlists-card'))).includes('Champions LoL'));
  await page.locator('.tierlists-card').click();
  await page.getByRole('button', { name: '✎ Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer la tier list' }).click();
  await page.waitForSelector('.tierlists-empty');
  check('Une liste se supprime avec tout ce qu’elle contient', (await page.locator('.tierlists-card').count()) === 0);
  check('Aucune erreur dans la page (ordinateur)', errors.length === 0, errors.join(' | '));
  await context.close();

  // --- Au doigt, sur un téléphone ----------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(String(e)));
  await mobile.goto(BASE);
  await toHub(mobile);
  await mobile.locator('.hub-picker-card', { hasText: 'Tier lists' }).click();
  await mobile.getByRole('button', { name: 'Créer une tier list' }).click();
  await mobile.locator('#tierlists-title').fill('Burgers');
  await mobile.getByRole('button', { name: 'Créer', exact: true }).click();
  await mobile.waitForSelector('.tierlists-board');
  await addText(mobile, 'Big Fernand');
  const width = await mobile.evaluate(() => document.documentElement.scrollWidth);
  check('Sur téléphone, rien ne dépasse en largeur', width <= 390, `${width}px`);

  const cdp = await phone.newCDPSession(mobile);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tile = await mobile.locator('.tierlists-tile', { hasText: 'Big Fernand' }).boundingBox();
  const target = await row(mobile, 'A').locator('.tierlists-row-items').boundingBox();
  const from = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
  const to = { x: target.x + target.width - 20, y: target.y + target.height / 2 };

  // Glisser tout de suite : c'est défiler, la tuile ne part pas.
  await touch('touchStart', from.x, from.y);
  for (let k = 1; k <= 6; k++) await touch('touchMove', from.x, from.y - k * 12);
  await touch('touchEnd');
  await mobile.waitForTimeout(150);
  check('Au doigt, glisser sans tenir ne déplace rien', (await tilesOf(reserve(mobile))).join(',') === 'Big Fernand');

  // Tenir, puis glisser : la tuile suit le doigt.
  const again = await mobile.locator('.tierlists-tile', { hasText: 'Big Fernand' }).boundingBox();
  const start = { x: again.x + again.width / 2, y: again.y + again.height / 2 };
  const end = await row(mobile, 'A').locator('.tierlists-row-items').boundingBox();
  await touch('touchStart', start.x, start.y);
  await mobile.waitForTimeout(400);
  const steps = 12;
  for (let k = 1; k <= steps; k++) {
    await touch('touchMove', start.x + ((end.x + end.width - 20 - start.x) * k) / steps, start.y + ((end.y + end.height / 2 - start.y) * k) / steps);
  }
  check('Pendant le glisser, la tuile suit le doigt', (await mobile.locator('.tierlists-ghost').count()) === 1);
  await touch('touchEnd');
  await mobile.waitForTimeout(150);
  check('Au doigt, tenir puis glisser range la tuile', (await tilesOf(row(mobile, 'A'))).join(',') === 'Big Fernand', JSON.stringify(to));
  check('Aucune erreur dans la page (téléphone)', mobileErrors.length === 0, mobileErrors.join(' | '));
  await phone.close();
}
