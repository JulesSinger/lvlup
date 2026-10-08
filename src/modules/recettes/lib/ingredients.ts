/**
 * Lire une ligne d'ingrédient en français — bibliothèque pure
 * (docs/etude-recettes.md §4.2, §14).
 *
 * « 2 gousses d'ail » → 2, gousse, « ail ». La ligne telle qu'elle est écrite
 * reste la vérité (rangée telle quelle) ; cette lecture se calcule, et sert à
 * ajuster les quantités, à faire la liste de courses et à chercher. Une ligne
 * qu'on ne sait pas lire (« sel », « Sel poivre ») n'a pas de quantité : elle
 * reste telle quelle, jamais devinée.
 *
 * Écrit et testé sur un corpus de lignes réelles (Marmiton, CuisineAZ :
 * `ingredients.test.ts`), avant tout écran.
 */

export type UnitKind = 'masse' | 'volume' | 'cuillere' | 'piece';

export interface Unit {
  id: string;
  singular: string;
  plural: string;
  kind: UnitKind;
  /** En grammes (masse) ou en millilitres (volume, cuillère) ; absent pour une pièce. */
  base?: number;
  /** Les façons de l'écrire, sans accent ni casse, au singulier. */
  aliases: string[];
}

export const UNITS: readonly Unit[] = [
  { id: 'mg', singular: 'mg', plural: 'mg', kind: 'masse', base: 0.001, aliases: ['mg', 'milligramme'] },
  { id: 'g', singular: 'g', plural: 'g', kind: 'masse', base: 1, aliases: ['g', 'gr', 'gramme'] },
  { id: 'kg', singular: 'kg', plural: 'kg', kind: 'masse', base: 1000, aliases: ['kg', 'kilo', 'kilogramme'] },
  { id: 'ml', singular: 'ml', plural: 'ml', kind: 'volume', base: 1, aliases: ['ml', 'millilitre'] },
  { id: 'cl', singular: 'cl', plural: 'cl', kind: 'volume', base: 10, aliases: ['cl', 'centilitre'] },
  { id: 'dl', singular: 'dl', plural: 'dl', kind: 'volume', base: 100, aliases: ['dl', 'decilitre'] },
  { id: 'l', singular: 'l', plural: 'l', kind: 'volume', base: 1000, aliases: ['l', 'litre'] },
  {
    id: 'cas',
    singular: 'cuillère à soupe',
    plural: 'cuillères à soupe',
    kind: 'cuillere',
    base: 15,
    aliases: ['cuillere a soupe', 'cuilleree a soupe', 'cuil. a soupe', 'cuil a soupe', 'c. a soupe', 'c a soupe', 'c. a s.', 'c. a s', 'c a s', 'c.a.s', 'c.a.s.', 'cas', 'cs', 'c. s.', 'c.s.'],
  },
  {
    id: 'cac',
    singular: 'cuillère à café',
    plural: 'cuillères à café',
    kind: 'cuillere',
    base: 5,
    aliases: ['cuillere a cafe', 'cuilleree a cafe', 'cuil. a cafe', 'cuil a cafe', 'c. a cafe', 'c a cafe', 'c. a c.', 'c. a c', 'c a c', 'c.a.c', 'c.a.c.', 'cac', 'cc', 'c. c.', 'c.c.'],
  },
  { id: 'pincee', singular: 'pincée', plural: 'pincées', kind: 'piece', aliases: ['pincee'] },
  { id: 'gousse', singular: 'gousse', plural: 'gousses', kind: 'piece', aliases: ['gousse'] },
  { id: 'tranche', singular: 'tranche', plural: 'tranches', kind: 'piece', aliases: ['tranche'] },
  { id: 'sachet', singular: 'sachet', plural: 'sachets', kind: 'piece', aliases: ['sachet'] },
  { id: 'paquet', singular: 'paquet', plural: 'paquets', kind: 'piece', aliases: ['paquet'] },
  { id: 'boite', singular: 'boîte', plural: 'boîtes', kind: 'piece', aliases: ['boite'] },
  { id: 'brique', singular: 'brique', plural: 'briques', kind: 'piece', aliases: ['brique'] },
  { id: 'pot', singular: 'pot', plural: 'pots', kind: 'piece', aliases: ['pot'] },
  { id: 'barquette', singular: 'barquette', plural: 'barquettes', kind: 'piece', aliases: ['barquette'] },
  { id: 'bouteille', singular: 'bouteille', plural: 'bouteilles', kind: 'piece', aliases: ['bouteille'] },
  { id: 'botte', singular: 'botte', plural: 'bottes', kind: 'piece', aliases: ['botte'] },
  { id: 'bouquet', singular: 'bouquet', plural: 'bouquets', kind: 'piece', aliases: ['bouquet'] },
  { id: 'brin', singular: 'brin', plural: 'brins', kind: 'piece', aliases: ['brin'] },
  { id: 'branche', singular: 'branche', plural: 'branches', kind: 'piece', aliases: ['branche'] },
  { id: 'feuille', singular: 'feuille', plural: 'feuilles', kind: 'piece', aliases: ['feuille'] },
  { id: 'verre', singular: 'verre', plural: 'verres', kind: 'piece', aliases: ['verre'] },
  { id: 'tasse', singular: 'tasse', plural: 'tasses', kind: 'piece', aliases: ['tasse'] },
  { id: 'bol', singular: 'bol', plural: 'bols', kind: 'piece', aliases: ['bol'] },
  { id: 'poignee', singular: 'poignée', plural: 'poignées', kind: 'piece', aliases: ['poignee'] },
  { id: 'filet', singular: 'filet', plural: 'filets', kind: 'piece', aliases: ['filet'] },
  { id: 'noix', singular: 'noix', plural: 'noix', kind: 'piece', aliases: ['noix'] },
  { id: 'noisette', singular: 'noisette', plural: 'noisettes', kind: 'piece', aliases: ['noisette'] },
  { id: 'morceau', singular: 'morceau', plural: 'morceaux', kind: 'piece', aliases: ['morceau'] },
  { id: 'cube', singular: 'cube', plural: 'cubes', kind: 'piece', aliases: ['cube'] },
  { id: 'rouleau', singular: 'rouleau', plural: 'rouleaux', kind: 'piece', aliases: ['rouleau'] },
  { id: 'baton', singular: 'bâton', plural: 'bâtons', kind: 'piece', aliases: ['baton'] },
  { id: 'tige', singular: 'tige', plural: 'tiges', kind: 'piece', aliases: ['tige'] },
  { id: 'goutte', singular: 'goutte', plural: 'gouttes', kind: 'piece', aliases: ['goutte'] },
  { id: 'carre', singular: 'carré', plural: 'carrés', kind: 'piece', aliases: ['carre'] },
];

