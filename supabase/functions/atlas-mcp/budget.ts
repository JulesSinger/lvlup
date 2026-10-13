/**
 * Les outils de Budget pour Claude (docs/connecteur-claude.md §13) — règles
 * pures, testées par Vitest (`src/modules/budget/lib/mcpTools.test.ts`), qui
 * compare les bornes et la règle de classement à celles du module.
 *
 * Priorité n° 3 de l'analyse du 11/10/2026 : **classer les « à classer »**
 * (la corvée de fin de mois, exactement le raisonnement que Claude fait bien),
 * créer la règle qui rangera les suivantes, comprendre un mois (« pourquoi
 * j'ai dépensé plus ? »), et noter une dépense à la main — y compris d'après
 * la photo d'une addition.
 *
 * Une écriture importée du relevé garde son jour et son montant (ceux de la
 * banque) : on n'en change que la catégorie, le libellé et la note. Les
 * enveloppes et les abonnements restent à l'app pour l'instant. Colonnes :
 * `2026-08-23-budget-tables.sql` et suivantes.
 */
import type { Tool, ToolResult } from './mcp.ts';
import { buildBilan } from './bilan.ts';

export const BUDGET_CATEGORY_KINDS = ['fixe', 'variable', 'revenu', 'transfert', 'epargne'] as const;
export const BUDGET_ENTRY_SOURCES = ['import', 'manuelle'] as const;
export const LABEL_MAX = 200;
export const NOTE_MAX = 1000;
export const RULE_PATTERN_MAX = 120;
/** Au plus tant d'écritures rendues par une lecture : au-delà, Claude affine la période. */
export const LIST_LIMIT = 300;

export interface EntryRow {
  id: string;
  day: string;
  label: string;
  amount_cents: number;
  category_id: string | null;
  source: (typeof BUDGET_ENTRY_SOURCES)[number];
  import_key: string | null;
  note: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  emoji: string;
  kind: (typeof BUDGET_CATEGORY_KINDS)[number];
  parent_id: string | null;
}

export interface RuleRow {
  id: string;
  pattern: string;
  category_id: string;
  priority: number;
}

export interface BudgetData {
  listEntries(from: string, to: string): Promise<EntryRow[]>;
  getEntry(id: string): Promise<EntryRow | null>;
  insertEntry(row: Record<string, unknown>): Promise<EntryRow>;
  updateEntry(id: string, row: Record<string, unknown>): Promise<EntryRow | null>;
  deleteEntry(id: string): Promise<boolean>;
  listCategories(): Promise<CategoryRow[]>;
  listRules(): Promise<RuleRow[]>;
  insertRule(row: Record<string, unknown>): Promise<RuleRow>;
  deleteRule(id: string): Promise<boolean>;
}

export interface BudgetContext {
  data: BudgetData;
  today: string;
}

/** La règle qui range un libellé (`matchRule` du module) : le motif contenu, la plus prioritaire. */
export function matchRule(label: string, rules: readonly RuleRow[]): RuleRow | null {
  const haystack = label.toLowerCase();
  const matching = rules.filter((r) => r.pattern.trim() !== '' && haystack.includes(r.pattern.trim().toLowerCase()));
  if (matching.length === 0) return null;
  return matching.reduce((best, r) => (r.priority > best.priority ? r : best));
}

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const euros = (cents: number) => Math.round(cents) / 100;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function id(v: unknown, what = 'identifiant'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Refused(`${what} invalide : prends-le dans le résultat d’un autre outil.`);
  return v.toLowerCase();
}

function text(v: unknown, what: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new Refused(`${what} manque.`);
    return '';
  }
  if (typeof v !== 'string') throw new Refused(`${what} doit être un texte.`);
  const t = v.trim();
  if (required && !t) throw new Refused(`${what} manque.`);
  if (t.length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return t;
}

function day(v: unknown, what = 'Le jour'): string {
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused(`${what} s’écrit AAAA-MM-JJ.`);
  return v;
}

/** Un montant en euros, positif (« 12,50 ») → centimes. Le sens est donné à part. */
export function readAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\s|€/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) throw new Refused('Le montant : un nombre d’euros positif (12.50) ; le sens se donne dans direction.');
  return Math.round(n * 100);
}

