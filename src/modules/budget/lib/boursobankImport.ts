import { parseSignedAmountToCents } from './amount';
import { parseCsvRecords } from './csv';
import type { BudgetCategory, BudgetRule } from './types';

/** Sépare les fragments d'une empreinte de dédoublonnage — un caractère qu'un libellé bancaire ne contiendra jamais. */
const UNIT_SEPARATOR = '';

/** Colonnes exigées de l'export (docs/astra-import-boursobank.md §1-2). */
const REQUIRED_COLUMNS = ['dateOp', 'label', 'suggestedLabel', 'category', 'categoryParent', 'amount'] as const;

export interface BoursobankRow {
  day: string;
  /** Libellé brut — fait foi pour le dédoublonnage, jamais affiché seul quand un nom suggéré existe. */
  rawLabel: string;
  /** `suggestedLabel` quand BoursoBank en propose un, sinon le libellé brut (§2 : « nom affiché quand il existe »). */
  displayLabel: string;
  category: string;
  categoryParent: string;
  amountCents: number;
  /** Rang parmi les lignes strictement identiques du fichier (jour + libellé + montant) — voir §4. */
  occurrence: number;
  /** `empreinte(jour | libellé brut | montant | rang)` — l'unicité `(user_id, import_key)` s'appuie dessus. */
  importKey: string;
}

export interface BoursobankParseError {
  line: number;
  reason: string;
}

export interface BoursobankParseResult {
  rows: BoursobankRow[];
  errors: BoursobankParseError[];
}

/**
 * Lit un export BoursoBank (docs/astra-import-boursobank.md). Une ligne
 * illisible (date, montant, colonne manquante) est signalée dans `errors`
 * plutôt que de faire échouer tout le fichier — elle n'apparaîtra
 * simplement pas dans l'aperçu, et rien n'est perdu silencieusement : le
 * compte de lignes retenues face au nombre de lignes du fichier permet de
 * s'en rendre compte.
 */
export function parseBoursobankCsv(text: string): BoursobankParseResult {
  const records = parseCsvRecords(text);
  const errors: BoursobankParseError[] = [];
  const rows: BoursobankRow[] = [];
  const occurrenceByKey = new Map<string, number>();

  records.forEach((record, index) => {
    const lineNumber = index + 2; // +1 pour l'en-tête, +1 pour un numéro 1-indexé

    const missing = REQUIRED_COLUMNS.find((column) => !(column in record));
    if (missing) {
      errors.push({ line: lineNumber, reason: `colonne « ${missing} » absente` });
      return;
    }

    const day = record.dateOp.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      errors.push({ line: lineNumber, reason: `date illisible : « ${record.dateOp} »` });
      return;
    }

    const rawLabel = record.label.trim();
    if (!rawLabel) {
      errors.push({ line: lineNumber, reason: 'libellé vide' });
      return;
    }

    const amountCents = parseSignedAmountToCents(record.amount);
    if (amountCents === null) {
      errors.push({ line: lineNumber, reason: `montant illisible : « ${record.amount} »` });
      return;
    }

    const dedupKey = `${day}${UNIT_SEPARATOR}${rawLabel}${UNIT_SEPARATOR}${amountCents}`;
    const occurrence = (occurrenceByKey.get(dedupKey) ?? 0) + 1;
    occurrenceByKey.set(dedupKey, occurrence);

    rows.push({
      day,
      rawLabel,
      displayLabel: record.suggestedLabel.trim() || rawLabel,
      category: record.category.trim(),
      categoryParent: record.categoryParent.trim(),
      amountCents,
      occurrence,
      importKey: `${dedupKey}${UNIT_SEPARATOR}${occurrence}`,
    });
  });

  return { rows, errors };
}

interface BoursobankMappingRule {
  categoryParent: string;
  /** Si présent, la ligne doit aussi avoir cette `category` exacte — BoursoBank sous-catégorise certains parents ambigus. */
  category?: string;
  /** Nom EXACT (insensible à la casse) de la catégorie Astra visée. */
  astraCategoryName: string;
}

