/**
 * Suite e2e du socle : ce qui ne dépend d'aucun module — PWA, service worker,
 * écran d'authentification. Rien ici ne clique un bouton d'un module : ces
 * vérifications sont censées rester valables même quand Budget existera.
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

  // Écran de choix des modules : chaque carte porte, sous son nom de marque,
  // une description de son domaine (ajoutée le 07/09/2026 — un nom seul
  // comme Objectifs ou Budget ne dit rien à qui ne le connaît pas encore, voir
  // CLAUDE.md §8). Trois modules enregistrés suffisent pour que le hub
  // affiche l'écran de choix plutôt que d'entrer directement dans le seul.
  await page.waitForSelector('.hub-picker-card');
  const cardCount = await page.locator('.hub-picker-card').count();
  check(
    'Chaque carte du hub porte une description de son domaine',
    (await page.locator('.hub-picker-description').count()) === cardCount,
    String(cardCount),
  );
  const descriptions = await page.locator('.hub-picker-description').allTextContents();
  check(
    'Aucune description vide',
    descriptions.every((d) => d.trim().length > 0),
    descriptions.join(' | '),
  );

  // --- Thème clair / sombre (étape 1 du mode clair, 2026-09-29) -------------
  // Sombre par défaut ; le choix se fait dans les réglages, vaut pour
  // l'appareil, et survit au rechargement sans passer d'abord par le sombre.
  {
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const barColor = () =>
      page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'));

    check('Sombre par défaut, sans choix enregistré', (await theme()) === 'dark', await theme());
    check('Le fond sombre d’origine', (await bodyBg()) === 'rgb(11, 14, 20)', await bodyBg());

    await page.getByRole('button', { name: '⚙ Réglages' }).click();
    const group = page.getByRole('group', { name: 'Thème' });
    check('Les réglages proposent Sombre, Clair et Système', (await group.getByRole('button').count()) === 3);
    await group.getByRole('button', { name: 'Clair' }).click();
    check('« Clair » passe l’app en clair', (await theme()) === 'light', await theme());
    check('Le fond devient clair', (await bodyBg()) === 'rgb(244, 245, 249)', await bodyBg());
    check('La barre du navigateur suit', (await barColor()) === '#f4f5f9', await barColor());
    check(
      'Le choix est marqué dans les réglages',
      (await group.getByRole('button', { name: 'Clair' }).getAttribute('aria-pressed')) === 'true',
    );

    await page.reload();
    await page.waitForSelector('.hub-picker-card');
    check('Le clair survit au rechargement', (await theme()) === 'light', await theme());

    await page.getByRole('button', { name: '⚙ Réglages' }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await group.getByRole('button', { name: 'Système' }).click();
    check('« Système » suit un appareil en sombre', (await theme()) === 'dark', await theme());
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    check('… et bascule avec lui, sans recharger', (await theme()) === 'light', await theme());

    await group.getByRole('button', { name: 'Sombre' }).click();
    check('« Sombre » ramène le thème d’origine', (await theme()) === 'dark', await theme());
    await page.keyboard.press('Escape');
  }

  await context.close();

  await navigation({ browser, check, BASE });

  // Écran d'authentification : il n'apparaît qu'en mode Supabase, on le vérifie
  // donc sur un build de démonstration servi séparément si disponible.
  if (process.env.AUTH_BASE) {
    const authContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const authPage = await authContext.newPage();
    await authPage.goto(process.env.AUTH_BASE);

    // La page d'accueil publique (Landing, socle depuis le 2026-09-16) pitche
    // le hub, pas un seul module : elle porte la marque du hub et une carte
    // par module du registre, chacune avec son nom, sa description et — quand
    // le module en fournit un — un aperçu (`LandingPreview`).
    await authPage.waitForSelector('.lp-hero');
    check(
      'La page d’accueil porte la marque du hub, pas celle d’un module',
      (await authPage.locator('.lp-nav .brand-name').textContent()) === 'Atlas',
    );
    const moduleCardCount = await authPage.locator('.lp-module-card').count();
    check('La page d’accueil montre une carte par module', moduleCardCount >= 3, String(moduleCardCount));
    const moduleNames = await authPage.locator('.lp-module-name').allTextContents();
    check(
      'Chaque module du registre a sa carte, avec son vrai nom',
      ['Objectifs', 'Budget', 'Flashcards'].every((label) => moduleNames.includes(label)),
      moduleNames.join(' | '),
    );
    check(
      'Chaque carte a un aperçu de son module',
      (await authPage.locator('.lp-module-preview').count()) === moduleCardCount,
    );
    // L'effet « wow » du héros (2026-09-16) : un champ d'étoiles en canvas,
    // préféré à une sphère armillaire en 3D CSS après comparaison sur maquette.
    check(
      'Le héros affiche son champ d’étoiles',
      (await authPage.locator('.lp-starfield canvas').count()) === 1,
    );

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

    // La présentation publique reste sombre même en thème clair : son champ
    // d'étoiles n'a de sens que sur un ciel de nuit. Le formulaire, lui, suit.
    {
      const lightContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await lightContext.addInitScript(() => localStorage.setItem('atlas.theme.v1', 'light'));
      const lightPage = await lightContext.newPage();
      await lightPage.goto(process.env.AUTH_BASE);
      await lightPage.waitForSelector('.lp-hero');
      const theme = () => lightPage.evaluate(() => document.documentElement.dataset.theme);
      check('La présentation reste sombre en thème clair', (await theme()) === 'dark', await theme());
      await lightPage.getByRole('button', { name: 'Se connecter', exact: true }).first().click();
      await lightPage.waitForSelector('.auth-card');
      check('Le formulaire de connexion suit le thème choisi', (await theme()) === 'light', await theme());
      await lightContext.close();
    }
  }
}

/**
 * Passer d'un module à l'autre (30/09/2026) : la barre d'icônes sur
 * ordinateur, le nom du module qui ouvre la grille, l'adresse qui garde le
 * module (retour du navigateur, rechargement), le dernier module rouvert.
 * Aucun module n'est nommé : on prend les cartes du hub, à partir de la
 * deuxième (la première, Objectifs, s'ouvre sur son accueil).
 */
