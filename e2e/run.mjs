/**
 * Lanceur des suites e2e, exécuté sur le build de production servi par
 * `npm run preview` (voir `npm run check` / `npm run check:auth`).
 *
 * Le lanceur ne connaît aucune règle métier : il ouvre le navigateur, prête un
 * `check()` commun, découvre les suites depuis le registre des modules — un
 * module sans dossier `e2e/suite.mjs` se voit immédiatement, `conventions.test.ts`
 * l'exige déjà — puis les fait toutes tourner avant d'imprimer le total.
 */
import { readdirSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const results = [];

function check(label, condition, detail = '') {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
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
    suites.push({ name, mod: await import(suiteUrl.href) });
  }
  return suites;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const core = await import('./core.mjs');
await core.run({ browser, check, BASE });

for (const { name, mod } of await discoverModuleSuites()) {
  if (typeof mod.run !== 'function') {
    throw new Error(`La suite e2e du module "${name}" n'exporte pas de run()`);
  }
  await mod.run({ browser, check, BASE });
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
