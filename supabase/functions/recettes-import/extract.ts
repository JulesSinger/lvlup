/**
 * Une recette dans la page d'un site : les données schema.org (JSON-LD
 * `Recipe`) que les sites publient pour les moteurs de recherche
 * (docs/etude-recettes.md §3.1, vérifié sur Marmiton et CuisineAZ).
 *
 * Règles pures, sans Deno ni réseau : testées par Vitest
 * (`src/modules/recettes/lib/extract.test.ts`), comme `payload.ts` de Sport.
 * La fonction `recettes-import` va chercher la page ; ceci n'en lit que le
 * texte. Le résultat est un BROUILLON, toujours relu avant d'enregistrer.
 */

export const CATEGORIES = ['entree', 'plat', 'dessert', 'aperitif', 'petit-dejeuner', 'accompagnement', 'sauce', 'boisson', 'autre'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface RecipeDraft {
  title: string;
  description: string;
  servings: number | null;
  yieldLabel: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  category: Category;
  tags: string[];
  sourceUrl: string;
  sourceName: string;
  ingredients: { text: string; section: string | null }[];
  steps: { text: string }[];
  /** La photo du site, à rapporter et réduire ; null s'il n'y en a pas. */
  imageUrl: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ocirc: 'ô',
  ucirc: 'û',
  ugrave: 'ù',
  icirc: 'î',
  iuml: 'ï',
  euml: 'ë',
  oelig: 'œ',
  rsquo: '’',
  lsquo: '‘',
  hellip: '…',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
};

/** Le texte d'un champ : sans balises, entités décodées, espaces ramassés. */
export function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    // Une balise de mise en forme (« <b>20 minutes</b>. ») ne sépare pas des mots.
    .replace(/<\/?(?:b|i|em|strong|span|a|u|sup|sub|small|mark)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Les blocs JSON-LD de la page, lus un à un (un bloc illisible n'empêche pas les autres). */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // Certains sites glissent des retours à la ligne bruts dans les chaînes.
      try {
        out.push(JSON.parse(m[1].replace(/[\r\n\t]+/g, ' ')));
      } catch {
        /* bloc ignoré */
      }
    }
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasType = (v: Record<string, unknown>, type: string) =>
  v['@type'] === type || (Array.isArray(v['@type']) && (v['@type'] as unknown[]).includes(type));

/** La première `Recipe` trouvée, à n'importe quelle profondeur (`@graph`, tableaux, `mainEntity`). */
export function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (hasType(node, 'Recipe')) return node;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const found = findRecipe(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/** « PT1H35M » → 95. */
export function isoMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m || /^PT?$/i.test(value.trim())) return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes > 0 && minutes <= 10_080 ? minutes : null;
}

/** « 8 personnes », « 4 », ["6", "6 parts"], « 15 crêpes » → 8 et « personnes ». */
export function readYield(value: unknown): { servings: number | null; yieldLabel: string } {
  const list = Array.isArray(value) ? value : [value];
  let best: { servings: number | null; yieldLabel: string } = { servings: null, yieldLabel: 'personnes' };
  for (const v of list) {
    const text = typeof v === 'number' ? String(v) : clean(v);
    const m = /(\d{1,3})\s*(.*)$/.exec(text);
    if (!m) continue;
    const n = Number(m[1]);
    if (n < 1 || n > 100) continue;
    const word = m[2].trim().toLowerCase();
    const label = !word || /^(pers|people|serving|portion|part)/.test(word) ? 'personnes' : word.slice(0, 40);
    best = { servings: n, yieldLabel: label };
    if (word) break; // Le libellé le plus parlant gagne.
  }
  return best;
}

/** Une catégorie du site vers les nôtres ; « plat » par défaut, la plus fréquente. */
export function mapCategory(value: unknown): Category {
  const list = (Array.isArray(value) ? value : [value]).map((v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  for (const c of list) {
    if (/dessert|gateau|patisserie|tarte sucree|cake|biscuit|confiserie|glace/.test(c)) return 'dessert';
    if (/entree|starter|soupe|veloute|salade composee/.test(c)) return 'entree';
    if (/aperitif|amuse|tapas|appetizer/.test(c)) return 'aperitif';
    if (/petit[- ]dejeuner|breakfast|brunch/.test(c)) return 'petit-dejeuner';
    if (/accompagnement|side/.test(c)) return 'accompagnement';
    if (/sauce|condiment|vinaigrette/.test(c)) return 'sauce';
    if (/boisson|cocktail|drink|smoothie|jus/.test(c)) return 'boisson';
    if (/plat|main|principal|dinner|lunch|viande|poisson|volaille/.test(c)) return 'plat';
  }
  return 'plat';
}

/** Un titre de groupe glissé dans la liste d'ingrédients (« Préparation », « Pour la pâte : »). */
export function isHeading(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 60 || /^\d/.test(t)) return false;
  if (/:\s*$/.test(t)) return true;
  return /^(pour (la|le|les|l['’])\s?\S|préparation$|preparation$|garniture$|la garniture$|la pâte$|la sauce$|décoration$|finition$|montage$)/i.test(t);
}

function readIngredients(value: unknown): { text: string; section: string | null }[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  const out: { text: string; section: string | null }[] = [];
  let section: string | null = null;
  for (const v of list) {
    const text = clean(typeof v === 'string' ? v : isObject(v) ? (v.text ?? v.name) : '');
    if (!text) continue;
    if (isHeading(text)) {
      const name = text.replace(/\s*:\s*$/, '');
      // « Préparation » ou « Ingrédients » glissés dans la liste ne nomment pas un groupe.
      section = /^(préparation|preparation|ingrédients?|ingredients?)$/i.test(name) ? null : name;
      continue;
    }
    out.push({ text: text.slice(0, 300), section });
  }
  return out.slice(0, 150);
}

/** Les étapes : du texte, des `HowToStep`, des `HowToSection` qui en contiennent. */
function readSteps(value: unknown, depth = 0): { text: string }[] {
  if (depth > 3) return [];
  if (typeof value === 'string') {
    return clean(value)
      .split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/)
      .map((t) => t.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .map((text) => ({ text }));
  }
  if (Array.isArray(value)) return value.flatMap((v) => readSteps(v, depth + 1));
  if (!isObject(value)) return [];
  if (hasType(value, 'HowToSection')) {
    const name = clean(value.name);
    const inner = readSteps(value.itemListElement, depth + 1);
    return name && inner.length ? [{ text: `${name} : ${inner[0].text}` }, ...inner.slice(1)] : inner;
  }
  const text = clean(value.text ?? value.name ?? value.description);
  return text ? [{ text }] : [];
}

function readImage(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const url = typeof first === 'string' ? first : isObject(first) ? (first.url ?? first.contentUrl) : null;
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}

function readTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set<string>();
  for (const v of list) {
    const t = clean(v).toLowerCase();
    if (t && t.length <= 40) seen.add(t);
  }
  return [...seen].slice(0, 10);
}

/** Le nom du site : l'éditeur s'il est dit, sinon le domaine sans « www. ». */
function siteName(recipe: Record<string, unknown>, url: string): string {
  const publisher = isObject(recipe.publisher) ? clean(recipe.publisher.name) : '';
  if (publisher) return publisher.slice(0, 200);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** La recette de la page, ou null si la page n'en décrit pas. */
export function extractRecipe(html: string, url: string): RecipeDraft | null {
  let recipe: Record<string, unknown> | null = null;
  for (const block of jsonLdBlocks(html)) {
    recipe = findRecipe(block);
    if (recipe) break;
  }
  if (!recipe) return null;
  // « Boeuf bourguignon : la vraie recette : la meilleure recette » : les formules du site partent.
  let title = clean(recipe.name);
  for (let i = 0; i < 3; i++) title = title.replace(/\s*[:\-–|]\s*(la meilleure recette|la vraie recette|recette facile|recette)\s*$/i, '');
  title = title.slice(0, 200);
  if (!title) return null;
  const prep = isoMinutes(recipe.prepTime);
  const cook = isoMinutes(recipe.cookTime);
  const total = isoMinutes(recipe.totalTime);
  // Le repos : ce que le temps total dit en plus de la préparation et de la cuisson.
  const rest = total !== null && total > (prep ?? 0) + (cook ?? 0) + 5 && (prep !== null || cook !== null) ? total - (prep ?? 0) - (cook ?? 0) : null;
  const { servings, yieldLabel } = readYield(recipe.recipeYield ?? recipe.yield);
  return {
    title,
    description: clean(recipe.description).slice(0, 2000),
    servings,
    yieldLabel,
    prepMinutes: prep ?? (cook === null ? total : null),
    cookMinutes: cook,
    restMinutes: rest,
    category: mapCategory(recipe.recipeCategory),
    tags: readTags(recipe.keywords).filter((t) => t !== title.toLowerCase() && t !== clean(recipe.name).toLowerCase()),
    sourceUrl: url,
    sourceName: siteName(recipe, url),
    ingredients: readIngredients(recipe.recipeIngredient ?? recipe.ingredients),
    steps: readSteps(recipe.recipeInstructions).slice(0, 80),
    imageUrl: readImage(recipe.image),
  };
}