/**
 * Une catégorie par son nom (sans casse ni accents) ou son id. Un nom porté
 * par deux catégories (une sous-catégorie homonyme) demande l'id.
 */
export function resolveCategory(categories: readonly CategoryRow[], v: unknown): CategoryRow | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new Refused('category : le nom ou l’id d’une catégorie, ou null pour « à classer ».');
  if (UUID.test(v)) {
    const found = categories.find((c) => c.id === v.toLowerCase());
    if (!found) throw new Refused('Aucune catégorie avec cet id : relis budget_categories.');
    return found;
  }
  const same = categories.filter((c) => fold(c.name) === fold(v));
  if (same.length === 1) return same[0];
  if (same.length > 1) throw new Refused(`Plusieurs catégories s’appellent « ${v} » : donne son id.`);
  throw new Refused(`Aucune catégorie « ${v} » : choisis parmi budget_categories (les catégories se créent dans l’app).`);
}

function shiftMonths(d: string, months: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCMonth(t.getUTCMonth() + months, 1);
  return t.toISOString().slice(0, 10);
}

function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Refused('month s’écrit AAAA-MM.');
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

const entryOut = (e: EntryRow, categories: readonly CategoryRow[]) => {
  const c = e.category_id ? categories.find((x) => x.id === e.category_id) : undefined;
  const parent = c?.parent_id ? categories.find((x) => x.id === c.parent_id) : undefined;
  return {
    id: e.id,
    day: e.day,
    label: e.label,
    amount: euros(e.amount_cents),
    category: c ? (parent ? `${parent.name} › ${c.name}` : c.name) : null,
    source: e.source === 'import' ? 'relevé' : e.import_key ? 'module' : 'saisie',
    note: e.note || undefined,
  };
};

const S = { id: { type: 'string', description: 'Identifiant (uuid), tel que rendu par un autre outil.' } };

