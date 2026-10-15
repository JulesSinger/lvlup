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
  // Le thème de l'appareil par défaut (15/10/2026 ; le lanceur simule un
  // appareil en sombre) ; le choix se fait dans les réglages, vaut pour
  // l'appareil, et survit au rechargement sans passer d'abord par le sombre.
  {
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const barColor = () =>
      page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'));

    check('Sans choix enregistré, le thème de l’appareil (ici sombre)', (await theme()) === 'dark', await theme());
    {
      const lightDevice = await browser.newContext({ colorScheme: 'light' });
      const p = await lightDevice.newPage();
      await p.goto(BASE);
      const t = await p.evaluate(() => document.documentElement.dataset.theme);
      check('Sur un appareil en clair, Atlas s’ouvre en clair', t === 'light', t);
      await lightDevice.close();
    }
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

    // Le connecteur de Claude (docs/connecteur-claude.md) : sans compte, il dit qu'il en faut un.
    const claude = page.locator('.claude-connector');
    check(
      'Les réglages présentent le connecteur de Claude, qui demande un compte',
      ((await claude.textContent()) ?? '').includes('demande un compte') &&
        (await claude.getByRole('button', { name: 'Créer une clé pour Claude' }).count()) === 0,
    );
    await page.keyboard.press('Escape');
  }

  await context.close();

  await navigation({ browser, check, BASE });
  await reorderModules({ browser, check, BASE });
  await workMode({ browser, check, BASE });
  await demos({ browser, check, BASE });
  await welcome({ browser, check, BASE });

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

/**
 * Réordonner les modules en les glissant (13/10/2026) : la barre de gauche, la
 * grille, l'écran « Tes modules » partagent un seul ordre, retenu, et un clic
 * ouvre toujours le module.
 */
async function reorderModules({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const railOrder = () => page.locator('.atlas-rail-module').evaluateAll((els) => els.map((el) => el.getAttribute('data-tip')));
  const pickerOrder = () => page.locator('.hub-picker-label').allTextContents();

  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const labels = await pickerOrder();
  await page.locator('.hub-picker-card').first().click();
  await page.waitForSelector('.atlas-rail');
  const opened = labels[0];

  // Glisser le troisième module tout en haut de la barre, à la souris.
  const third = page.getByRole('button', { name: `Ouvrir ${labels[2]}`, exact: true });
  const firstBox = await page.getByRole('button', { name: `Ouvrir ${labels[0]}`, exact: true }).boundingBox();
  const thirdBox = await third.boundingBox();
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, firstBox.y + 2, { steps: 12 });
  check('Pendant le glisser, le module tenu est marqué', (await page.locator('.atlas-rail-module.atlas-dragging').count()) === 1);
  await page.mouse.up();
  const expected = [labels[2], labels[0], labels[1], ...labels.slice(3)];
  check('Glisser un module dans la barre change sa place', JSON.stringify(await railOrder()) === JSON.stringify(expected), (await railOrder()).join(', '));
  check(
    '… sans ouvrir le module glissé',
    (await page.locator('.atlas-rail-module[aria-current="page"]').getAttribute('data-tip')) === opened,
  );

  await page.getByRole('button', { name: `Ouvrir ${labels[1]}`, exact: true }).click();
  await page.waitForFunction((label) => document.querySelector('.atlas-rail-module[aria-current="page"]')?.getAttribute('data-tip') === label, labels[1]);
  check('Un simple clic ouvre toujours le module', true);

  await page.locator('.atlas-module-brand:visible').first().click();
  const switcher = page.locator('.atlas-switcher');
  await switcher.waitFor();
  const gridOrder = () => switcher.locator('.atlas-switcher-label').allTextContents();
  check('La grille suit le même ordre', JSON.stringify(await gridOrder()) === JSON.stringify(expected), (await gridOrder()).join(', '));

  // Au clavier dans la grille : Alt + flèche gauche avance le module d'un cran.
  await switcher.locator('.atlas-switcher-module', { hasText: labels[0] }).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  const afterKey = [labels[0], labels[2], labels[1], ...labels.slice(3)];
  await page.waitForFunction((first) => document.querySelector('.atlas-switcher-label')?.textContent === first, labels[0]);
  check('Dans la grille, Alt + flèche déplace le module', JSON.stringify(await gridOrder()) === JSON.stringify(afterKey), (await gridOrder()).join(', '));
  check('… et le focus le suit', await switcher.locator('.atlas-switcher-module').first().evaluate((el) => el === document.activeElement));
  await page.keyboard.press('Escape');
  await switcher.waitFor({ state: 'detached' });
  check('La barre suit la grille', JSON.stringify(await railOrder()) === JSON.stringify(afterKey));

  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  check('L’ordre est retenu, et « Tes modules » le suit', JSON.stringify(await pickerOrder()) === JSON.stringify(afterKey), (await pickerOrder()).join(', '));
  check('Aucune erreur JavaScript en réordonnant', errors.length === 0, errors.join(' | '));
  await context.close();

  // Au doigt : un toucher ouvre, un appui long fait glisser.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.goto(BASE);
  // Le deuxième : Objectifs, premier du registre, ouvre sur son accueil.
  await mobile.locator('.hub-picker-card').nth(1).click();
  await mobile.locator('.atlas-module-brand:visible').first().click();
  const sheet = mobile.locator('.atlas-switcher');
  await sheet.waitFor();
  await mobile.waitForTimeout(300);
  const before = await sheet.locator('.atlas-switcher-label').allTextContents();
  const cards = sheet.locator('.atlas-switcher-module');
  const from = await cards.nth(1).boundingBox();
  const to = await cards.nth(0).boundingBox();
  // Un vrai appui long au doigt, par le protocole de Chrome : Playwright n'a pas de geste « appuyer, attendre, glisser ».
  const cdp = await phone.newCDPSession(mobile);
  const point = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
  await touch('touchStart', point(from));
  await mobile.waitForTimeout(500);
  for (let i = 1; i <= 8; i++) await touch('touchMove', { x: point(from).x + ((to.x + 5 - point(from).x) * i) / 8, y: point(from).y + ((to.y + 5 - point(from).y) * i) / 8 });
  await touch('touchEnd', point(to));
  await mobile.waitForTimeout(200);
  const after = await sheet.locator('.atlas-switcher-label').allTextContents();
  check(
    'Au doigt, un appui long fait glisser un module dans la grille',
    JSON.stringify(after) === JSON.stringify([before[1], before[0], ...before.slice(2)]),
    after.join(', '),
  );
  check('… sans fermer la grille ni changer de module', await sheet.isVisible());
  await phone.close();
}

