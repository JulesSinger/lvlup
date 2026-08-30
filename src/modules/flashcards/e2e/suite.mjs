/**
 * Suite e2e du module flashcards (Orbite).
 *
 * Étape 1 : le module n'a qu'un signet (voir `docs/etude-flashcards.md` §9).
 * Ces vérifications ne portent donc que sur ce que l'étape livre réellement
 * — la carte du module sur l'écran de choix, et l'écran qu'elle ouvre —
 * sans rien présumer des écrans à venir (paquets, cartes, révision,
 * statistiques).
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  // Trois modules enregistrés : le hub s'arrête sur l'écran de choix.
  await page.waitForSelector('.hub-picker-card');
  check('La carte Orbite apparaît sur l’écran de choix', await page.getByText('Orbite').isVisible());

  await page.getByRole('button', { name: /Orbite/ }).click();
  check(
    'Ouvrir Orbite affiche son signet',
    await page.locator('.flashcards-placeholder').isVisible(),
  );
  check(
    'Le signet propose de revenir aux modules',
    await page.getByRole('button', { name: '← Retour aux modules' }).isVisible(),
  );

  await page.getByRole('button', { name: '← Retour aux modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('Retour aux modules ramène sur l’écran de choix', await page.locator('.hub-picker').isVisible());

  await context.close();
}
