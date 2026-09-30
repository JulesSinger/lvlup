/**
 * Suite e2e du module Hauts faits.
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-hauts-faits.md`
 * §11). Ces vérifications ne portent que sur ce que l'étape livre
 * réellement — la carte du module sur l'écran de choix, et l'écran qu'elle
 * ouvre.
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Hauts faits/ });
  check('La carte Hauts faits apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Hauts faits dit ce que fait le module', (await card.textContent())?.includes('grands moments') ?? false);

  await card.click();
  check('Ouvrir Hauts faits affiche son signet', await page.locator('.hautsfaits-placeholder').isVisible());

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