/**
 * Le mode « au travail » (14/10/2026) : un interrupteur du compte, qui ne garde
 * que les modules choisis (Tâches et Calendar d'office) partout où le socle les liste.
 */
async function workMode({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.hub-picker-card');
  const all = await page.locator('.hub-picker-card').count();
  const labels = () => page.locator('.hub-picker-label').allTextContents();

  await page.getByRole('button', { name: '💼 Mode travail' }).click();
  await page.locator('.atlas-work-banner').waitFor();
  check('Mode travail : seuls Tâches et Calendar restent, et la liste le dit', JSON.stringify((await labels()).sort()) === JSON.stringify(['Calendar', 'Tâches']), (await labels()).join(', '));
  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  check('Le mode travail est retenu', (await page.locator('.hub-picker-card').count()) === 2);

  await page.goto(`${BASE}/#/budget`);
  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  await page.waitForFunction(() => location.hash === '#/').catch(() => {});
  check('Un module caché ne s’ouvre pas, même par son adresse : retour à la liste', (await page.locator('.atlas-rail').count()) === 0 && (await page.evaluate(() => location.hash)) === '#/');

  await page.getByRole('button', { name: '⚙ Réglages' }).click();
  await page.getByRole('group', { name: 'Modules visibles au travail' }).getByLabel(/Budget/).check();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.hub-picker-card').length === 3).catch(() => {});
  check('Les réglages choisissent les modules du travail', (await labels()).includes('Budget') && (await page.locator('.hub-picker-card').count()) === 3);

  await page.locator('.hub-picker-card', { hasText: 'Tâches' }).click();
  await page.waitForSelector('.atlas-rail');
  check('La barre de gauche ne montre que les modules du travail', (await page.locator('.atlas-rail-module').count()) === 3);
  await page.getByRole('button', { name: 'Mode travail' }).click();
  await page.waitForFunction((n) => document.querySelectorAll('.atlas-rail-module').length === n, all);
  check('La barre bascule le mode travail : tous les modules reviennent', (await page.locator('.atlas-rail-module').count()) === all);
  check('Aucune erreur JavaScript en mode travail', errors.length === 0, errors.join(' | '));
  await context.close();
}

/**
 * Les démos (15/10/2026) : proposées une fois, rejouables depuis les réglages,
 * sur des exemples à part — les vraies données ne bougent pas. Chaque démo
 * listée est parcourue bulle par bulle : une bulle qui ne trouve plus ce
 * qu'elle montre (un bouton renommé, une classe changée) fait échouer la suite.
 */
async function demos({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  // Une donnée « réelle » du mode local, qui ne doit jamais bouger.
  await page.evaluate(() => localStorage.setItem('palier.v1', JSON.stringify({ settings: { dailyGoal: 40 }, tachesLists: [{ id: 'vraie', name: 'Ma vraie liste', color: 'bleu', position: 0, archived: false, favorite: false, work: false, createdAt: '' }] })));
  const real = () => page.evaluate(() => localStorage.getItem('palier.v1'));
  const before = await real();
  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  await page.locator('.hub-picker-card', { hasText: 'Tâches' }).click();
  await page.locator('.atlas-demo-offer').waitFor();
  check('À la première ouverture, la démo est proposée', (await page.locator('.atlas-demo-offer').textContent())?.includes('Première fois dans Tâches'));
  await page.getByRole('button', { name: 'Non merci' }).click();
  await page.reload();
  await page.waitForSelector('.atlas-module-brand');
  check('« Non merci » est retenu : elle n’est plus proposée', (await page.locator('.atlas-demo-offer').count()) === 0);
  check('Un « ? » à côté du nom du module ouvre la démo', await page.getByRole('button', { name: 'Voir la démo de Tâches' }).isVisible());

  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
  await page.getByRole('button', { name: '⚙ Réglages' }).click();
  const listed = await page.locator('.settings-demos button').allTextContents();
  check('Les réglages listent les démos', listed.length >= 6, listed.join(', '));
  await page.keyboard.press('Escape');

  for (let n = 0; n < listed.length; n++) {
    await page.goto(BASE);
    await page.evaluate(() => history.replaceState(null, '', '#/'));
    await page.reload();
    await page.getByRole('button', { name: '⚙ Réglages' }).click();
    await page.locator('.settings-demos button').nth(n).click();
    await page.locator('.atlas-tour').waitFor({ timeout: 15000 });
    const name = listed[n].trim();
    const lost = [];
    let steps = 0;
    for (;;) {
      steps++;
      // Chaque bulle trouve ce qu'elle montre (surligné), ou se dit introuvable au bout de 2,5 s.
      await page.waitForFunction(() => document.querySelector('.atlas-tour-spot') || document.querySelector('.atlas-tour[data-target-missing]') || !document.querySelector('.atlas-tour-spot, .atlas-tour-dim:not(:only-child)'), null, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(150);
      if (await page.locator('.atlas-tour[data-target-missing]').count()) lost.push(steps);
      const next = page.locator('.atlas-tour').getByRole('button', { name: 'Suivant ›' });
      if (!(await next.count())) break;
      await next.click();
    }
    check(`Démo ${name} : ${steps} bulles, chacune trouve ce qu’elle montre`, lost.length === 0 && steps >= 4, lost.length ? `introuvables : ${lost.join(', ')}` : '');
    await page.locator('.atlas-tour').getByRole('button', { name: 'Terminer' }).click();
    check(`Démo ${name} : le bandeau dit que rien n’est enregistré`, (await page.locator('.atlas-demo-bar').textContent())?.includes('rien n’est enregistré'));
    check(`Démo ${name} : les vraies données n’ont pas bougé`, (await real()) === before);
  }

  await page.getByRole('button', { name: 'Quitter la démo' }).click();
  await page.waitForFunction(() => !location.search.includes('demo'));
  await page.waitForSelector('.atlas-module-brand');
  check('« Quitter la démo » ramène au module, sur les vraies données', (await page.locator('.atlas-demo-bar').count()) === 0 && (await real()) === before);
  check('Aucune erreur JavaScript dans les démos', errors.length === 0, errors.join(' | '));
  await context.close();
}

/**
 * Le premier écran d'un compte neuf (15/10/2026) : choisir ses modules. En
 * mode local il ne paraît jamais ; on simule un compte qui n'a jamais choisi
 * (`hiddenModules: null`), comme Supabase le rend pour un compte sans réglages.
 */
async function welcome({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await context.addInitScript(() => {
    if (sessionStorage.getItem('welcome-seeded')) return;
    sessionStorage.setItem('welcome-seeded', '1');
    localStorage.setItem('palier.v1', JSON.stringify({ settings: { hiddenModules: null } }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.atlas-welcome');
  const cards = page.locator('.atlas-welcome-card');
  const all = await cards.count();
  const pressed = () => page.locator('.atlas-welcome-card[aria-pressed="true"] .hub-picker-label').allTextContents();
  check('Un compte neuf choisit d’abord ses modules', all > 3 && (await page.locator('.atlas-rail, .hub-picker-grid:not(.atlas-welcome-grid)').count()) === 0);
  check('Trois modules cochés d’office : Tâches, Calendar, Courses', JSON.stringify((await pressed()).sort()) === JSON.stringify(['Calendar', 'Courses', 'Tâches']), (await pressed()).join(', '));
  const start = page.locator('.atlas-welcome-actions .btn-primary');
  check('Le bouton dit combien', ((await start.textContent()) ?? '').includes('3 modules'), await start.textContent());

  for (const label of await pressed()) await cards.filter({ hasText: label }).click();
  check('Rien de coché : impossible de commencer', await start.isDisabled());
  await cards.filter({ hasText: 'Tâches' }).click();
  await cards.filter({ hasText: 'Budget' }).click();
  check('Cocher met à jour le bouton', ((await start.textContent()) ?? '').includes('2 modules'), await start.textContent());
  await start.click();

  await page.waitForSelector('.hub-picker-card:not(.atlas-welcome-card)');
  const labels = () => page.locator('.hub-picker-label').allTextContents();
  check('La liste ne montre que les modules choisis', JSON.stringify((await labels()).sort()) === JSON.stringify(['Budget', 'Tâches']), (await labels()).join(', '));
  const more = page.locator('.atlas-more-modules button');
  check('La liste dit qu’il en reste à ajouter', ((await more.textContent()) ?? '').includes(`${all - 2} autres modules`), await more.textContent());

  await page.reload();
  await page.waitForSelector('.hub-picker-card');
  check('Le choix est retenu, l’écran de choix ne revient pas', (await page.locator('.atlas-welcome').count()) === 0 && (await page.locator('.hub-picker-card').count()) === 2);

  await more.click();
  const group = page.getByRole('group', { name: 'Modules affichés' });
  await group.getByLabel(/Courses/).check();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.hub-picker-card').length === 3).catch(() => {});
  check('Un module s’ajoute depuis les réglages', (await labels()).includes('Courses') && (await page.locator('.hub-picker-card').count()) === 3);

  await page.locator('.hub-picker-card', { hasText: 'Tâches' }).click();
  await page.waitForSelector('.atlas-rail');
  check('La barre de gauche ne montre que les modules affichés', (await page.locator('.atlas-rail-module').count()) === 3);
  check('Aucune erreur JavaScript au premier écran', errors.length === 0, errors.join(' | '));
  await context.close();

  // « Tout afficher » garde tous les modules.
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context2.addInitScript(() => {
    if (sessionStorage.getItem('welcome-seeded')) return;
    sessionStorage.setItem('welcome-seeded', '1');
    localStorage.setItem('palier.v1', JSON.stringify({ settings: { hiddenModules: null } }));
  });
  const phone = await context2.newPage();
  await phone.goto(BASE);
  await phone.waitForSelector('.atlas-welcome');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Le premier écran tient sur un téléphone, sans défilement de côté', overflow <= 0, String(overflow));
  const actions = await phone.locator('.atlas-welcome-actions').boundingBox();
  check('Sur téléphone, le bouton reste à portée sans tout faire défiler', !!actions && actions.y + actions.height <= 844 + 1, JSON.stringify(actions));
  await phone.getByRole('button', { name: 'Tout afficher' }).click();
  await phone.waitForSelector('.hub-picker-card:not(.atlas-welcome-card)');
  check('« Tout afficher » garde tous les modules', (await phone.locator('.hub-picker-card').count()) === all && (await phone.locator('.atlas-more-modules').count()) === 0);
  await context2.close();
}
