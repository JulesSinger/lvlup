/**
 * Lanceur des suites e2e, exécuté sur le build de production servi par
 * `npm run preview` (voir `npm run check` / `npm run check:auth`).
 *
 * Le lanceur ne connaît aucune règle métier : il ouvre le navigateur, prête un
 * `check()` commun, découvre les suites depuis le registre des modules — un
 * module sans dossier `e2e/suite.mjs` se voit immédiatement, `conventions.test.ts`
 * l'exige déjà — puis les fait toutes tourner avant d'imprimer le total.
 *
 * Les suites tournent **en parallèle** (2026-09-16) : chacune ouvre déjà son
 * propre `browser.newContext()`, totalement isolé des autres (stockage,
 * cookies) — rien n'empêchait de les lancer ensemble plutôt qu'à la queue
 * leu leu, sinon le temps total est la somme de toutes les suites plutôt que
 * la durée de la plus longue. Demande de Jules : « les tests e2e prennent
 * énormément de temps ». Chaque suite garde ses lignes `OK`/`FAIL` groupées
 * à l'affichage (sinon elles s'entrelaceraient, illisibles) : le texte est
 * mis de côté pendant l'exécution, puis imprimé bloc par bloc une fois
 * toutes les suites terminées, dans le même ordre qu'avant (socle, puis
 * modules). `Promise.allSettled` plutôt que `Promise.all` : une suite qui
 * plante ne doit pas empêcher de savoir si les trois autres passent.
 */
import { readdirSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';

/** Un `check()` qui met de côté ses lignes au lieu de les imprimer tout de suite. */
function makeChecker() {
  const results = [];
  const lines = [];
  function check(label, condition, detail = '') {
    results.push({ label, ok: Boolean(condition), detail });
    lines.push(`${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  }
  return { check, results, lines };
}

async function discoverModuleSuites() {
  const modulesDir = new URL('../src/modules/', import.meta.url);
  const entries = readdirSync(modulesDir).filter((name) => {
    if (name.startsWith('_')) return false;
    return statSync(new URL(name, modulesDir)).isDirectory();
  });

  const suites = [];
  for (const name of entries) {
    const suiteUrl = new URL(`${name}/e2e/suite.mjs`, modulesDir);
    try {
      statSync(suiteUrl);
    } catch {
      continue; // module sans suite : rien à lancer pour lui
    }
    const mod = await import(suiteUrl.href);
    if (typeof mod.run !== 'function') {
      throw new Error(`La suite e2e du module "${name}" n'exporte pas de run()`);
    }
    suites.push({ name, mod });
  }
  return suites;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const core = await import('./core.mjs');
const jobs = [{ name: 'socle', mod: core }, ...(await discoverModuleSuites())];
const checkers = jobs.map(() => makeChecker());

const outcomes = await Promise.allSettled(
  jobs.map((job, i) => job.mod.run({ browser, check: checkers[i].check, BASE })),
);

await browser.close();

for (let i = 0; i < jobs.length; i++) {
  console.log(`\n--- ${jobs[i].name} ---`);
  for (const line of checkers[i].lines) console.log(line);
  if (outcomes[i].status === 'rejected') {
    console.log(`ERREUR — la suite "${jobs[i].name}" s'est arrêtée en cours : ${outcomes[i].reason}`);
  }
}

const results = checkers.flatMap((c) => c.results);
const failed = results.filter((r) => !r.ok);
const crashed = outcomes.some((o) => o.status === 'rejected');
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 && !crashed ? 0 : 1);
