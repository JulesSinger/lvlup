import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import { hasChildren, isValidParent } from '../lib/categoryHierarchy';
import type {
  BudgetCategory,
  BudgetCategoryInput,
  BudgetEntry,
  BudgetEntryInput,
  BudgetEnvelope,
  BudgetEnvelopeInput,
  BudgetEnvelopeMove,
  BudgetEnvelopeMoveInput,
  BudgetRule,
  BudgetRuleInput,
  BudgetSubscription,
  BudgetSubscriptionInput,
  IgnoredRecurring,
  SubscriptionFrequency,
  SubscriptionRemindDays,
} from '../lib/types';
import type { BudgetBackup, BudgetStore } from './budgetStore';

interface CategoryRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  kind: string;
  position: number;
  parent_id: string | null;
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

interface EnvelopeRow {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  position: number;
}

interface EnvelopeMoveRow {
  id: string;
  envelope_id: string;
  amount_cents: number;
  day: string;
  note: string | null;
  /** Absente tant que la migration du 2026-10-07 n'est pas appliquée. */
  entry_id?: string | null;
  created_at: string;
}

function toCategory(row: CategoryRow): BudgetCategory {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '💶',
    color: row.color ?? '#7c8cf8',
    kind: row.kind as BudgetCategory['kind'],
    position: row.position,
    parentId: row.parent_id,
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

function toEnvelope(row: EnvelopeRow): BudgetEnvelope {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '💶',
    color: row.color ?? '#7c8cf8',
    position: row.position,
  };
}

function toEnvelopeMove(row: EnvelopeMoveRow): BudgetEnvelopeMove {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    amountCents: row.amount_cents,
    day: row.day,
    note: row.note ?? '',
    entryId: row.entry_id ?? null,
    createdAt: row.created_at,
  };
}

interface SubscriptionRow {
  id: string;
  name: string;
  amount_cents: number;
  frequency: SubscriptionFrequency;
  next_day: string;
  category_id: string | null;
  pattern: string;
  remind_days: SubscriptionRemindDays | null;
  created_at: string;
}

function toSubscription(row: SubscriptionRow): BudgetSubscription {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amount_cents,
    frequency: row.frequency,
    nextDay: row.next_day,
    categoryId: row.category_id,
    pattern: row.pattern ?? '',
    remindDays: row.remind_days,
    createdAt: row.created_at,
  };
}