async function navigation({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const active = () => page.locator('.atlas-rail-module[aria-current="page"]').getAttribute('data-tip');
  const hash = () => page.evaluate(() => location.hash);

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const labels = await page.locator('.hub-picker-label').allTextContents();
  if (labels.length < 3) {
    check('Navigation entre modules : au moins trois modules à parcourir', false, String(labels.length));
    await context.close();
    return;
  }
  const [a, b] = [labels[1], labels[2]];
  check('Une ouverture sans adresse s’inscrit sur la liste (#/), sans ajouter d’entrée', (await hash()) === '#/');

  await page.locator('.hub-picker-card', { hasText: a }).click();
  await page.waitForSelector('.atlas-rail');
  check('Sur ordinateur, une barre d’icônes : une par module', (await page.locator('.atlas-rail-module').count()) === labels.length);
  check('… le module ouvert y est marqué', (await active()) === a, String(await active()));
  await page.getByRole('button', { name: `Ouvrir ${b}`, exact: true }).click();
  await page.waitForFunction((label) => document.querySelector('.atlas-rail-module[aria-current="page"]')?.getAttribute('data-tip') === label, b);
  check('Un seul clic dans la barre change de module', (await active()) === b);
  check('L’adresse dit le module ouvert', (await hash()).startsWith('#/') && (await hash()) !== '#/');

  await page.goBack();
  await page.waitForFunction((label) => document.querySelector('.atlas-rail-module[aria-current="page"]')?.getAttribute('data-tip') === label, a);
  check('Le retour du navigateur ramène au module d’avant', (await active()) === a);
  await page.goForward();
  await page.waitForFunction((label) => document.querySelector('.atlas-rail-module[aria-current="page"]')?.getAttribute('data-tip') === label, b);
  check('… et « suivant » y retourne', (await active()) === b);

  await page.reload();
  await page.waitForSelector('.atlas-rail');
  check('Recharger garde le module ouvert', (await active()) === b);
  await page.goto(BASE);
  await page.waitForSelector('.atlas-rail');
  check('Rouvrir Atlas sans adresse rouvre le dernier module', (await active()) === b);

  await page.locator('.atlas-module-brand:visible').first().click();
  const switcher = page.locator('.atlas-switcher');
  await switcher.waitFor();
  check(
    'Toucher le nom du module ouvre la grille, le module ouvert marqué',
    (await switcher.locator('.atlas-switcher-module').count()) === labels.length &&
      (await switcher.locator('[aria-current="page"]').textContent())?.includes(b),
  );
  await switcher.locator('.atlas-switcher-module', { hasText: a }).click();
  await switcher.waitFor({ state: 'detached' });
  check('Choisir dans la grille ouvre le module et la referme', (await active()) === a);

  await page.keyboard.press('Control+k');
  await switcher.waitFor();
  check('Ctrl+K ouvre la grille', await switcher.isVisible());
  await page.keyboard.press('Escape');
  await switcher.waitFor({ state: 'detached' });
  check('Échap la referme, sans quitter le module', (await active()) === a);

  await page.keyboard.press('Control+k');
  await switcher.getByRole('button', { name: 'Tous les modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('« Tous les modules » ramène à la liste', (await hash()) === '#/' && (await page.locator('.atlas-rail').count()) === 0);

  await page.locator('.hub-picker-card', { hasText: b }).click();
  await page.waitForSelector('.atlas-rail');
  await page.locator('.atlas-rail').getByRole('button', { name: 'Tous les modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  check('La marque d’Atlas, en haut de la barre, ramène aussi à la liste', true);

  await page.goto(`${BASE}/#/module-qui-n-existe-pas`);
  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  check('Une adresse vers un module inconnu ouvre la liste', true);
  await page.goto(`${BASE}/?lien=1#access_token=abc&type=recovery`);
  await page.waitForTimeout(300);
  check('Une adresse qui n’est pas à Atlas (un lien de Supabase) n’est pas réécrite', (await hash()) === '#access_token=abc&type=recovery', await hash());
  check('Aucune erreur JavaScript en passant d’un module à l’autre', errors.length === 0, errors.join(' | '));
  await context.close();

  // --- Téléphone : pas de barre, le nom du module ouvre la grille, qui monte du bas ---
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.goto(BASE);
  await mobile.locator('.hub-picker-card', { hasText: a }).click();
  await mobile.locator('.atlas-module-brand:visible').first().waitFor();
  check('Sur téléphone, pas de barre d’icônes', !(await mobile.locator('.atlas-rail').isVisible()));
  await mobile.locator('.atlas-module-brand:visible').first().click();
  const sheet = mobile.locator('.atlas-switcher');
  await sheet.waitFor();
  await mobile.waitForTimeout(300); // la fin de la montée
  const box = await sheet.boundingBox();
  check(
    'Sur téléphone, la grille monte du bas, sur toute la largeur',
    box !== null && Math.abs(box.y + box.height - 844) <= 1 && box.width >= 389,
    JSON.stringify(box),
  );
  check('… sans rien faire déborder', await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await sheet.locator('.atlas-switcher-module', { hasText: b }).click();
  await sheet.waitFor({ state: 'detached' });
  check('… et un toucher change de module', (await mobile.locator('.atlas-module-brand:visible').first().textContent())?.includes(b));
  await phone.close();
}