const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));
export const unitById = (id: string) => UNIT_BY_ID.get(id) ?? null;

export interface ParsedIngredient {
  quantity: number | null;
  /** La borne haute d'une fourchette (« 2 à 3 oignons ») ; null sinon. */
  quantityMax: number | null;
  unit: string | null;
  /** Le nom, sans quantité ni unité ni ce qui suit (« boeuf haché »). */
  name: string;
  /** Ce qui suit le nom : « + une noix pour le moule », « (facultatif) ». */
  extra: string;
  /** Le nom replié pour comparer : minuscules, sans accent, au singulier. */
  key: string;
  /** Où est écrit le nombre dans le texte (« 2 à 3 ») : on le remplace pour ajuster. */
  span: [number, number] | null;
  /** Où est écrite l'unité (« gousses », « c. à s. ») ; null sans unité. */
  unitSpan: [number, number] | null;
}

/** Minuscules, sans accent ni « œ » — même longueur que le texte, pour garder les positions. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'o')
    .replace(/æ/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

/** Repli plus agressif, pour comparer deux noms : « Œuf(s) entier(s) » → « oeuf entier ». */
export function ingredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(s\)|\(x\)/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' -]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && /[sx]$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  douze: 12,
  demi: 0.5,
  'une demi': 0.5,
  'un demi': 0.5,
};

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛]|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])`;
const WORD = String.raw`(?:une demi|un demi|demi|une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)`;

function readNumber(raw: string): number | null {
  const s = raw.trim();
  if (s in WORDS) return WORDS[s];
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\s*([½¼¾⅓⅔⅛])$/.exec(s);
  if (m) return Number(m[1]) + FRACTIONS[m[2]];
  m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if (s in FRACTIONS) return FRACTIONS[s];
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Les alias, du plus long au plus court : « c. à soupe » avant « c ». */
const ALIASES = UNITS.flatMap((u) => u.aliases.map((a) => ({ alias: a, unit: u }))).sort((a, b) => b.alias.length - a.alias.length);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Une unité au début de `folded` (repliée) : son id et sa longueur, « (s) » et pluriel compris. */
function readUnit(folded: string): { unit: Unit; length: number } | null {
  for (const { alias, unit } of ALIASES) {
    // Le pluriel : « gousses », « morceaux », « cuillères à soupe », « tranche(s) ».
    const head = alias.split(' ')[0];
    const rest = alias.slice(head.length);
    const pattern = new RegExp(`^${escape(head)}(?:\\(s\\)|\\(x\\)|s|x)?${escape(rest)}(?=$|[\\s,;:)(]|\\b)`);
    const m = pattern.exec(folded);
    // Une abréviation d'une lettre (« g », « l ») doit être suivie d'un séparateur : « l » de « lait » n'est pas un litre.
    if (m && (alias.length > 1 || /^[a-z]{1}(?=$|[\s.,;:)])/.test(folded))) return { unit, length: m[0].length };
  }
  return null;
}

/**
 * Une ligne n'est pas un ingrédient mais un titre de groupe : « Pour la pâte : »,
 * « Préparation », « La garniture » — sans quantité, court, ou fini par « : ».
 */
export function isSectionHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 60) return false;
  if (/:\s*$/.test(t)) return true;
  const f = fold(t);
  if (/^(pour (la|le|les|l')\s?\S|preparation$|garniture$|la garniture$|la pate$|la sauce$|decoration$|finition$|montage$)/.test(f)) {
    return !new RegExp(`^${NUMBER}`).test(t);
  }
  return false;
}

/** Lit une ligne. Ne lève jamais : au pire, tout le texte est le nom. */
export function parseIngredient(text: string): ParsedIngredient {
  const original = text;
  // Une puce en tête ne fait pas partie de l'ingrédient.
  const lead = /^\s*(?:[-•*·–]\s*)?/.exec(original)?.[0].length ?? 0;
  const body = original.slice(lead);
  const folded = fold(body);

  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: Unit | null = null;
  let cursor = 0;
  let numberEnd = 0;
  let unitStart = 0;

  const q = new RegExp(`^(${NUMBER}|${WORD})(?=\\s|$|[a-z(])(?:\\s*(?:a|-|–|ou)\\s*(${NUMBER}))?`).exec(folded);
  if (q) {
    quantity = readNumber(q[1]);
    quantityMax = q[2] ? readNumber(q[2]) : null;
    cursor = q[0].length;
    numberEnd = cursor;
    // « une pincée », « un filet » : un nombre en lettres n'est une quantité que suivi d'un nom.
    const after = folded.slice(cursor).replace(/^\s+/, '');
    let u = readUnit(after);
    // « 1 bouquet garni » : une unité de pièce suivie d'un mot en minuscules, sans
    // « de », est le nom lui-même. (« 4 tranche(s) Jambon cru », écrit par
    // CuisineAZ avec une capitale, reste une unité.)
    if (u && u.unit.kind === 'piece' && /^\s+[a-z]/.test(after.slice(u.length)) && !/^\s+(de |d')/.test(after.slice(u.length))) {
      const word = body.slice(folded.length - after.length + u.length).trimStart();
      if (/^[a-zà-ÿ]/.test(word)) u = null;
    }
    if (u) {
      unit = u.unit;
      unitStart = folded.length - after.length;
      cursor = unitStart + u.length;
    }
    if (/^[a-z]/.test(q[1]) && !unit && (!/^\s+\S/.test(folded.slice(cursor)) || /^\s+peu\b/.test(folded.slice(cursor)))) {
      quantity = null;
      quantityMax = null;
      cursor = 0;
    }
  }

  let nameStart = cursor;
  if (quantity !== null) {
    const glue = /^\s*(?:de |d'|d’)?\s*/.exec(body.slice(cursor).replace(/’/g, "'"));
    nameStart = cursor + (glue?.[0].length ?? 0);
  }
  const tail = body.slice(nameStart);
  // Le nom s'arrête à « + », à une virgule ou à une parenthèse qui n'est pas « (s) ».
  const stop = /\s\+\s|,\s|\s\((?![sx]\))/.exec(tail);
  const name = (stop ? tail.slice(0, stop.index) : tail).trim();
  const extra = stop ? tail.slice(stop.index).trim() : '';

  return {
    quantity,
    quantityMax,
    unit: unit?.id ?? null,
    name,
    extra,
    key: ingredientKey(name),
    span: quantity !== null ? [lead, lead + numberEnd] : null,
    unitSpan: quantity !== null && unit ? [lead + unitStart, lead + cursor] : null,
  };
}

/* ------------------------------------------------------------------ */
/* Ajuster au nombre de personnes                                      */
/* ------------------------------------------------------------------ */

const FRACTION_GLYPHS: [number, string][] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

/**
 * Une quantité qui se mesure : grammes à 5 près au-delà de 50, millilitres
 * pareil, cuillères et pièces au quart, litres et kilos au dixième. Écrite
 * à la française (« 1,5 l », « 1 ½ oignon »).
 */
export function formatQuantity(value: number, unit: string | null): string {
  const kind = unit ? unitById(unit)?.kind : 'piece';
  if (kind === 'masse' || kind === 'volume') {
    if (unit === 'kg' || unit === 'l') return trimNumber(Math.max(0.1, Math.round(value * 10) / 10));
    const step = value >= 50 ? 5 : value >= 10 ? 1 : 0.5;
    return trimNumber(Math.max(step, Math.round(value / step) * step));
  }
  // Cuillères et pièces : au quart, jamais zéro.
  const quarters = Math.max(1, Math.round(value * 4));
  const whole = Math.floor(quarters / 4);
  const part = FRACTION_GLYPHS.find(([v]) => Math.abs(v - (quarters % 4) / 4) < 1e-9)?.[1] ?? '';
  if (whole === 0) return part;
  return part ? `${whole} ${part}` : String(whole);
}

function trimNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Pluriel français à partir de 2 (« 1,5 œuf », « 2 œufs »). */
const isPlural = (value: number) => value >= 2;

/**
 * Seulement vers le pluriel : un mot au pluriel qu'on ramènerait au singulier
 * risque l'invariable (« radis », « ananas », « pois ») — « ¾ courgettes » se
 * lit très bien, « 1 ½ radi » non.
 */
function pluralizeWord(word: string, plural: boolean): string {
  if (!plural || /[sxz]$/i.test(word) || word.length < 3) return word;
  if (/eau$/i.test(word)) return `${word}x`;
  return `${word}s`;
}

/**
 * Accorde un nom compté (« oignon jaune » → « oignons jaunes ») : les mots
 * jusqu'à la première préposition, sauf les noms propres (« pommes Golden »).
 * Les « (s) » des sites (« Œuf(s) entier(s) ») deviennent la bonne forme.
 */
export function agreeName(name: string, plural: boolean): string {
  const words = name.split(' ');
  const out: string[] = [];
  let stop = false;
  words.forEach((w, i) => {
    if (stop || /^(de|du|des|d'|d’|à|au|aux|en|pour|avec|sans|bien|assez|très|tres)$/i.test(w) || /^d['’]/i.test(w)) {
      stop = true;
      out.push(w);
      return;
    }
    if (/\((s|x)\)$/.test(w)) {
      out.push(plural ? w.replace(/\((s|x)\)$/, '$1') : w.replace(/\((s|x)\)$/, ''));
      return;
    }
    if (!plural) {
      out.push(w);
      return;
    }
    if (i > 0 && /^[A-Z]/.test(w)) {
      out.push(w);
      return;
    }
    out.push(pluralizeWord(w, plural));
  });
  return out.join(' ');
}

/**
 * La ligne ajustée par `factor` (3 personnes au lieu de 8 : 3/8). Une ligne
 * sans quantité ne change pas. Le reste du texte est gardé tel qu'il est
 * écrit ; seuls la quantité, l'unité et l'accord du nom compté changent.
 */
export function scaleIngredient(text: string, factor: number): string {
  if (factor === 1) return text;
  const p = parseIngredient(text);
  if (p.quantity === null || p.span === null) return text;
  const value = p.quantity * factor;
  const max = p.quantityMax !== null ? p.quantityMax * factor : null;
  const amount = max !== null ? `${formatQuantity(value, p.unit)} à ${formatQuantity(max, p.unit)}` : formatQuantity(value, p.unit);
  const plural = isPlural(max ?? value);
  const [qStart, qEnd] = p.span;

  if (p.unit && p.unitSpan) {
    let unit = unitById(p.unit)!;
    let written = text.slice(p.unitSpan[0], p.unitSpan[1]);
    // 1 200 g se lit mieux 1,2 kg ; 150 cl, 1,5 l.
    const bigger = (unit.id === 'g' && value >= 1000 && 'kg') || ((unit.id === 'ml' && value >= 1000) || (unit.id === 'cl' && value >= 100) ? 'l' : null);
    if (bigger) {
      const target = unitById(bigger)!;
      const ratio = unit.base! / target.base!;
      const big = max !== null ? `${formatQuantity(value * ratio, bigger)} à ${formatQuantity(max * ratio, bigger)}` : formatQuantity(value * ratio, bigger);
      unit = target;
      written = target.singular;
      return `${text.slice(0, qStart)}${big}${text.slice(qEnd, p.unitSpan[0])}${written}${text.slice(p.unitSpan[1])}`;
    }
    // Une abréviation (« g », « cl », « c. à s. ») s'écrit pareil au pluriel :
    // gardée telle quelle. Un mot (« gousse », « cuillère à soupe ») s'accorde.
    const isWord = written.replace(/\(s\)|\(x\)/g, '').length >= 4 && !/[.]/.test(written);
    const unitText = isWord ? (plural ? unit.plural : unit.singular) : written;
    return `${text.slice(0, qStart)}${amount}${text.slice(qEnd, p.unitSpan[0])}${unitText}${text.slice(p.unitSpan[1])}`;
  }
  // Une pièce sans unité : accorder le nom (« 1 oignon » → « 2 oignons »).
  const after = text.slice(qEnd);
  const glue = /^\s*/.exec(after)?.[0] ?? '';
  const rest = after.slice(glue.length);
  if (p.name && rest.startsWith(p.name)) {
    return `${text.slice(0, qStart)}${amount}${glue}${agreeName(p.name, plural)}${rest.slice(p.name.length)}`;
  }
  return `${text.slice(0, qStart)}${amount}${after}`;
}
