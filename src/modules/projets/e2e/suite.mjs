/**
 * Suite e2e du module Projets.
 *
 * Étape 3 (docs/etude-projets.md §15) : la V1. Un vrai parcours — l'écran
 * vide, créer un projet et son client d'après le modèle « Site vitrine »,
 * les chantiers repliés puis ouverts, cocher, une tâche qui attend le
 * client, ajouter une tâche et un chantier, l'attente posée sur le projet,
 * le journal, le tableau de bord (cette semaine, attente, carte, danger),
 * un second projet en piste, les projets par statut, les clients, les infos
 * et la suppression, le tout retrouvé après un rechargement — plus le rendu
 * téléphone.
 *
 * Étape 4 (§16) : le questionnaire de besoins (brouillon gardé à travers un
 * rechargement, questions à demander qui remontent au tableau de bord), la
 * fiche design, les liens et les accès (mot de passe refusé), le pipeline en
 * colonnes.
 *
 * Étape 5 (§17) : l'argent — l'échéancier 30 / 70 posé d'office, un paiement
 * reçu (et vu dans Budget, de l'autre côté), un paiement qui dépasse le prix,
 * le temps passé et le taux horaire réel, l'argent au tableau de bord, le
 * livre des recettes et son export CSV.
 *
 * Étape 6 (§18) : la tâche du jour vue dans Calendar, et « Modifier dans
 * Projets » qui ramène à sa fenêtre.
 *
 * Étape 7 (§19) : de vrais JPEG fabriqués dans le navigateur — le logo dans
 * l'en-tête, des photos réduites, une sorte changée, l'image en grand, un
 * fichier qui n'est pas une image, une image retirée.
 */

/** Rouvre Atlas sur la liste des modules (voir la suite de Hauts faits). */
const toHub = async (page) => {
  await page.evaluate(() => history.replaceState(null, '', '#/'));
  await page.reload();
};

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s/g, ' ');

const pad = (n) => String(n).padStart(2, '0');
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function openModule(page) {
  await toHub(page);
  await page.waitForSelector('.hub-picker-card');
  await page.locator('.hub-picker-card', { hasText: 'Projets' }).click();
  await page.waitForSelector('.projets-main');
}

/** Un vrai JPEG, dessiné dans le navigateur (même motif que la suite de Hauts faits). */
async function jpeg(page, hue, { width = 1600, height = 1200 } = {}) {
  const base64 = await page.evaluate(
    ([hue, width, height]) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `hsl(${hue + 180}, 70%, 75%)`;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, height / 4, 0, Math.PI * 2);
      ctx.fill();
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    [hue, width, height],
  );
  return Buffer.from(base64, 'base64');
}
const file = (name, buffer, mimeType = 'image/jpeg') => ({ name, mimeType, buffer });

const ws = (page, title) => page.locator(`section[aria-label="Chantier ${title}"]`);
const groupOf = (page, label) => page.locator('.projets-ws-group', { has: page.locator('.projets-section-title', { hasText: label }) });

