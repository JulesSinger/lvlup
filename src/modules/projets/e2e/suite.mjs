/**
 * Suite e2e du module Projets.
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-projets.md` §10).
 * Ces vérifications ne portent que sur ce que l'étape livre réellement — la
 * carte du module sur l'écran de choix, l'écran qu'elle ouvre, et le chemin
 * vers les autres modules depuis son nom.
 */

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);
  await toHub(page);

  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Projets' });
  check('La carte Projets apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Projets dit ce que fait le module', (await card.textContent())?.includes('projets clients') ?? false);

  await card.click();
  await page.waitForSelector('.projets-placeholder');
  check('Ouvrir Projets affiche son signet', await page.locator('.projets-placeholder').isVisible());
  check('L’adresse dit le module ouvert', page.url().endsWith('#/projets'));

  await page.getByRole('button', { name: 'Changer de module — Projets' }).click();
  check('Le nom du module ouvre la grille des modules', await page.getByRole('dialog').isVisible());

  await context.close();
}
