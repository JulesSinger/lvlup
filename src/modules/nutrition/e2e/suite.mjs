/**
 * Suite e2e du module nutrition (Cérès).
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-nutrition.md` §10).
 * Ces vérifications ne portent donc que sur ce que l'étape livre réellement
 * — la carte du module sur l'écran de choix, et l'écran qu'elle ouvre —
 * sans rien présumer des écrans à venir (journal, objectifs, aliments).
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  await page.waitForSelector('.hub-picker-card');
  const card = page.getByRole('button', { name: /Cérès/ });
  check('La carte Cérès apparaît sur l’écran de choix', await card.isVisible());
  check(
    'La carte Cérès dit ce que fait le module',
    (await card.textContent())?.includes('Calories et macronutriments') ?? false,
  );

  await card.click();
  check('Ouvrir Cérès affiche son signet', await page.locator('.nutrition-placeholder').isVisible());

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
