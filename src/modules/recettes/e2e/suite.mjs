/**
 * Suite e2e du module Recettes.
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-recettes.md` §12).
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
  const card = page.locator('.hub-picker-card', { hasText: 'Recettes' });
  check('La carte Recettes apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Recettes dit ce que fait le module', (await card.textContent())?.includes('menu de la semaine') ?? false);

  await card.click();
  await page.waitForSelector('.recettes-placeholder');
  check('Ouvrir Recettes affiche son signet', await page.locator('.recettes-placeholder').isVisible());
  check('L’adresse dit le module ouvert', page.url().endsWith('#/recettes'));

  await page.getByRole('button', { name: 'Changer de module — Recettes' }).click();
  check('Le nom du module ouvre la grille des modules', await page.getByRole('dialog').isVisible());

  await context.close();
}
