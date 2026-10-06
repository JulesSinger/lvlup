/**
 * Quelles suites e2e relancer pour un ensemble de fichiers modifiés — règle
 * pure, testée (`affected.test.mjs`), utilisée par `npm run verify`.
 *
 * Né le 06/10/2026 (demande de Jules : « les vérifications prennent vraiment
 * trop de temps ») : lancées ensemble, les dix suites se disputent le
 * processeur et chacune met deux minutes ; seule, celle de Tâches en met
 * huit secondes. On ne relance donc que ce qu'un changement peut casser :
 *
 *  · un fichier d'un module → la suite de ce module ;
 *  · plus celles des modules qui utilisent un service qu'il rend : changer
 *    Tâches relance Calendar (son calque), changer Budget relance Courses et
 *    Projets (leurs dépenses) — lu dans le code, pas recopié ici ;
 *  · un fichier du socle, du lanceur, des dépendances ou de la configuration
 *    → toutes les suites ;
 *  · la documentation, les migrations SQL, les fonctions Supabase → aucune.
 *
 * La suite du socle tourne toujours dès qu'une suite tourne : quatre
 * secondes, et c'est elle qui porte le parcours avec comptes.
 */

/** Ce qui ne change rien à l'app servie : aucune suite à relancer. */
const NO_E2E = [/^docs\//, /^supabase\//, /\.md$/, /^_to_delete\//, /^\.claude\//];

/**
 * @param {string[]} files chemins relatifs à la racine du dépôt
 * @param {{ modules: string[], consumers: Record<string, string[]> }} graph
 *   `consumers[m]` : les modules dont la suite dépend d'un service rendu par `m`
 * @returns {{ all: boolean, suites: string[], reason: string }}
 */
export function affectedSuites(files, graph) {
  const touched = new Set();
  for (const file of files) {
    if (NO_E2E.some((re) => re.test(file))) continue;
    const m = /^src\/modules\/([^/]+)\//.exec(file);
    if (m && graph.modules.includes(m[1])) {
      // Un test unitaire seul ne change rien à l'app servie.
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) continue;
      touched.add(m[1]);
      continue;
    }
    // Un test unitaire, où qu'il soit, ne change rien à l'app servie.
    if (/\.test\.[cm]?[jt]sx?$/.test(file)) continue;
    // Le registre, le socle, le lanceur, les dépendances, la configuration : tout peut bouger.
    return { all: true, suites: ['socle', ...graph.modules], reason: `${file} touche le socle ou la configuration` };
  }
  if (touched.size === 0) return { all: false, suites: [], reason: 'aucun fichier de l’app modifié' };
  const suites = new Set(touched);
  for (const m of touched) for (const c of graph.consumers[m] ?? []) suites.add(c);
  const extra = [...suites].filter((s) => !touched.has(s));
  return {
    all: false,
    suites: ['socle', ...graph.modules.filter((m) => suites.has(m))],
    reason: `modifié : ${[...touched].join(', ')}${extra.length ? ` ; lié : ${extra.join(', ')}` : ''}`,
  };
}

/**
 * Le graphe des services, lu dans le code : `provides: { <service> … }` dans
 * `module.ts` pour qui rend, `services.<service>` ailleurs pour qui utilise.
 *
 * @param {Record<string, { moduleTs: string, sources: string }>} code
 *   par module : le texte de `module.ts`, et celui de ses autres fichiers
 * @param {string[]} serviceNames les clés d'`AtlasServices`
 */
export function serviceGraph(code, serviceNames) {
  const modules = Object.keys(code).sort();
  const consumers = {};
  for (const provider of modules) {
    const provides = /provides\s*:\s*\{([\s\S]*?)\n?\s*\},?\s*\n/.exec(code[provider].moduleTs)?.[1] ?? '';
    const given = serviceNames.filter((s) => new RegExp(`\\b${s}\\s*:`).test(provides));
    consumers[provider] = modules.filter(
      (m) => m !== provider && given.some((s) => new RegExp(`services\\??\\.${s}\\b`).test(code[m].sources)),
    );
  }
  return { modules, consumers };
}
