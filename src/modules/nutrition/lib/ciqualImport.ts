/**
 * Conversion de la table CIQUAL de l'ANSES (XML officiel) vers la forme
 * compacte embarquée dans l'application — docs/etude-nutrition.md §4.
 *
 * Bibliothèque pure, sans accès disque : le script
 * `scripts/import-ciqual.mjs` lit les fichiers et écrit le JSON, ce fichier
 * décide de ce qu'on garde. C'est ici que vivent les choix qui comptent,
 * donc ici qu'ils sont testés.
 *
 * Pas d'import : le script le charge directement avec Node (suppression des
 * types native depuis Node 22.18), sans passer par Vite.
 */

/** Codes des constituants retenus (fichier `const_*.xml` de la table). */
export const CIQUAL_CONSTITUENTS = {
  kcal: '328', // Énergie, règlement UE 1169/2011 (kcal/100 g)
  protein: '25000', // Protéines, N × facteur de Jones (g/100 g)
  carbs: '31000', // Glucides (g/100 g)
  fat: '40000', // Lipides (g/100 g)
  fiber: '34100', // Fibres alimentaires (g/100 g)
  alcohol: '60000', // Alcool (g/100 g) — ne sert qu'à recalculer l'énergie
} as const;

/**
 * Une ligne de la table embarquée : [code, nom, kcal, protéines, glucides,
 * lipides, fibres]. Un tableau plutôt qu'un objet pour diviser le poids du
 * fichier par deux — les noms de champs répétés 3 000 fois coûtent plus que
 * les valeurs. Macros et fibres en décigrammes, fibres `null` si inconnues.
 */
export type CiqualRow = [string, string, number, number, number, number, number | null];

/**
 * Une teneur telle qu'écrite par l'ANSES, en nombre de grammes (ou de kcal).
 *
 * - « 12,5 » → 12,5 ;
 * - « traces » et « < 0,5 » → 0 : une quantité sous le seuil de mesure
 *   pèse moins que l'arrondi au décigramme qu'on en fera de toute façon ;
 * - « - » ou absent → `null` : la valeur n'a pas été mesurée. Ce n'est PAS
 *   zéro, et la confusion fausserait silencieusement un total.
 */
export function parseCiqualValue(raw: string | undefined): number | null {
  const value = decodeEntities(raw ?? '').trim();
  if (value === '' || value === '-') return null;
  if (value === 'traces' || value.startsWith('<')) return 0;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '’')
    .replace(/&amp;/g, '&');
}

/**
 * Énergie d'un aliment dont la table ne donne pas les kcal, avec les
 * coefficients du règlement UE 1169/2011 : 4 par gramme de protéines ou de
 * glucides, 9 pour les lipides, 7 pour l'alcool, 2 pour les fibres. Sans
 * l'alcool, un pastis vaudrait 0 kcal.
 */
export function energyFromNutrients(n: {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  alcohol: number | null;
}): number {
  return 4 * n.protein + 4 * n.carbs + 9 * n.fat + 7 * (n.alcohol ?? 0) + 2 * (n.fiber ?? 0);
}

/** Grammes → décigrammes entiers (12,53 g → 125). */
const toDg = (grams: number) => Math.round(grams * 10);

export interface CiqualConversion {
  rows: CiqualRow[];
  /** Aliments écartés faute d'une macro mesurée, pour le compte rendu du script. */
  skipped: { code: string; name: string }[];
  /** Aliments dont les kcal ont été recalculées depuis leurs nutriments. */
  energyComputed: number;
}

/**
 * Assemble la table à partir des deux fichiers XML de l'ANSES :
 * `alim_*.xml` (les noms) et `compo_*.xml` (les teneurs).
 *
 * Un aliment dont les protéines, les glucides ou les lipides sont inconnus
 * est ÉCARTÉ plutôt que gardé avec un zéro : une fausse valeur qu'on ne voit
 * pas est pire qu'un aliment absent, qu'on remplace par un aliment perso.
 */
export function convertCiqual(alimXml: string, compoXml: string): CiqualConversion {
  const names = new Map<string, string>();
  const alimPattern = /<alim_code>\s*(\d+)\s*<\/alim_code>\s*<alim_nom_fr>([^<]*)<\/alim_nom_fr>/g;
  for (const m of alimXml.matchAll(alimPattern)) {
    names.set(m[1], decodeEntities(m[2]).replace(/\s+/g, ' ').trim());
  }

  const wanted = new Set<string>(Object.values(CIQUAL_CONSTITUENTS));
  const values = new Map<string, Map<string, number | null>>();
  const compoPattern =
    /<alim_code>\s*(\d+)\s*<\/alim_code>\s*<const_code>\s*(\d+)\s*<\/const_code>\s*(?:<teneur>([^<]*)<\/teneur>|<teneur\b[^>]*\/>)/g;
  for (const m of compoXml.matchAll(compoPattern)) {
    if (!wanted.has(m[2])) continue;
    let food = values.get(m[1]);
    if (!food) values.set(m[1], (food = new Map()));
    food.set(m[2], parseCiqualValue(m[3]));
  }

  const rows: CiqualRow[] = [];
  const skipped: CiqualConversion['skipped'] = [];
  let energyComputed = 0;
  const c = CIQUAL_CONSTITUENTS;

  for (const [code, name] of names) {
    const food = values.get(code);
    const get = (constituent: string) => food?.get(constituent) ?? null;
    const protein = get(c.protein);
    const carbs = get(c.carbs);
    const fat = get(c.fat);
    if (protein === null || carbs === null || fat === null) {
      skipped.push({ code, name });
      continue;
    }
    const fiber = get(c.fiber);
    let kcal = get(c.kcal);
    if (kcal === null) {
      kcal = energyFromNutrients({ protein, carbs, fat, fiber, alcohol: get(c.alcohol) });
      energyComputed++;
    }
    rows.push([
      code,
      name,
      Math.round(kcal),
      toDg(protein),
      toDg(carbs),
      toDg(fat),
      fiber === null ? null : toDg(fiber),
    ]);
  }

  rows.sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  return { rows, skipped, energyComputed };
}