/**
 * Amorce de catégorisation automatique (docs/astra-import-boursobank.md
 * §3) — volontairement incomplète. Le document y liste onze
 * `categoryParent`, mais trois n'ont pas de correspondance fiable :
 * « Auto & Moto » vise une catégorie « Transport » qui n'existe sous aucun
 * nom exact dans `starterCategories.ts` ; « Virements émis » n'a pas de
 * catégorie de départ dédiée ; « Virements reçus » se partage entre
 * Salaire et Aides selon le libellé, sans règle fiable pour trancher.
 * Deviner un nom approché ferait courir exactement le risque documenté en
 * §3 : confondre un vrai virement avec un virement interne, ou une
 * catégorie avec une autre qui lui ressemble. Ces lignes restent donc
 * « à classer » — un clic suffit, et cocher « créer une règle » à ce
 * moment-là les range automatiquement le mois suivant.
 *
 * Une règle existante (`budget_rules`, créée par l'utilisateur) l'emporte
 * toujours sur cette amorce : c'est le mécanisme pensé pour durer, celui-ci
 * n'est qu'un coup de pouce au tout premier import — voir `suggestCategoryId`.
 */
export const BOURSOBANK_CATEGORY_MAP: readonly BoursobankMappingRule[] = [
  { categoryParent: 'Mouvements internes débiteurs', astraCategoryName: 'Virements internes' },
  { categoryParent: 'Mouvements internes créditeurs', astraCategoryName: 'Virements internes' },
  { categoryParent: 'Abonnements & téléphonie', astraCategoryName: 'Abonnements' },
  { categoryParent: 'Santé', astraCategoryName: 'Santé' },
  { categoryParent: 'Voyages & Transports', astraCategoryName: 'Voyages' },
  { categoryParent: 'Vie quotidienne', category: 'Alimentation', astraCategoryName: 'Courses' },
  {
    categoryParent: 'Loisirs et sorties',
    category: 'Divertissement - culture (ciné, théâtre, concerts…)',
    astraCategoryName: 'Sorties & loisirs',
  },
];

function findCategoryByExactName(categories: BudgetCategory[], name: string): BudgetCategory | undefined {
  const normalized = name.trim().toLowerCase();
  return categories.find((c) => c.name.trim().toLowerCase() === normalized);
}

/**
 * La règle de plus haute priorité dont le motif apparaît dans le libellé
 * brut, insensible à la casse. Exportée : c'est aussi le moteur de la
 * suggestion par mots-clés de la saisie manuelle (`EntryEditor`,
 * docs/etude-astra.md — amélioration post-V1 du 31/08/2026), qui n'a rien
 * de spécifique à l'import — un libellé est un libellé.
 */
export function matchRule(rawLabel: string, rules: BudgetRule[]): BudgetRule | null {
  const haystack = rawLabel.toLowerCase();
  const matching = rules.filter((r) => r.pattern.trim() !== '' && haystack.includes(r.pattern.trim().toLowerCase()));
  if (matching.length === 0) return null;
  return matching.reduce((best, r) => (r.priority > best.priority ? r : best));
}

/** Catégorie suggérée pour une ligne importée : une règle utilisateur d'abord, l'amorce BoursoBank ensuite, sinon aucune. */
export function suggestCategoryId(row: BoursobankRow, categories: BudgetCategory[], rules: BudgetRule[]): string | null {
  const rule = matchRule(row.rawLabel, rules);
  if (rule) return rule.categoryId;

  const mapping = BOURSOBANK_CATEGORY_MAP.find(
    (m) => m.categoryParent === row.categoryParent && (m.category === undefined || m.category === row.category),
  );
  if (!mapping) return null;
  return findCategoryByExactName(categories, mapping.astraCategoryName)?.id ?? null;
}

export interface ImportPreviewRow {
  row: BoursobankRow;
  suggestedCategoryId: string | null;
}

export interface ImportPreview {
  /** Lignes absentes des écritures déjà connues — celles qu'un « Valider » écrirait. */
  nouvelles: ImportPreviewRow[];
  /** Nombre de lignes dont l'empreinte est déjà connue — réimporter le même relevé ne crée rien (§4). */
  connuesCount: number;
}

/** Sépare les lignes déjà connues (par empreinte) des nouvelles, et suggère une catégorie pour ces dernières. */
export function buildImportPreview(
  rows: BoursobankRow[],
  existingImportKeys: ReadonlySet<string>,
  categories: BudgetCategory[],
  rules: BudgetRule[],
): ImportPreview {
  const nouvelles: ImportPreviewRow[] = [];
  let connuesCount = 0;
  for (const row of rows) {
    if (existingImportKeys.has(row.importKey)) {
      connuesCount++;
      continue;
    }
    nouvelles.push({ row, suggestedCategoryId: suggestCategoryId(row, categories, rules) });
  }
  return { nouvelles, connuesCount };
}