export async function run({ browser, check, BASE }) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => void d.accept());

  await page.goto(BASE);
  await toHub(page);
  await page.waitForSelector('.hub-picker-card');
  const card = page.locator('.hub-picker-card', { hasText: 'Projets' });
  check('La carte Projets apparaît sur l’écran de choix', await card.isVisible());
  check('La carte Projets dit ce que fait le module', (await card.textContent())?.includes('projets clients') ?? false);
  await card.click();
  await page.waitForSelector('.projets-main');
  check('L’adresse dit le module ouvert', page.url().endsWith('#/projets'));

  // --- L'écran vide -------------------------------------------------------
  check('Sans projet, le tableau de bord invite à en créer un', await page.locator('.projets-empty', { hasText: 'Aucun projet' }).isVisible());

  // --- Créer un projet et son client, d'après le modèle ----------------------
  await page.locator('.projets-empty').getByRole('button', { name: '+ Nouveau projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  check('Sans client, la fenêtre propose d’en créer un', (await page.locator('#projets-new-client').inputValue()) === '__new__');
  check('Le titre suit le modèle choisi', (await page.locator('#projets-new-title').inputValue()) === 'Site vitrine');
  await dialog.getByRole('radio', { name: /Boutique en ligne/ }).click();
  check('Changer de modèle change le titre tant qu’on ne l’a pas écrit', (await page.locator('#projets-new-title').inputValue()) === 'Boutique en ligne');
  await dialog.getByRole('radio', { name: /Site vitrine/ }).click();
  await page.fill('#projets-new-client-name', 'Fleurs de Lou');
  await page.selectOption('#projets-new-client-trade', 'fleuriste');
  await page.selectOption('#projets-new-status', 'production');
  await page.fill('#projets-new-due', inDays(5));
  await page.fill('#projets-new-price', 'neuf cents');
  await dialog.getByRole('button', { name: 'Créer le projet' }).click();
  check('Un prix illisible est refusé en clair', (await text(dialog.locator('.notice.error'))).includes('montant positif'));
  await page.fill('#projets-new-price', '900');
  await dialog.getByRole('button', { name: 'Créer le projet' }).click();
  await page.waitForSelector('.projets-sheet');
  check('Le projet créé s’ouvre sur sa fiche', (await text(page.locator('.projets-sheet-title'))) === 'Site vitrine');
  check('La fiche dit le client et son métier', (await text(page.locator('.projets-sheet-client'))).includes('Fleurs de Lou · Fleuriste'));
  check('Le modèle a posé ses 8 chantiers', (await page.locator('.projets-ws').count()) === 8);
  check('Et ses 45 tâches, aucune faite', (await text(page.locator('.projets-sheet-progress'))).includes('0 / 45 tâches'));
  check('Le prix et l’échéance sont dans l’en-tête', (await text(page.locator('.projets-sheet-meta'))).includes('900 €') && (await text(page.locator('.projets-sheet-meta'))).includes('dans 5 j'));
  check('Rien de commencé : tout est « À faire », replié', (await groupOf(page, 'À faire').locator('.projets-ws').count()) === 8 && (await page.locator('.projets-task').count()) === 0);

  // --- Cocher : le chantier passe « En cours » -------------------------------
  await ws(page, 'Découverte').locator('.projets-ws-toggle').click();
  check('Ouvrir un chantier montre ses tâches', (await ws(page, 'Découverte').locator('.projets-task').count()) === 5);
  await page.getByRole('button', { name: 'Cocher « Premier rendez-vous avec le client »' }).click();
  await page.waitForFunction(() => document.querySelector('.projets-sheet-progress')?.textContent?.includes('1 / 45'));
  check('Cocher fait avancer le projet', (await text(page.locator('.projets-sheet-progress'))).includes('1 / 45 tâches'));
  check('Le chantier commencé passe dans « En cours »', (await groupOf(page, 'En cours').locator('.projets-ws-title').allTextContents()).join() === 'Découverte');

  // --- Ajouter une tâche sur place -----------------------------------------
  await page.getByLabel('Ajouter une tâche à Découverte').fill('Appeler pour le logo');
  await page.getByLabel('Ajouter une tâche à Découverte').press('Enter');
  await page.waitForFunction(() => document.querySelector('.projets-sheet-progress')?.textContent?.includes('/ 46'));
  check('Une tâche s’ajoute au bout de son chantier', (await ws(page, 'Découverte').locator('.projets-task-title').last().textContent()) === 'Appeler pour le logo');
  check('Le champ se vide après l’ajout', (await page.getByLabel('Ajouter une tâche à Découverte').inputValue()) === '');

  // --- Une tâche qui attend le client, prévue aujourd'hui ----------------------
  await ws(page, 'Contenus').locator('.projets-ws-toggle').click();
  await page.getByRole('button', { name: 'Modifier « Recevoir les photos »' }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Modifier la tâche' });
  await page.fill('#projets-task-planned', inDays(0));
  await taskDialog.getByLabel(/attend quelque chose du client/).check();
  await taskDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await taskDialog.waitFor({ state: 'detached' });
  check('Une tâche qui attend le client le dit', (await text(ws(page, 'Contenus').locator('.projets-task', { hasText: 'Recevoir les photos' }))).includes('attend le client'));
  check('Son chantier passe dans « Attend le client »', (await groupOf(page, 'Attend le client').locator('.projets-ws-title').allTextContents()).join() === 'Contenus');

  // --- Un nouveau chantier --------------------------------------------------
  await page.getByRole('button', { name: '+ Ajouter un chantier' }).click();
  await page.fill('#projets-ws-title', 'Référencement local');
  await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByRole('button', { name: 'Créer' }).click();
  await page.waitForSelector('section[aria-label="Chantier Référencement local"]');
  check('Un chantier sans tâche se range à part, ouvert pour y ajouter', (await groupOf(page, 'Sans tâche').locator('.projets-ws-title').allTextContents()).join() === 'Référencement local');

  // --- L'attente posée sur le projet ----------------------------------------
  await page.getByRole('button', { name: /J’attends quelque chose du client/ }).click();
  await page.getByLabel('Ce que tu attends du client').fill('la validation des tarifs');
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector('.projets-waitbar b');
  check('L’attente du client s’affiche, depuis aujourd’hui', (await text(page.locator('.projets-waitbar'))).includes('la validation des tarifs, depuis aujourd’hui'));

  // --- Le journal -------------------------------------------------------------
  await page.getByRole('tab', { name: 'Journal' }).click();
  check('Le journal vide dit à quoi il sert', await page.locator('.projets-journal .projets-hint').isVisible());
  await page.getByLabel('Note', { exact: true }).fill('Appel : elle veut une page Mariages');
  await page.getByRole('button', { name: 'Ajouter au journal' }).click();
  await page.waitForSelector('.projets-note');
  check('Une note datée entre au journal', (await text(page.locator('.projets-note-text'))) === 'Appel : elle veut une page Mariages');
  check('L’onglet compte ses notes', (await text(page.getByRole('tab', { name: /Journal/ }))) === 'Journal (1)');

  // --- Les besoins : un brouillon qui survit au rechargement ------------------
  await page.getByRole('tab', { name: /Besoins/ }).click();
  check('L’onglet Besoins dit combien de réponses', (await text(page.getByRole('tab', { name: /Besoins/ }))).startsWith('Besoins 0/'));
  await page.fill('#projets-need-activity', 'Fleuriste de quartier, mariages et deuil');
  await page.getByRole('group', { name: 'À quoi doit servir le site' }).getByRole('button', { name: 'Être trouvé sur Google' }).click();
  await page.getByRole('button', { name: 'À demander au client : Qui fournit les photos, et pour quand' }).click();
  check('Ce qui n’est pas enregistré se signale', (await text(page.locator('.projets-needs-bar'))).includes('Modifications non enregistrées'));
  await openModule(page);
  await page.locator('.projets-card', { hasText: 'Fleurs de Lou' }).click();
  await page.getByRole('tab', { name: /Besoins/ }).click();
  check('Après un rechargement, le brouillon est repris', (await page.locator('#projets-need-activity').inputValue()) === 'Fleuriste de quartier, mariages et deuil');
  check('Et dit qu’il vient de l’appareil', (await text(page.locator('.projets-needs-bar'))).includes('brouillon repris'));
  await page.locator('.projets-needs-bar').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => !document.querySelector('.projets-needs-dirty'));
  check('Enregistré, le questionnaire compte ses réponses', (await text(page.getByRole('tab', { name: /Besoins/ }))).startsWith('Besoins 2/'));
  check('Le choix coché reste coché', (await page.getByRole('button', { name: 'Être trouvé sur Google' }).getAttribute('aria-pressed')) === 'true');

  // --- La fiche design ------------------------------------------------------
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByLabel('Code de la couleur').fill('rose');
  await page.locator('.projets-color-add').getByRole('button', { name: 'Ajouter' }).click();
  check('Un code couleur illisible est refusé en clair', (await text(page.locator('.projets-design .notice.error'))).includes('#e7b7c3'));
  await page.getByLabel('Code de la couleur').fill('E7B7C3');
  await page.getByLabel('Code de la couleur').press('Enter');
  await page.getByLabel('Code de la couleur').fill('#4e6b4a');
  await page.getByLabel('Code de la couleur').press('Enter');
  check('Les couleurs se rangent en pastilles, codes normalisés', (await page.locator('.projets-swatch-code').allTextContents()).join() === '#e7b7c3,#4e6b4a');
  await page.fill('#projets-design-title-font', 'Cormorant Garamond');
  await page.fill('#projets-design-refs', 'fleurs-exemple.fr');
  check('Une référence devient un lien', (await page.locator('.projets-refs a').getAttribute('href')) === 'https://fleurs-exemple.fr');
  await page.locator('.projets-design').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.projets-design .notice.success, .projets-design .notice.error');
  check('La fiche design s’enregistre', (await page.locator('.projets-design .notice.success').count()) === 1);

  // --- Les liens et les accès -------------------------------------------------
  await page.getByRole('tab', { name: /Liens/ }).click();
  check('Sans lien, l’onglet dit quoi y mettre', (await text(page.locator('.projets-links'))).includes('Aucun lien'));
  await page.getByRole('button', { name: '+ Ajouter un lien' }).click();
  const linkDialog = page.getByRole('dialog', { name: 'Nouveau lien' });
  await page.selectOption('#projets-link-kind', 'hebergement');
  check('Le nom suit la sorte tant qu’on ne l’a pas écrit', (await page.locator('#projets-link-label').inputValue()) === 'Hébergement');
  await page.fill('#projets-link-label', 'OVH');
  await page.fill('#projets-link-url', 'ovh.com/manager');
  await page.fill('#projets-link-login', 'lou@fleursdelou.fr');
  await page.fill('#projets-link-note', 'mdp : Tulipe2026');
  await linkDialog.getByRole('button', { name: 'Ajouter' }).click();
  check('Un mot de passe noté est refusé', (await text(linkDialog.locator('.notice.error'))).includes('coffre-fort'));
  await page.fill('#projets-link-note', 'Mot de passe dans Bitwarden');
  await linkDialog.getByRole('button', { name: 'Ajouter' }).click();
  await linkDialog.waitFor({ state: 'detached' });
  const ovh = page.locator('.projets-link-row', { hasText: 'OVH' });
  check('Le lien s’ouvre en https, dans un nouvel onglet', (await ovh.locator('a').getAttribute('href')) === 'https://ovh.com/manager' && (await ovh.locator('a').getAttribute('target')) === '_blank');
  check('L’identifiant est là, prêt à copier', (await text(ovh)).includes('lou@fleursdelou.fr'));
  check('L’onglet compte ses liens', (await text(page.getByRole('tab', { name: /Liens/ }))) === 'Liens (1)');
  await page.getByRole('tab', { name: 'Design' }).click();
  check('La fiche design est relue telle qu’enregistrée', (await page.locator('.projets-swatch-code').count()) === 2 && (await page.locator('#projets-design-title-font').inputValue()) === 'Cormorant Garamond');

  // --- Les images (étape 7) -------------------------------------------------------
  const imageInput = page.getByLabel('Choisir des images');
  check('Sans logo, on ajoute d’abord un logo', (await page.getByLabel('Sorte des images à ajouter').inputValue()) === 'logo');
  await imageInput.setInputFiles([file('logo.jpg', await jpeg(page, 330, { width: 3000, height: 3000 }))]);
  await page.waitForSelector('.projets-sheet-logo img');
  check('Le logo s’affiche dans l’en-tête de la fiche', (await page.locator('.projets-sheet-logo img').count()) === 1);
  check('Réduit dans le navigateur : la miniature fait 720 px au plus', await page.locator('.projets-sheet-logo img').evaluate((img) => img.naturalWidth > 0 && img.naturalWidth <= 720));
  await page.getByLabel('Sorte des images à ajouter').selectOption('photo');
  await imageInput.setInputFiles([file('vitrine.jpg', await jpeg(page, 120)), file('notes.txt', Buffer.from('pas une image'), 'text/plain')]);
  await page.waitForFunction(() => document.querySelectorAll('.projets-image-cell').length === 2);
  check('Un fichier qui n’est pas une image est écarté, en clair, sans bloquer les autres', (await text(page.locator('.projets-images'))).includes('n’est pas une image'));
  check('Le logo d’abord, puis les photos', (await page.locator('.projets-image-cell select').evaluateAll((els) => els.map((e) => e.value))).join() === 'logo,photo');
  await page.locator('.projets-image-cell').nth(1).getByLabel('Sorte d’image').selectOption('maquette');
  await page.waitForFunction(() => [...document.querySelectorAll('.projets-image-cell select')].map((e) => e.value).join() === 'logo,maquette').catch(() => {});
  check('La sorte d’une image se change', (await page.locator('.projets-image-cell select').evaluateAll((els) => els.map((e) => e.value))).join() === 'logo,maquette');
  await page.getByRole('button', { name: 'Agrandir : Maquette' }).click();
  await page.waitForSelector('.projets-viewer img');
  check('L’image s’ouvre en grand, 2 048 px au plus', await page.locator('.projets-viewer img').evaluate((img) => img.naturalWidth > 720 && img.naturalWidth <= 2048));
  await page.keyboard.press('Escape');
  await page.locator('.projets-viewer').waitFor({ state: 'detached' });
  await page.locator('.projets-image-cell').nth(1).getByRole('button', { name: 'Retirer l’image' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.projets-image-cell').length === 1);
  check('Une image se retire', (await page.locator('.projets-image-cell').count()) === 1);

  // --- L'argent ----------------------------------------------------------------
  await page.getByRole('tab', { name: 'Argent' }).click();
  const money = page.locator('.projets-money');
  const payRows = money.locator('.projets-payment');
  check('Un prix fixé : l’échéancier 30 / 70 est posé d’office', (await payRows.count()) === 2 && (await text(payRows.nth(0))).includes('Acompte 30 %') && (await text(payRows.nth(0))).includes('270 €') && (await text(payRows.nth(1))).includes('630 €'));
  check('Rien d’encaissé, tout reste', (await text(money.locator('.projets-money-figures'))).includes('Encaissé 0 €') && (await text(money.locator('.projets-money-figures'))).includes('Reste 900 €'));
  await payRows.nth(0).getByRole('button', { name: 'Reçu' }).click();
  const receiveDialog = page.getByRole('dialog', { name: 'Paiement reçu' });
  check('L’envoi à Budget est coché d’office', await receiveDialog.getByLabel(/Ajouter à Budget/).isChecked());
  await page.fill('#projets-receive-invoice', 'F-2026-001');
  await receiveDialog.getByRole('button', { name: 'C’est reçu' }).click();
  await receiveDialog.waitFor({ state: 'detached' });
  await page.waitForSelector('.projets-payment.received');
  check('Le paiement reçu dit quand, comment, sur quelle facture', (await text(payRows.nth(0))).includes('Reçu le') && (await text(payRows.nth(0))).includes('Virement · F-2026-001'));
  await page.waitForFunction(() => document.querySelector('.projets-payment.received')?.textContent?.includes('dans Budget'));
  check('Et qu’il est dans Budget', (await text(payRows.nth(0))).includes('✓ dans Budget'));
  check('Encaissé et reste suivent', (await text(money.locator('.projets-money-figures'))).includes('Encaissé 270 €') && (await text(money.locator('.projets-money-figures'))).includes('Reste 630 €'));

  await page.getByRole('button', { name: '+ Ajouter un paiement' }).click();
  await page.fill('#projets-pay-label', 'Option logo');
  await page.fill('#projets-pay-amount', '150');
  await page.getByRole('dialog', { name: 'Nouveau paiement' }).getByRole('button', { name: 'Ajouter' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.projets-payment').length === 3);
  check('Un paiement en plus du prix se signale', (await text(money)).includes('dépassent le prix de 150 €'));
  await page.getByRole('button', { name: 'Modifier le paiement Option logo' }).click();
  await page.getByRole('dialog', { name: 'Modifier le paiement' }).getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.projets-payment').length === 2);
  check('Un paiement se supprime', !(await text(money)).includes('Option logo'));

  await page.getByLabel('Durée').fill('beaucoup');
  await page.getByRole('button', { name: 'Noter' }).click();
  check('Une durée illisible est refusée en clair', (await text(money.locator('.notice.error'))).includes('2h30'));
  await page.getByLabel('Durée').fill('2h30');
  await page.getByLabel('Chantier', { exact: true }).selectOption({ label: 'Développement' });
  await page.getByRole('button', { name: 'Noter' }).click();
  await page.waitForSelector('.projets-time-entry');
  check('Le temps passé se note, avec son chantier', (await text(page.locator('.projets-time-entry'))).includes('2 h 30') && (await text(page.locator('.projets-time-entry'))).includes('Développement'));
  check('Le taux horaire réel, sur le prix et sur l’encaissé', (await text(page.locator('.projets-rate'))).includes('360 € / h') && (await text(page.locator('.projets-rate'))).includes('108 € / h'));

  // De l'autre côté : Budget a reçu l'entrée (seule incursion dans un autre module, l'objet même du lien).
  await page.getByRole('button', { name: 'Tous les modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  await page.getByRole('button', { name: /Budget/ }).first().click();
  await page.waitForSelector('.budget-tab');
  const budgetRow = page.locator('.budget-entry-row', { hasText: 'Fleurs de Lou — Acompte 30 %' });
  await budgetRow.first().waitFor({ timeout: 10000 }).catch(() => {});
  check('Budget a reçu l’acompte comme une entrée, à classer sans catégorie « Revenus freelance »', (await budgetRow.count()) === 1 && (await text(budgetRow.locator('.budget-row-amount'))).includes('270,00'));

  // --- Le calque dans Calendar (étape 6) ---------------------------------------
  await page.getByRole('button', { name: 'Tous les modules' }).click();
  await page.waitForSelector('.hub-picker-card');
  await page.locator('.hub-picker-card', { hasText: 'Calendar' }).click();
  const layerTask = page.locator('.calendrier-layer', { hasText: 'Fleurs de Lou · Recevoir les photos' }).first();
  await layerTask.waitFor({ timeout: 10000 }).catch(() => {});
  check('Calendar montre la tâche de projet prévue aujourd’hui, avec son client', (await layerTask.count()) === 1);
  check('Un calque « Projets » parmi les calques', (await page.locator('.calendrier-layer-chip', { hasText: 'Projets' }).count()) === 1);
  await layerTask.locator('.calendrier-mark-title').click();
  await page.locator('.calendrier-mark-dialog').waitFor();
  await page.getByRole('button', { name: 'Modifier dans Projets' }).click();
  const fromCalendar = page.getByRole('dialog', { name: 'Modifier la tâche' });
  await fromCalendar.waitFor({ timeout: 10000 }).catch(() => {});
  check('« Modifier dans Projets » ouvre la fiche du projet et la fenêtre de la tâche', (await page.locator('#projets-task-title').inputValue().catch(() => '')) === 'Recevoir les photos' && (await text(page.locator('.projets-sheet-title'))) === 'Site vitrine');
  await page.keyboard.press('Escape');
  await fromCalendar.waitFor({ state: 'detached' });

  // --- Le tableau de bord ----------------------------------------------------
  await page.getByRole('button', { name: '← Retour' }).click();
  await page.waitForSelector('.projets-card');
  const week = page.locator('section[aria-label="Cette semaine"]');
  check('Cette semaine montre la tâche prévue aujourd’hui, avec son client', (await text(week)).includes('Recevoir les photos') && (await text(week)).includes('Fleurs de Lou'));
  const waiting = page.locator('section[aria-label="En attente du client"]');
  check('L’attente du projet et la tâche qui attend remontent', (await text(waiting)).includes('la validation des tarifs') && (await text(waiting)).includes('Recevoir les photos'));
  const moneyPanel = page.locator('section[aria-label="Argent"]');
  check('L’argent du tableau de bord : encaissé ce mois-ci et reste', (await text(moneyPanel)).includes('Encaissé ce mois-ci270 €') && (await text(moneyPanel)).includes('Reste à encaisser630 €'));
  check('Les questions de besoins à poser remontent aussi', (await text(waiting)).includes('1 question à lui poser') && (await text(waiting)).includes('Qui fournit les photos'));
  const projectCard = page.locator('.projets-card', { hasText: 'Fleurs de Lou' });
  check('La carte du projet dit son statut et ses chantiers en cours', (await text(projectCard)).includes('En production') && (await text(projectCard)).includes('Découverte 1/6'));
  check('Échéance proche et presque tout à faire : le projet est en danger', (await text(projectCard.locator('.projets-risk'))).includes('Mise en ligne dans 5 j'));
  await week.getByRole('button', { name: 'Cocher « Recevoir les photos »' }).click();
  await page.waitForFunction(() => !document.querySelector('section[aria-label="Cette semaine"]')?.textContent?.includes('Recevoir les photos'));
  check('Une tâche cochée depuis le tableau de bord quitte la semaine', !(await text(week)).includes('Recevoir les photos'));

  // --- Un second projet, client existant ou nouveau ------------------------
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
  check('Un client existant est proposé d’office', (await page.locator('#projets-new-client option:checked').textContent()) === 'Fleurs de Lou');
  await page.selectOption('#projets-new-client', '__new__');
  await page.fill('#projets-new-client-name', 'Le Camion Gourmand');
  await page.selectOption('#projets-new-client-trade', 'foodtruck');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('radio', { name: /Projet vide/ }).click();
  await page.fill('#projets-new-title', 'Site et emplacements');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('button', { name: 'Créer le projet' }).click();
  await page.waitForSelector('.projets-sheet');
  check('Un projet vide n’a aucun chantier', (await page.locator('.projets-ws').count()) === 0 && (await text(page.locator('.projets-sheet-progress'))).includes('—'));
  check('Le statut par défaut est « Piste »', (await page.locator('.projets-status-select').inputValue()) === 'lead');

  await page.getByRole('button', { name: /^Projets/ }).click();
  const lanes = await page.locator('.projets-lane-title').allTextContents();
  check('Le pipeline : une colonne par statut, vides comprises', lanes.length === 6 && lanes[0].startsWith('Piste') && lanes[5].startsWith('Maintenance'));
  check('Chaque projet dans la colonne de son statut', (await text(page.getByRole('region', { name: 'Piste' }))).includes('Le Camion Gourmand') && (await text(page.getByRole('region', { name: 'En production' }))).includes('Fleurs de Lou'));
  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  await page.waitForSelector('.projets-card');
  check('Une piste n’est pas un projet actif du tableau de bord', (await page.locator('.projets-card').count()) === 1);

  // --- Le livre des recettes ---------------------------------------------------
  await page.getByRole('button', { name: 'Recettes' }).click();
  await page.waitForSelector('.projets-receipts');
  check('Le livre des recettes liste l’encaissement de l’année', (await page.locator('.projets-table tbody tr').count()) === 1 && (await text(page.locator('.projets-table tbody tr'))).includes('Fleurs de Lou'));
  check('Avec le total de l’année', (await text(page.locator('.projets-receipts-total'))).includes('270 €'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter en CSV' }).click()]);
  const csv = await new Promise((resolve) => {
    download.createReadStream().then((stream) => {
      let body = '';
      stream.on('data', (chunk) => (body += chunk));
      stream.on('end', () => resolve(body));
    });
  });
  check('L’export CSV a l’en-tête et la ligne, à la française', csv.includes('Date;Client;Projet;Objet;Montant (€);Mode de règlement;Facture') && csv.includes(';Fleurs de Lou;Site vitrine;Acompte 30 %;270,00;Virement;F-2026-001'));

  // --- Les clients ------------------------------------------------------------
  await page.getByRole('button', { name: /^Clients/ }).click();
  check('Les deux clients, avec leur métier', (await page.locator('.projets-client').count()) === 2 && (await text(page.locator('.projets-client', { hasText: 'Le Camion Gourmand' }))).includes('Food truck'));
  await page.getByRole('button', { name: 'Modifier Fleurs de Lou' }).click();
  const clientDialog = page.getByRole('dialog', { name: 'Modifier le client' });
  check('Un client qui a des projets s’archive, il ne se supprime pas', (await clientDialog.getByRole('button', { name: 'Archiver' }).isVisible()) && (await clientDialog.getByRole('button', { name: 'Supprimer' }).count()) === 0);
  await page.fill('#projets-client-phone', '06 12 34 56 78');
  await clientDialog.getByRole('button', { name: 'Enregistrer' }).click();
  await clientDialog.waitFor({ state: 'detached' });
  check('Le téléphone se touche pour appeler', (await page.locator('.projets-client', { hasText: 'Fleurs de Lou' }).locator('a[href="tel:0612345678"]').count()) === 1);

  // --- Infos du projet, et le supprimer --------------------------------------
  await page.locator('.projets-client', { hasText: 'Le Camion Gourmand' }).getByRole('button', { name: 'Site et emplacements' }).click();
  await page.getByRole('tab', { name: 'Infos' }).click();
  await page.fill('#projets-infos-price', '1 200');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForSelector('.projets-infos .notice.success');
  check('Les infos s’enregistrent, le prix passe dans l’en-tête', (await text(page.locator('.projets-sheet-meta'))).includes('1 200 €'));
  check('Le numéro du projet est affiché', (await text(page.locator('.projets-infos'))).includes('Projet n° 2'));
  await page.getByRole('button', { name: 'Supprimer le projet' }).click();
  await page.waitForFunction(() => !document.querySelector('.projets-sheet'));
  await page.getByRole('button', { name: /^Projets/ }).click();
  check('Le projet supprimé a disparu', (await page.locator('.projets-mini').count()) === 1);

  // --- Rechargement -----------------------------------------------------------
  await openModule(page);
  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  await page.waitForSelector('.projets-card');
  check('Après un rechargement, le projet et son avancement sont là', (await text(page.locator('.projets-card'))).includes('2 / 46 tâches'));
  await page.locator('.projets-card').click();
  check('Le chantier ajouté, l’attente et le journal sont gardés', (await page.locator('section[aria-label="Chantier Référencement local"]').count()) === 1 && (await text(page.locator('.projets-waitbar'))).includes('la validation des tarifs'));
  await page.getByRole('button', { name: 'C’est reçu' }).click();
  await page.waitForSelector('.projets-wait-btn');
  check('« C’est reçu » lève l’attente', (await page.locator('.projets-waitbar').count()) === 0);

  check('Aucune erreur JavaScript dans le parcours', errors.length === 0);
  await context.close();

  // --- Sur téléphone ------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  mobile.on('dialog', (d) => void d.accept());
  await mobile.goto(BASE);
  await mobile.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    const now = new Date().toISOString();
    raw.projetsClients = [{ id: 'c1', name: 'Boulangerie Ferrand et fils', trade: 'boulangerie', contactName: '', phone: '', email: '', address: '', note: '', archived: false, createdAt: now }];
    raw.projetsProjects = [
      { id: 'p1', clientId: 'c1', number: 1, title: 'Site vitrine avec un titre un peu long', template: 'vitrine', status: 'production', waitingFor: 'les photos de la vitrine', waitingSince: null, startDay: null, dueDay: null, priceCents: 90000, needs: {}, note: '', createdAt: now, updatedAt: now },
    ];
    raw.projetsWorkstreams = [{ id: 'w1', projectId: 'p1', title: 'Hébergement & domaine', position: 0, dueDay: null }];
    raw.projetsTasks = [{ id: 't1', projectId: 'p1', workstreamId: 'w1', title: 'Acheter ou transférer le nom de domaine, au nom du client', note: '', plannedDay: null, dueDay: null, waitingClient: false, position: 0, completedAt: now, createdAt: now }];
    raw.projetsNotes = [];
    localStorage.setItem('palier.v1', JSON.stringify(raw));
  });
  await openModule(mobile);
  await mobile.getByRole('button', { name: 'Tableau de bord' }).click();
  await mobile.waitForSelector('.projets-card');
  const noOverflow = () => mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check('Sur téléphone, le tableau de bord tient dans la largeur', await noOverflow());
  await mobile.locator('.projets-card').click();
  await mobile.locator('section[aria-label="Chantier Hébergement & domaine"] .projets-ws-toggle').click();
  check('Sur téléphone, la fiche tient dans la largeur', await noOverflow());
  await mobile.getByRole('tab', { name: 'Journal' }).click();
  check('Sur téléphone, le journal tient dans la largeur', await noOverflow());
  let tabsFit = true;
  for (const tab of [/Besoins/, 'Design', /Liens/]) {
    await mobile.getByRole('tab', { name: tab }).click();
    await mobile.waitForTimeout(100);
    tabsFit = tabsFit && (await noOverflow());
  }
  check('Sur téléphone, besoins, design et liens tiennent dans la largeur', tabsFit);
  await mobile.getByRole('button', { name: /^Projets/ }).click();
  check('Sur téléphone, le pipeline s’empile et tient dans la largeur', (await noOverflow()) && (await mobile.locator('.projets-lane').count()) === 6);
  await phone.close();
}
