import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type {
  BudgetCategory,
  BudgetCategoryInput,
  BudgetEntry,
  BudgetEntryInput,
  BudgetRule,
  BudgetRuleInput,
} from '../lib/types';
import type { BudgetBackup, BudgetStore } from './budgetStore';

interface CategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  kind: string;
  position: number;
}

interface EntryRow {
  id: string;
  day: string;
  label: string;
  amount_cents: number;
  category_id: string | null;
  source: string;
  import_key: string | null;
  note: string | null;
  created_at: string;
}

interface RuleRow {
  id: string;
  pattern: string;
  category_id: string;
  priority: number;
}

function toCategory(row: CategoryRow): BudgetCategory {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '💶',
    color: row.color ?? '#7c8cf8',
    kind: row.kind as BudgetCategory['kind'],
    position: row.position,
  };
}

function toEntry(row: EntryRow): BudgetEntry {
  return {
    id: row.id,
    day: row.day,
    label: row.label,
    amountCents: row.amount_cents,
    categoryId: row.category_id,
    source: row.source as BudgetEntry['source'],
    importKey: row.import_key,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

function toRule(row: RuleRow): BudgetRule {
  return { id: row.id, pattern: row.pattern, categoryId: row.category_id, priority: row.priority };
}

/** Budget (Astra) stocké sur Supabase, protégé par le Row Level Security. */
export class SupabaseBudget implements BudgetStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listCategories(): Promise<BudgetCategory[]> {
    const rows = unwrap(
      await this.client
        .from('budget_categories')
        .select('*')
        .order('position', { ascending: true }),
    ) as CategoryRow[];
    return rows.map(toCategory);
  }

  async createCategory(input: BudgetCategoryInput): Promise<BudgetCategory> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('budget_categories')
      .select('id', { count: 'exact', head: true });
    const row = unwrap(
      await this.client
        .from('budget_categories')
        .insert({
          user_id: userId,
          name: input.name,
          emoji: input.emoji ?? '💶',
          color: input.color ?? '#7c8cf8',
          kind: input.kind ?? 'variable',
          position: count ?? 0,
        })
        .select()
        .single(),
    ) as CategoryRow;
    return toCategory(row);
  }

  async updateCategory(id: string, patch: Partial<BudgetCategoryInput>) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.kind !== undefined) row.kind = patch.kind;
    const { error } = await this.client.from('budget_categories').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteCategory(id: string) {
    const { error } = await this.client.from('budget_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listEntries(): Promise<BudgetEntry[]> {
    const rows = unwrap(
      await this.client.from('budget_entries').select('*').order('day', { ascending: false }),
    ) as EntryRow[];
    return rows.map(toEntry);
  }

  async createEntry(input: BudgetEntryInput): Promise<BudgetEntry> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('budget_entries')
        .insert({
          user_id: userId,
          day: input.day,
          label: input.label,
          amount_cents: Math.round(input.amountCents),
          category_id: input.categoryId ?? null,
          source: input.source ?? 'manuelle',
          import_key: input.importKey ?? null,
          note: input.note ?? '',
        })
        .select()
        .single(),
    ) as EntryRow;
    return toEntry(row);
  }

  async updateEntry(id: string, patch: Partial<BudgetEntryInput>) {
    const row: Record<string, unknown> = {};
    if (patch.day !== undefined) row.day = patch.day;
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.amountCents !== undefined) row.amount_cents = Math.round(patch.amountCents);
    if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
    if (patch.source !== undefined) row.source = patch.source;
    if (patch.importKey !== undefined) row.import_key = patch.importKey;
    if (patch.note !== undefined) row.note = patch.note;
    const { error } = await this.client.from('budget_entries').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteEntry(id: string) {
    const { error } = await this.client.from('budget_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listRules(): Promise<BudgetRule[]> {
    const rows = unwrap(
      await this.client.from('budget_rules').select('*').order('priority', { ascending: false }),
    ) as RuleRow[];
    return rows.map(toRule);
  }

  async createRule(input: BudgetRuleInput): Promise<BudgetRule> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('budget_rules')
        .insert({
          user_id: userId,
          pattern: input.pattern,
          category_id: input.categoryId,
          priority: input.priority ?? 0,
        })
        .select()
        .single(),
    ) as RuleRow;
    return toRule(row);
  }

  async updateRule(id: string, patch: Partial<BudgetRuleInput>) {
    const row: Record<string, unknown> = {};
    if (patch.pattern !== undefined) row.pattern = patch.pattern;
    if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
    if (patch.priority !== undefined) row.priority = patch.priority;
    const { error } = await this.client.from('budget_rules').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteRule(id: string) {
    const { error } = await this.client.from('budget_rules').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async exportData(): Promise<BudgetBackup> {
    return {
      categories: await this.listCategories(),
      entries: await this.listEntries(),
      rules: await this.listRules(),
    };
  }

  /**
   * Remplace tout : plus simple et plus sûr qu'une fusion ligne à ligne, et
   * cohérent avec le sens d'une restauration de sauvegarde. Les catégories
   * changent d'id à l'import (Supabase les régénère) : on reconstitue donc
   * les correspondances avant de réinsérer écritures et règles.
   */
  async importData(data: BudgetBackup) {
    const userId = await this.requireUserId();
    await this.client.from('budget_entries').delete().eq('user_id', userId);
    await this.client.from('budget_rules').delete().eq('user_id', userId);
    await this.client.from('budget_categories').delete().eq('user_id', userId);

    const categoryIdMap = new Map<string, string>();
    for (const category of data.categories ?? []) {
      const row = unwrap(
        await this.client
          .from('budget_categories')
          .insert({
            user_id: userId,
            name: category.name,
            emoji: category.emoji,
            color: category.color,
            kind: category.kind,
            position: category.position,
          })
          .select()
          .single(),
      ) as CategoryRow;
      categoryIdMap.set(category.id, row.id);
    }

    for (const entry of data.entries ?? []) {
      const { error } = await this.client.from('budget_entries').insert({
        user_id: userId,
        day: entry.day,
        label: entry.label,
        amount_cents: entry.amountCents,
        category_id: entry.categoryId ? (categoryIdMap.get(entry.categoryId) ?? null) : null,
        source: entry.source,
        import_key: entry.importKey,
        note: entry.note,
      });
      if (error) throw new Error(error.message);
    }

    for (const rule of data.rules ?? []) {
      const categoryId = categoryIdMap.get(rule.categoryId);
      if (!categoryId) continue; // catégorie disparue entre-temps : règle ignorée
      const { error } = await this.client.from('budget_rules').insert({
        user_id: userId,
        pattern: rule.pattern,
        category_id: categoryId,
        priority: rule.priority,
      });
      if (error) throw new Error(error.message);
    }
  }
}
