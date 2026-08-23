/**
 * Suite e2e du module budget (Astra).
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-astra.md` §7). Ces
 * vérifications ne portent donc que sur ce que l'étape livre réellement —
 * la carte du module sur l'écran de choix, et l'écran qu'elle ouvre — sans
 * rien présumer des écrans à venir (catégories, saisie, camembert, import).
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  // Deux modules enregistrés : le hub s'arrête désormais sur l'écran de
  // choix plutôt que d'entrer directement dans Zénith.
  await page.waitForSelector('.hub-picker-card');
  check('La carte Astra apparaît sur l’écran de choix', await page.getByText('Astra').isVisible());

  await page.getByRole('button', { name: /Astra/ }).click();
  check('Ouvrir Astra affiche son signet', await page.locator('.budget-placeholder').isVisible());
  check(
    'Le signet propose de revenir aux modules',
    await page.getByRole('button', { name: '← Retour aux modules' }).isVisible(),
  );

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
