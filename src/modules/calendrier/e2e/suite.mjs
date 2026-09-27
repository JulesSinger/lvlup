/**
 * Suite e2e du module calendrier (Éclipse).
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-calendrier.md` §12).
 * Ces vérifications ne portent que sur ce que l'étape livre réellement — la
 * carte du module sur l'écran de choix, et l'écran qu'elle ouvre.
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Éclipse/ });
  check('La carte Éclipse apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Éclipse dit ce que fait le module', (await card.textContent())?.includes('Calendrier') ?? false);

  await card.click();
  check('Ouvrir Éclipse affiche son signet', await page.locator('.calendrier-placeholder').isVisible());

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