export const budgetTools: Tool<BudgetContext>[] = [
  {
    name: 'budget_categories',
    title: 'Les catégories de Budget',
    description: 'Les catégories (id, nom, nature : fixe, variable, revenu, transfert, epargne ; sous-catégorie de…), et les règles de classement.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { data }) {
      const [categories, rules] = await Promise.all([data.listCategories(), data.listRules()]);
      return json({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          kind: c.kind,
          parent: c.parent_id ? (categories.find((p) => p.id === c.parent_id)?.name ?? null) : null,
        })),
        rules: rules.map((r) => ({ id: r.id, pattern: r.pattern, category: categories.find((c) => c.id === r.category_id)?.name ?? '?', priority: r.priority })),
      });
    },
  },
  {
    name: 'budget_ecritures',
    title: 'Lire les opérations',
    description:
      'Les opérations d’un mois (month, AAAA-MM ; le mois en cours par défaut) ou d’une période, avec leur catégorie. « a_classer » ne garde que celles sans catégorie ; « query » cherche dans le libellé et la note. Montants signés : négatif = dépense, positif = entrée.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        a_classer: { type: 'boolean' },
        query: { type: 'string' },
        category: { type: 'string', description: 'Le nom ou l’id d’une catégorie (ses sous-catégories comprises).' },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const { from, to } =
        typeof args.from === 'string' && typeof args.to === 'string' ? { from: day(args.from, 'from'), to: day(args.to, 'to') } : monthRange(String(args.month ?? today.slice(0, 7)));
      const [entries, categories] = await Promise.all([data.listEntries(from, to), data.listCategories()]);
      const words = fold(text(args.query, 'query', 200)).split(/\s+/).filter(Boolean);
      const cat = args.category === undefined ? null : resolveCategory(categories, args.category);
      const inCat = (e: EntryRow) => !cat || e.category_id === cat.id || categories.find((c) => c.id === e.category_id)?.parent_id === cat.id;
      const found = entries
        .filter((e) => (args.a_classer !== true || e.category_id === null) && inCat(e) && words.every((w) => fold(`${e.label} ${e.note}`).includes(w)))
        .sort((a, b) => b.day.localeCompare(a.day));
      return json({ from, to, total: found.length, shown: Math.min(found.length, LIST_LIMIT), entries: found.slice(0, LIST_LIMIT).map((e) => entryOut(e, categories)) });
    },
  },
  {
    name: 'budget_mois',
    title: 'Le résumé d’un mois',
    description:
      'Un mois (AAAA-MM, le mois en cours par défaut) comme l’onglet Aperçu : dépensé, entré, solde, dépenses par catégorie, opérations à classer — et les mêmes chiffres pour le mois d’avant, pour comparer.',
    inputSchema: { type: 'object', properties: { month: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const month = String(args.month ?? today.slice(0, 7));
      const { from, to } = monthRange(month);
      const [y, m] = month.split('-').map(Number);
      const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const prev = monthRange(prevMonth);
      const [entries, before, categories] = await Promise.all([data.listEntries(from, to), data.listEntries(prev.from, prev.to), data.listCategories()]);
      const rows = (list: EntryRow[]) => ({
        budget: { entries: list, categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parent_id: c.parent_id })) },
      });
      return json({ month, ...buildBilan(rows(entries), from, to).budget as object, previous_month: { month: prevMonth, ...(buildBilan(rows(before), prev.from, prev.to).budget as object) } });
    },
  },
  {
    name: 'budget_classer',
    title: 'Classer des opérations',
    description:
      'Range des opérations dans une catégorie, plusieurs d’un coup : items = [{ id, category }]. Pour que les suivantes se rangent toutes seules, crée aussi une règle (budget_regle_creer). Propose d’abord ton classement à l’utilisateur s’il y a un doute.',
    inputSchema: {
      type: 'object',
      properties: { items: { type: 'array', minItems: 1, maxItems: 300, items: { type: 'object', properties: { id: S.id, category: { type: ['string', 'null'] } }, required: ['id', 'category'] } } },
      required: ['items'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      if (!Array.isArray(args.items) || args.items.length === 0) throw new Refused('items : les opérations à classer.');
      if (args.items.length > 300) throw new Refused('300 opérations au plus à la fois.');
      const categories = await data.listCategories();
      const plan = args.items.map((raw, i) => {
        const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        return { id: id(o.id, `items[${i}].id`), category: resolveCategory(categories, o.category) };
      });
      let done = 0;
      const missing: string[] = [];
      for (const p of plan) {
        if (await data.updateEntry(p.id, { category_id: p.category?.id ?? null })) done++;
        else missing.push(p.id);
      }
      return json({ message: `${done} opération${done > 1 ? 's' : ''} classée${done > 1 ? 's' : ''}.`, not_found: missing.length ? missing : undefined });
    },
  },
  {
    name: 'budget_ecriture_ajouter',
    title: 'Noter une opération',
    description:
      'Note une dépense ou une entrée à la main (une addition, un remboursement d’un ami…). Le relevé importé en fin de mois reconnaîtra seulement les courses et les paiements de Projets : une dépense notée ici puis importée apparaîtra deux fois, préviens l’utilisateur.',
    inputSchema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'AAAA-MM-JJ' },
        label: { type: 'string', maxLength: LABEL_MAX },
        amount: { type: 'number', exclusiveMinimum: 0, description: 'En euros, positif.' },
        direction: { type: 'string', enum: ['depense', 'entree'] },
        category: { type: ['string', 'null'] },
        note: { type: 'string', maxLength: NOTE_MAX },
      },
      required: ['day', 'label', 'amount', 'direction'],
    },
    annotations: {},
    async run(args, { data }) {
      if (args.direction !== 'depense' && args.direction !== 'entree') throw new Refused('direction : depense ou entree.');
      const categories = await data.listCategories();
      const category = args.category === undefined ? null : resolveCategory(categories, args.category);
      const cents = readAmount(args.amount);
      const created = await data.insertEntry({
        day: day(args.day),
        label: text(args.label, 'Le libellé', LABEL_MAX, true),
        amount_cents: args.direction === 'depense' ? -cents : cents,
        category_id: category?.id ?? null,
        source: 'manuelle',
        note: text(args.note, 'La note', NOTE_MAX),
      });
      return json({ message: 'Opération notée.', entry: entryOut(created, categories) });
    },
  },
  {
    name: 'budget_ecriture_modifier',
    title: 'Modifier une opération',
    description:
      'Change la catégorie, le libellé ou la note d’une opération ; et pour une opération saisie à la main, aussi son jour et son montant (une opération du relevé garde ceux de la banque).',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        label: { type: 'string', maxLength: LABEL_MAX },
        category: { type: ['string', 'null'] },
        note: { type: 'string', maxLength: NOTE_MAX },
        day: { type: 'string' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        direction: { type: 'string', enum: ['depense', 'entree'] },
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const entry = await data.getEntry(id(args.id));
      if (!entry) throw new Refused('Aucune opération avec cet identifiant.');
      const categories = await data.listCategories();
      const row: Record<string, unknown> = {};
      if (args.label !== undefined) row.label = text(args.label, 'Le libellé', LABEL_MAX, true);
      if (args.note !== undefined) row.note = text(args.note, 'La note', NOTE_MAX);
      if (args.category !== undefined) row.category_id = resolveCategory(categories, args.category)?.id ?? null;
      if (args.day !== undefined || args.amount !== undefined || args.direction !== undefined) {
        if (entry.source === 'import') throw new Refused('Une opération du relevé garde le jour et le montant de la banque.');
        if (args.day !== undefined) row.day = day(args.day);
        const sign = args.direction === undefined ? Math.sign(entry.amount_cents) || -1 : args.direction === 'entree' ? 1 : -1;
        const cents = args.amount === undefined ? Math.abs(entry.amount_cents) : readAmount(args.amount);
        if (args.amount !== undefined || args.direction !== undefined) row.amount_cents = sign * cents;
      }
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const updated = await data.updateEntry(entry.id, row);
      return json({ message: 'Opération modifiée.', entry: updated && entryOut(updated, categories) });
    },
  },
  {
    name: 'budget_ecriture_supprimer',
    title: 'Supprimer une opération',
    description:
      'Supprime une opération (un doublon, une saisie fausse). Une dépense créée par une course ou un paiement de Projets se retire plutôt depuis son module. Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const entry = await data.getEntry(id(args.id));
      if (!entry) throw new Refused('Aucune opération avec cet identifiant.');
      await data.deleteEntry(entry.id);
      return { text: `Opération « ${entry.label} » du ${entry.day} (${euros(entry.amount_cents)} €) supprimée.` };
    },
  },
  {
    name: 'budget_regle_creer',
    title: 'Créer une règle de classement',
    description:
      'Une règle range toute seule les opérations importées dont le libellé contient un motif (« PICARD » → Courses). Choisis un motif court et sûr, présent dans le libellé brut. Elle s’applique aux prochains imports ; propose budget_classer pour celles déjà là.',
    inputSchema: {
      type: 'object',
      properties: { pattern: { type: 'string', maxLength: RULE_PATTERN_MAX }, category: { type: 'string' }, priority: { type: 'integer', description: 'La plus haute l’emporte si deux règles conviennent.' } },
      required: ['pattern', 'category'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const pattern = text(args.pattern, 'Le motif', RULE_PATTERN_MAX, true);
      if (pattern.length < 3) throw new Refused('Un motif de 3 caractères au moins : trop court, il rangerait n’importe quoi.');
      const [categories, rules] = await Promise.all([data.listCategories(), data.listRules()]);
      const category = resolveCategory(categories, args.category);
      if (!category) throw new Refused('La catégorie de la règle manque.');
      if (rules.some((r) => fold(r.pattern) === fold(pattern))) throw new Refused(`Une règle « ${pattern} » existe déjà.`);
      const priority = typeof args.priority === 'number' && Number.isInteger(args.priority) ? args.priority : 0;
      const created = await data.insertRule({ pattern, category_id: category.id, priority });
      // Les « à classer » des trois derniers mois que la nouvelle règle aurait rangées : à proposer à budget_classer.
      const recent = await data.listEntries(shiftMonths(today, -3), today);
      const all = [...rules, created];
      const would = recent.filter((e) => e.category_id === null && matchRule(e.label, all)?.id === created.id);
      return json({
        message: `Règle créée : « ${pattern} » → ${category.name}.`,
        rule: { id: created.id, pattern, category: category.name, priority },
        to_classify_matching: would.map((e) => entryOut(e, categories)),
      });
    },
  },
  {
    name: 'budget_regle_supprimer',
    title: 'Supprimer une règle',
    description: 'Retire une règle de classement (son id est dans budget_categories). Les opérations déjà rangées le restent.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      if (!(await data.deleteRule(id(args.id)))) throw new Refused('Aucune règle avec cet identifiant.');
      return { text: 'Règle retirée.' };
    },
  },
];
