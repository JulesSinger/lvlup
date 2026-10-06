/**
 * `npm run verify` — toutes les vérifications d'un changement, en une
 * commande, en ne relançant que ce qu'il peut casser (06/10/2026, demande de
 * Jules : « les vérifications à chaque dev prennent vraiment trop de temps »).
 *
 * Avant, il fallait enchaîner `npm run test` (30 s), `npm run build` (18 s),
 * lancer `preview` à la main, `npm run check` (les dix suites ensemble, près
 * de 4 min : elles se disputent le processeur), puis tout refaire en mode
 * comptes. Ici :
 *
 *  · les fichiers modifiés depuis ce qui est en ligne (`origin/main`, plus
 *    ce qui n'est pas encore commité) décident des suites e2e à lancer
 *    (`affected.mjs`) — Tâches seule : 8 s au lieu de 2 min ;
 *  · les tests unitaires liés aux fichiers modifiés seulement (`vitest --changed`) ;
 *  · types, lint, tests unitaires et e2e tournent en même temps ;
 *  · les deux builds (local et comptes) sont servis par la commande elle-même,
 *    sur des ports à part : rien à lancer avant, rien qui reste derrière ;
 *  · le mode comptes est vérifié au même passage (le socle le porte).
 *
 * `npm run verify -- --all` : tout, comme avant de pousser. `--base=<ref>` :
 * comparer à autre chose qu'`origin/main`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { affectedSuites, serviceGraph } from './affected.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

// --- Ce qui a changé ------------------------------------------------------------------------
function baseRef() {
  const given = args.find((a) => a.startsWith('--base='))?.slice(7);
  if (given) return given;
  try {
    return git('merge-base', 'HEAD', 'origin/main');
  } catch {
    return 'HEAD';
  }
}
const base = baseRef();
const changed = [
  ...new Set(
    [git('diff', '--name-only', base), git('ls-files', '--others', '--exclude-standard')]
      .join('\n')
      .split('\n')
      .filter(Boolean),
  ),
];

// --- Quelles suites ---------------------------------------------------------------------------
function readSources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'e2e' ? [] : readSources(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [readFileSync(path, 'utf8')] : [];
  });
}
const modulesDir = join(ROOT, 'src/modules');
const code = {};
for (const m of readdirSync(modulesDir).filter((n) => !n.startsWith('_') && statSync(join(modulesDir, n)).isDirectory())) {
  code[m] = { moduleTs: readFileSync(join(modulesDir, m, 'module.ts'), 'utf8'), sources: readSources(join(modulesDir, m)).join('\n') };
}
const servicesTs = readFileSync(join(ROOT, 'src/core/lib/services.ts'), 'utf8');
const serviceNames = [...(/interface AtlasServices \{([\s\S]*?)\n\}/.exec(servicesTs)?.[1] ?? '').matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
const graph = serviceGraph(code, serviceNames);
const plan = ALL ? { all: true, suites: ['socle', ...graph.modules], reason: '--all' } : affectedSuites(changed, graph);

console.log(`Comparé à ${base === 'HEAD' ? 'HEAD' : base.slice(0, 8)} : ${changed.length} fichier(s) modifié(s).`);
console.log(plan.suites.length ? `Suites e2e : ${plan.all ? 'toutes' : plan.suites.join(', ')} (${plan.reason}).` : `Aucune suite e2e (${plan.reason}).`);

// --- Lancer --------------------------------------------------------------------------------
/** Une commande, sortie mise de côté : affichée seulement si elle échoue (ou pour l'e2e). */
function run(name, cmd, cmdArgs, env = {}) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ name, ok: code === 0, out, ms: Date.now() - t0 }));
  });
}

/** Un `vite preview` sur un port à part, prêt quand il répond. */
async function serve(outDir, port) {
  const child = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return child;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`Le serveur de ${outDir} ne répond pas sur le port ${port}.`);
}

const LOCAL = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
const AUTH = { VITE_SUPABASE_URL: 'https://exemple.supabase.co', VITE_SUPABASE_ANON_KEY: 'cle-factice-pour-les-tests' };
const started = Date.now();

const checks = [
  run('types', 'npx', ['tsc', '-b']),
  run('lint', 'npx', ['oxlint']),
  run('tests unitaires', 'npx', ['vitest', 'run', '--passWithNoTests', ...(ALL ? [] : ['--changed', base])]),
];

async function e2e() {
  if (plan.suites.length === 0) return { name: 'e2e', ok: true, out: '', ms: 0, skipped: true };
  const t0 = Date.now();
  const builds = await Promise.all([
    run('build', 'npx', ['vite', 'build', '--outDir', 'dist-verify'], LOCAL),
    run('build comptes', 'npx', ['vite', 'build', '--outDir', 'dist-verify-auth'], AUTH),
  ]);
  const failedBuild = builds.find((b) => !b.ok);
  if (failedBuild) return { ...failedBuild, name: 'e2e (build)', ms: Date.now() - t0 };
  const servers = await Promise.all([serve('dist-verify', 4183), serve('dist-verify-auth', 4184)]);
  try {
    const result = await run('e2e', 'node', ['e2e/run.mjs', ...plan.suites], { BASE: 'http://localhost:4183', AUTH_BASE: 'http://localhost:4184' });
    return { ...result, ms: Date.now() - t0 };
  } finally {
    for (const s of servers) s.kill();
  }
}

const results = await Promise.all([...checks, e2e()]);

// --- Le compte rendu ---------------------------------------------------------------------------
const seconds = (ms) => `${Math.round(ms / 1000)} s`;
for (const r of results) {
  if (r.name === 'e2e' && !r.skipped) {
    // Les suites e2e : seulement les échecs et le total, le détail est long.
    const lines = r.out.split('\n').filter((l) => /^(FAIL|ERREUR|--- )|vérifications passées|Suite inconnue/.test(l));
    if (!r.ok) console.log(`\n${r.out}`);
    else console.log(`\n${lines.filter((l) => !l.startsWith('--- ')).join('\n')}`);
  } else if (!r.ok) {
    console.log(`\n--- ${r.name} : échec ---\n${r.out.trim().split('\n').slice(-40).join('\n')}`);
  }
}
console.log('');
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.skipped ? ' (rien à relancer)' : ` — ${seconds(r.ms)}`}`);
const ok = results.every((r) => r.ok);
console.log(`\n${ok ? 'Tout passe' : 'Des vérifications échouent'}, en ${seconds(Date.now() - started)}.${ALL ? '' : ' Avant de pousser : npm run verify -- --all'}`);
process.exit(ok ? 0 : 1);