function subscriptionColumns(p: Partial<BudgetSubscriptionInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.amountCents !== undefined) row.amount_cents = Math.round(p.amountCents);
  if (p.frequency !== undefined) row.frequency = p.frequency;
  if (p.nextDay !== undefined) row.next_day = p.nextDay;
  if (p.categoryId !== undefined) row.category_id = p.categoryId;
  if (p.pattern !== undefined) row.pattern = p.pattern;
  if (p.remindDays !== undefined) row.remind_days = p.remindDays;
  return row;
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
    const parentId = input.parentId ?? null;
    const existing = unwrap(await this.client.from('budget_categories').select('*')) as CategoryRow[];
    const categories = existing.map(toCategory);
    if (parentId !== null && !isValidParent(categories, parentId)) {
      throw new Error('Une sous-catégorie ne peut pas elle-même être parente.');
    }
    // Une sous-catégorie hérite toujours la nature de son parent — jamais un
    // choix libre de l'interface, voir la note sur `BudgetCategory`.
    const kind = parentId
      ? (categories.find((c) => c.id === parentId)?.kind ?? 'variable')
      : (input.kind ?? 'variable');
    const siblings = categories.filter((c) => c.parentId === parentId).length;
    const row = unwrap(
      await this.client
        .from('budget_categories')
        .insert({
          user_id: userId,
          name: input.name,
          emoji: input.emoji ?? '💶',
          color: input.color ?? '#7c8cf8',
          kind,
          position: siblings,
          parent_id: parentId,
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
    if (patch.parentId !== undefined) {
      row.parent_id = patch.parentId;
      if (patch.parentId !== null) {
        const existing = unwrap(
          await this.client.from('budget_categories').select('*'),
        ) as CategoryRow[];
        const categories = existing.map(toCategory);
        if (!isValidParent(categories, patch.parentId)) {
          throw new Error('Une sous-catégorie ne peut pas elle-même être parente.');
        }
        if (hasChildren(categories, id)) {
          throw new Error('Une catégorie qui a des sous-catégories ne peut pas en devenir une.');
        }
      }
    }
    const { error } = await this.client.from('budget_categories').update(row).eq('id', id);
    if (error) throw new Error(error.message);
    // La nature d'une sous-catégorie n'est jamais éditée directement (voir
    // CategoryEditor) ; mais si celle du parent change, ses enfants suivent —
    // sans quoi une sous-catégorie promue plus tard porterait une nature
    // devenue fausse depuis longtemps.
    if (patch.kind !== undefined) {
      const { error: cascadeError } = await this.client
        .from('budget_categories')
        .update({ kind: patch.kind })
        .eq('parent_id', id);
      if (cascadeError) throw new Error(cascadeError.message);
    }
  }

  async deleteCategory(id: string) {
    // `on delete set null` (2026-09-06-budget-subcategories.sql) détache déjà
    // les sous-catégories côté base — elles deviennent des catégories
    // normales plutôt que de disparaître avec leur parent.
    const { error } = await this.client.from('budget_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listEntries(): Promise<BudgetEntry[]> {
    // Par paquets : un an d'import bancaire dépasse les 1 000 lignes qu'une
    // requête rend au plus. Tri stable (l'identifiant départage un même jour).
    const rows = await fetchAll<EntryRow>((from, to) =>
      this.client.from('budget_entries').select('*').order('day', { ascending: false }).order('id').range(from, to),
    );
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

  async importEntries(inputs: BudgetEntryInput[]) {
    const userId = await this.requireUserId();
    // Les clés déjà en base, demandées par petits paquets (elles voyagent dans l'adresse).
    const keys = [...new Set(inputs.map((i) => i.importKey).filter((k): k is string => !!k))];
    const known = new Set<string>();
    for (let i = 0; i < keys.length; i += 150) {
      const rows = unwrap(
        await this.client.from('budget_entries').select('import_key').in('import_key', keys.slice(i, i + 150)),
      ) as { import_key: string }[];
      for (const r of rows) known.add(r.import_key);
    }
    const seen = new Set<string>();
    const fresh = inputs.filter((i) => {
      if (!i.importKey) return true;
      if (known.has(i.importKey) || seen.has(i.importKey)) return false;
      seen.add(i.importKey);
      return true;
    });
    let skipped = inputs.length - fresh.length;
    let written = 0;
    const toRow = (input: BudgetEntryInput) => ({
      user_id: userId,
      day: input.day,
      label: input.label,
      amount_cents: Math.round(input.amountCents),
      category_id: input.categoryId ?? null,
      source: input.source ?? 'manuelle',
      import_key: input.importKey ?? null,
      note: input.note ?? '',
    });
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      const { error } = await this.client.from('budget_entries').insert(chunk.map(toRow));
      if (!error) {
        written += chunk.length;
        continue;
      }
      if (!/unique|duplicate|import_key/i.test(error.message)) throw new Error(error.message);
      // Une ligne entrée entre-temps (un autre appareil, un import concurrent) fait
      // refuser tout le paquet : on le reprend ligne par ligne, le doublon seul est sauté.
      for (const input of chunk) {
        const single = await this.client.from('budget_entries').insert(toRow(input));
        if (!single.error) written++;
        else if (/unique|duplicate|import_key/i.test(single.error.message)) skipped++;
        else throw new Error(single.error.message);
      }
    }
    return { written, skipped };
  }

  async setEntriesCategory(ids: string[], categoryId: string | null) {
    // Par paquets : les identifiants voyagent dans l'adresse de la requête.
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await this.client.from('budget_entries').update({ category_id: categoryId }).in('id', ids.slice(i, i + 150));
      if (error) throw new Error(error.message);
    }
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
    const rows = await fetchAll<RuleRow>((from, to) =>
      this.client.from('budget_rules').select('*').order('priority', { ascending: false }).order('id').range(from, to),
    );
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

  async listEnvelopes(): Promise<BudgetEnvelope[]> {
    const rows = unwrap(
      await this.client
        .from('budget_envelopes')
        .select('*')
        .order('position', { ascending: true }),
    ) as EnvelopeRow[];
    return rows.map(toEnvelope);
  }

  async createEnvelope(input: BudgetEnvelopeInput): Promise<BudgetEnvelope> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('budget_envelopes')
      .select('id', { count: 'exact', head: true });
    const row = unwrap(
      await this.client
        .from('budget_envelopes')
        .insert({
          user_id: userId,
          name: input.name,
          emoji: input.emoji ?? '💶',
          color: input.color ?? '#7c8cf8',
          position: count ?? 0,
        })
        .select()
        .single(),
    ) as EnvelopeRow;
    return toEnvelope(row);
  }

  async updateEnvelope(id: string, patch: Partial<BudgetEnvelopeInput>) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (patch.color !== undefined) row.color = patch.color;
    const { error } = await this.client.from('budget_envelopes').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteEnvelope(id: string) {
    // `on delete cascade` (2026-08-25-budget-envelopes.sql) supprime ses
    // mouvements côté base : ses fonds retournent au non-affecté sans rien
    // écrire de plus ici (docs/etude-astra-epargne.md §7 Q5).
    const { error } = await this.client.from('budget_envelopes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listEnvelopeMoves(): Promise<BudgetEnvelopeMove[]> {
    const rows = await fetchAll<EnvelopeMoveRow>((from, to) =>
      this.client.from('budget_envelope_moves').select('*').order('day', { ascending: false }).order('id').range(from, to),
    );
    return rows.map(toEnvelopeMove);
  }

  async createEnvelopeMove(input: BudgetEnvelopeMoveInput): Promise<BudgetEnvelopeMove> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('budget_envelope_moves')
        .insert({
          user_id: userId,
          envelope_id: input.envelopeId,
          amount_cents: Math.round(input.amountCents),
          day: input.day,
          note: input.note ?? '',
          // Seulement quand il y a un lien : un mouvement posé à la main ne
          // dépend pas de la migration du 2026-10-07.
          ...(input.entryId ? { entry_id: input.entryId } : {}),
        })
        .select()
        .single(),
    ) as EnvelopeMoveRow;
    return toEnvelopeMove(row);
  }

  async deleteEnvelopeMove(id: string) {
    const { error } = await this.client.from('budget_envelope_moves').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listSubscriptions(): Promise<BudgetSubscription[]> {
    const rows = unwrap(await this.client.from('budget_subscriptions').select('*').order('next_day')) as SubscriptionRow[];
    return rows.map(toSubscription);
  }

  async createSubscription(input: BudgetSubscriptionInput, id?: string): Promise<BudgetSubscription> {
    const userId = await this.requireUserId();
    const row = { user_id: userId, ...subscriptionColumns(input) };
    if (id) {
      // Rejouable : `on conflict do nothing` sur l'id, puis relecture.
      const { error } = await this.client.from('budget_subscriptions').upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return toSubscription(unwrap(await this.client.from('budget_subscriptions').select('*').eq('id', id).single()) as SubscriptionRow);
    }
    return toSubscription(unwrap(await this.client.from('budget_subscriptions').insert(row).select().single()) as SubscriptionRow);
  }

  async updateSubscription(id: string, patch: Partial<BudgetSubscriptionInput>) {
    const { error } = await this.client.from('budget_subscriptions').update(subscriptionColumns(patch)).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteSubscription(id: string) {
    const { error } = await this.client.from('budget_subscriptions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listIgnoredRecurring(): Promise<IgnoredRecurring[]> {
    const rows = unwrap(await this.client.from('budget_recurring_ignored').select('key, label, created_at')) as {
      key: string;
      label: string;
      created_at: string;
    }[];
    return rows.map((r) => ({ key: r.key, label: r.label, createdAt: r.created_at }));
  }

  async ignoreRecurring(key: string, label: string) {
    const userId = await this.requireUserId();
    const { error } = await this.client
      .from('budget_recurring_ignored')
      .upsert({ user_id: userId, key, label }, { onConflict: 'user_id,key', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async unignoreRecurring(key: string) {
    const { error } = await this.client.from('budget_recurring_ignored').delete().eq('key', key);
    if (error) throw new Error(error.message);
  }

  async exportData(): Promise<BudgetBackup> {
    // Les abonnements à part : des tables manquantes (migration du 2026-10-07 pas
    // encore appliquée) ne doivent pas empêcher de sauvegarder tout le reste.
    const [subscriptions, ignoredRecurring] = await Promise.all([
      this.listSubscriptions().catch(() => []),
      this.listIgnoredRecurring().catch(() => []),
    ]);
    return {
      categories: await this.listCategories(),
      entries: await this.listEntries(),
      rules: await this.listRules(),
      envelopes: await this.listEnvelopes(),
      envelopeMoves: await this.listEnvelopeMoves(),
      subscriptions,
      ignoredRecurring,
    };
  }

  /**
   * Remplace tout : plus simple et plus sûr qu'une fusion ligne à ligne, et
   * cohérent avec le sens d'une restauration de sauvegarde. Les catégories
   * et les enveloppes changent d'id à l'import (Supabase les régénère) : on
   * reconstitue donc les correspondances avant de réinsérer ce qui les
   * référence.
   */
  async importData(data: BudgetBackup) {
    const userId = await this.requireUserId();
    await this.client.from('budget_entries').delete().eq('user_id', userId);
    await this.client.from('budget_rules').delete().eq('user_id', userId);
    await this.client.from('budget_categories').delete().eq('user_id', userId);
    // Les mouvements d'enveloppe partent avec elles (`on delete cascade`) ;
    // supprimer les enveloppes suffit.
    await this.client.from('budget_envelopes').delete().eq('user_id', userId);

    // Les catégories normales d'abord, pour que leurs sous-catégories
    // puissent résoudre le nouvel id de leur parent au second passage.
    const categoryIdMap = new Map<string, string>();
    const ordered = [
      ...(data.categories ?? []).filter((c) => c.parentId === null),
      ...(data.categories ?? []).filter((c) => c.parentId !== null),
    ];
    for (const category of ordered) {
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
            parent_id: category.parentId ? (categoryIdMap.get(category.parentId) ?? null) : null,
          })
          .select()
          .single(),
      ) as CategoryRow;
      categoryIdMap.set(category.id, row.id);
    }

    // Les écritures par paquets (une restauration de plusieurs années en comptait
    // des milliers, une requête chacune) — sauf celles qu'un retrait d'enveloppe
    // désigne : leur nouvel identifiant doit être connu pour garder le lien.
    const linked = new Set((data.envelopeMoves ?? []).map((m) => m.entryId).filter((id): id is string => !!id));
    const entryIdMap = new Map<string, string>();
    const entryRow = (entry: BudgetEntry) => ({
      user_id: userId,
      day: entry.day,
      label: entry.label,
      amount_cents: entry.amountCents,
      category_id: entry.categoryId ? (categoryIdMap.get(entry.categoryId) ?? null) : null,
      source: entry.source,
      import_key: entry.importKey,
      note: entry.note,
    });
    const plain = (data.entries ?? []).filter((e) => !linked.has(e.id));
    for (let i = 0; i < plain.length; i += 500) {
      const { error } = await this.client.from('budget_entries').insert(plain.slice(i, i + 500).map(entryRow));
      if (error) throw new Error(error.message);
    }
    for (const entry of (data.entries ?? []).filter((e) => linked.has(e.id))) {
      const row = unwrap(await this.client.from('budget_entries').insert(entryRow(entry)).select('id').single()) as { id: string };
      entryIdMap.set(entry.id, row.id);
    }

    // Les abonnements après les catégories, dont ils reprennent le nouvel identifiant.
    if (data.subscriptions !== undefined || data.ignoredRecurring !== undefined) {
      await this.client.from('budget_subscriptions').delete().eq('user_id', userId);
      await this.client.from('budget_recurring_ignored').delete().eq('user_id', userId);
    }
    const subscriptions = data.subscriptions ?? [];
    if (subscriptions.length > 0) {
      const { error } = await this.client.from('budget_subscriptions').insert(
        subscriptions.map((sub) => ({
          user_id: userId,
          ...subscriptionColumns(sub),
          category_id: sub.categoryId ? (categoryIdMap.get(sub.categoryId) ?? null) : null,
        })),
      );
      if (error) throw new Error(error.message);
    }
    const ignored = data.ignoredRecurring ?? [];
    if (ignored.length > 0) {
      const { error } = await this.client.from('budget_recurring_ignored').insert(ignored.map((i) => ({ user_id: userId, key: i.key, label: i.label })));
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

    const envelopeIdMap = new Map<string, string>();
    for (const envelope of data.envelopes ?? []) {
      const row = unwrap(
        await this.client
          .from('budget_envelopes')
          .insert({
            user_id: userId,
            name: envelope.name,
            emoji: envelope.emoji,
            color: envelope.color,
            position: envelope.position,
          })
          .select()
          .single(),
      ) as EnvelopeRow;
      envelopeIdMap.set(envelope.id, row.id);
    }

    for (const move of data.envelopeMoves ?? []) {
      const envelopeId = envelopeIdMap.get(move.envelopeId);
      if (!envelopeId) continue; // enveloppe disparue entre-temps : mouvement ignoré
      const { error } = await this.client.from('budget_envelope_moves').insert({
        user_id: userId,
        envelope_id: envelopeId,
        amount_cents: move.amountCents,
        day: move.day,
        note: move.note,
        ...(move.entryId && entryIdMap.has(move.entryId) ? { entry_id: entryIdMap.get(move.entryId) } : {}),
      });
      if (error) throw new Error(error.message);
    }
  }
}
