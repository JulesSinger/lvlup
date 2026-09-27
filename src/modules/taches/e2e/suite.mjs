/**
 * Suite e2e du module tâches (Polaris).
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-taches.md` §12).
 * Ces vérifications ne portent que sur ce que l'étape livre réellement — la
 * carte du module sur l'écran de choix, et l'écran qu'elle ouvre.
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Polaris/ });
  check('La carte Polaris apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Polaris dit ce que fait le module', (await card.textContent())?.includes('Tâches') ?? false);

  await card.click();
  check('Ouvrir Polaris affiche son signet', await page.locator('.taches-placeholder').isVisible());

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
