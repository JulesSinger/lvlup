/**
 * Suite e2e du socle : ce qui ne dépend d'aucun module — PWA, service worker,
 * écran d'authentification. Rien ici ne clique un bouton d'un module : ces
 * vérifications sont censées rester valables même quand Astra existera.
 *
 * L'écran d'authentification n'existe qu'en mode Supabase : il n'est vérifié
 * que si `AUTH_BASE` est fourni (voir `e2e/run.mjs` et `npm run check:auth`).
 */

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE);

  // PWA : manifest et service worker servis
  check('Manifest PWA lié dans la page', (await page.locator('link[rel="manifest"]').count()) === 1);
  check('manifest.webmanifest servi', (await page.request.get(`${BASE}/manifest.webmanifest`)).ok());
  check('Service worker servi', (await page.request.get(`${BASE}/sw.js`)).ok());
  check('Icône 192 servie', (await page.request.get(`${BASE}/icons/icon-192.png`)).ok());

  // --- Service worker : les rappels reposent sur ces gestionnaires ---------
  {
    const sw = await (await fetch(`${BASE}/sw.js`)).text();
    check(
      "Le service worker écoute l'arrivée d'une notification",
      sw.includes("addEventListener('push'"),
    );
    check(
      'Un clic sur la notification ramène vers l’app',
      sw.includes("addEventListener('notificationclick'"),
    );
    check('Une notification est toujours affichée (exigence iOS)', sw.includes('showNotification'));
  }

  await context.close();

  // Écran d'authentification : il n'apparaît qu'en mode Supabase, on le vérifie
  // donc sur un build de démonstration servi séparément si disponible.
  if (process.env.AUTH_BASE) {
    const authContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const authPage = await authContext.newPage();
    await authPage.goto(process.env.AUTH_BASE);

    // Chaque bouton de la présentation doit ouvrir le formulaire qu'il annonce.
    // « Créer mon compte » qui tombait sur la connexion obligeait à recliquer
    // sur « En créer un » — sur le tout premier écran, avant même le compte.
    await authPage.waitForSelector('.lp-hero');
    for (const [libelle, attendu] of [
      ['Créer mon compte', 'Créer mon compte'],
      ['Commencer — c’est gratuit', 'Créer mon compte'],
      ['Se connecter', 'Se connecter'],
    ]) {
      await authPage
        .getByRole('button', { name: libelle.replace('’', "'"), exact: true })
        .first()
        .click();
      await authPage.waitForSelector('.auth-card');
      check(
        `« ${libelle} » ouvre le bon formulaire`,
        (await authPage.locator('.auth-card .btn-primary').textContent()) === attendu,
        await authPage.locator('.auth-card .btn-primary').textContent(),
      );
      await authPage.getByRole('button', { name: 'Revenir à la présentation' }).click();
      await authPage.waitForSelector('.lp-hero');
    }
    // L'appel final en bas de page mène là aussi à l'inscription.
    await authPage.locator('.lp-final .lp-cta').click();
    await authPage.waitForSelector('.auth-card');
    check(
      'L’appel final de la page mène aussi à l’inscription',
      (await authPage.locator('.auth-card .btn-primary').textContent()) === 'Créer mon compte',
      await authPage.locator('.auth-card .btn-primary').textContent(),
    );
    check(
      'Le champ mot de passe demande d’en choisir un, pas d’en retrouver un',
      (await authPage.locator('#password').getAttribute('autocomplete')) === 'new-password',
      await authPage.locator('#password').getAttribute('autocomplete'),
    );
    await authPage.getByRole('button', { name: 'Se connecter' }).click();
    await authPage.waitForTimeout(150);
    check(
      'Depuis l’inscription, on rejoint la connexion sans repasser par la présentation',
      (await authPage.locator('.auth-card .btn-primary').textContent()) === 'Se connecter',
      await authPage.locator('.auth-card .btn-primary').textContent(),
    );
    await authPage.waitForSelector('#password');
    check(
      'Mot de passe masqué par défaut',
      (await authPage.locator('#password').getAttribute('type')) === 'password',
    );
    await authPage.locator('.password-toggle').click();
    check(
      'Le bouton œil rend le mot de passe visible',
      (await authPage.locator('#password').getAttribute('type')) === 'text',
      await authPage.locator('#password').getAttribute('type'),
    );
    // Le bouton doit être DANS le champ : sans positionnement il retombait
    // dessous, à l'air libre, et ne ressemblait plus à rien.
    {
      const placement = await authPage.evaluate(() => {
        const input = document.querySelector('#password').getBoundingClientRect();
        const eye = document.querySelector('.password-toggle').getBoundingClientRect();
        return {
          dedans:
            eye.top >= input.top - 1 &&
            eye.bottom <= input.bottom + 1 &&
            eye.right <= input.right + 1 &&
            eye.left > input.left,
          ecart: Math.round(eye.top - input.top),
        };
      });
      check(
        "L'œil est posé dans le champ, pas en dessous",
        placement.dedans,
        `décalage vertical ${placement.ecart}px`,
      );
    }

    // Mot de passe oublié : accessible depuis la connexion, demande l'adresse
    // seule, et sait revenir en arrière.
    await authPage.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await authPage.waitForTimeout(200);
    check(
      'Le mot de passe oublié masque le champ mot de passe',
      (await authPage.locator('#password').count()) === 0,
    );
    check(
      'Le bouton d’envoi du lien est proposé',
      await authPage.getByRole('button', { name: 'Envoyer le lien' }).isVisible(),
    );
    await authPage.getByRole('button', { name: 'Revenir à la connexion' }).click();
    await authPage.waitForTimeout(200);
    check('On peut revenir à la connexion', (await authPage.locator('#password').count()) === 1);
    await authPage.close();
    await authContext.close();
  }
}
