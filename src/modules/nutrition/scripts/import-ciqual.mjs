/**
 * Régénère la table CIQUAL embarquée dans Cérès — docs/etude-nutrition.md §4.
 *
 * À lancer une fois par nouvelle version de la table de l'ANSES, pas à
 * chaque build : le JSON produit est commité avec le code.
 *
 * 1. Télécharger `alim_*.xml` et `compo_*.xml` depuis le jeu de données
 *    officiel (Licence Ouverte / Etalab 2.0) :
 *    https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY
 * 2. `node src/modules/nutrition/scripts/import-ciqual.mjs <dossier des XML> <version>`
 *    par exemple `… ~/Téléchargements/ciqual 2025_11_03`.
 *
 * Les règles de conversion (traces, valeurs inconnues, kcal manquantes)
 * vivent dans `lib/ciqualImport.ts`, testé ; ce script ne fait que lire et
 * écrire des fichiers.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertCiqual } from '../lib/ciqualImport.ts';

const [dir, version] = process.argv.slice(2);
if (!dir || !version) {
  console.error('Usage : node import-ciqual.mjs <dossier des XML> <version, ex. 2025_11_03>');
  process.exit(1);
}

function find(prefix) {
  const name = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.xml'));
  if (!name) throw new Error(`Aucun fichier ${prefix}*.xml dans ${dir}`);
  return readFileSync(join(dir, name), 'utf8');
}

const { rows, skipped, energyComputed } = convertCiqual(find('alim_2'), find('compo_'));

const output = new URL('../data/ciqual.json', import.meta.url);
const table = {
  source: 'Table de composition nutritionnelle des aliments Ciqual, ANSES',
  licence: 'Licence Ouverte / Etalab 2.0',
  version,
  foods: rows,
};
// Une ligne par aliment : un diff lisible le jour d'une mise à jour de la table.
const body = `{\n${Object.entries(table)
  .filter(([key]) => key !== 'foods')
  .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  .join('\n')}\n  "foods": [\n${rows.map((r) => `    ${JSON.stringify(r)}`).join(',\n')}\n  ]\n}\n`;
writeFileSync(output, body);

console.log(`${rows.length} aliments écrits dans ${output.pathname}`);
console.log(`${energyComputed} dont les kcal ont été recalculées depuis leurs nutriments`);
console.log(`${skipped.length} écartés faute d'une macro mesurée :`);
for (const { code, name } of skipped) console.log(`  ${code}  ${name}`);
