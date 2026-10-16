/**
 * Le bilan transversal (docs/connecteur-claude.md §12) — en lecture seule,
 * règles pures, testées par Vitest (`src/core/lib/mcpBilan.test.ts`).
 *
 * Priorité n° 2 de l'analyse du 11/10/2026 : « fais le bilan de ma semaine »
 * — le lien entre modules qui n'existe nulle part dans l'app. Chaque module
 * donne ses chiffres de la période ; un module dont la table manque (ou qui
 * n'est pas utilisé) dit simplement « rien », sans empêcher les autres. Claude
 * en fait le récit.
 *
 * Les chiffres suivent les règles des modules : les kilomètres sont ceux des
 * sorties de course (le renfo et le vélo à part) ; les dépenses de Budget
 * écartent les virements et l'épargne, comme le camembert.
 */
import type { Tool, ToolResult } from './mcp.ts';
import { daysBetween, mondayOf, shiftDay } from './recurrence.ts';

export interface BilanRows {
  objectifs?: { goals: { id: string; title: string; archived: boolean }[]; checkins: { goal_id: string; day: string; pp: number }[] };
  sport?: {
    runs: { day: string; distance_m: number; duration_s: number }[];
    activities: { day: string; sport: string; duration_s: number }[];
    sessions: { kind: string; done: boolean }[];
  };
  budget?: {
    entries: { day: string; amount_cents: number; category_id: string | null }[];
    categories: { id: string; name: string; kind: string; parent_id: string | null }[];
  };
  taches?: { done: { title: string; completed_at: string; parent_id: string | null }[]; overdue: number; open: number };
  recettes?: { cooked: { day: string; title: string; rating: number | null }[] };
  courses?: { trips: { day: string; store_name: string; total_cents: number }[] };
  nutrition?: { entries: { day: string; kcal: number }[] };
  hautsfaits?: { feats: { title: string; date_start: string }[] };
}

export interface BilanData {
  /** Les lignes de chaque module pour la période ; une erreur (table absente) laisse le module de côté. */
  load(module: keyof BilanRows, from: string, to: string, today: string): Promise<BilanRows[keyof BilanRows]>;
}

const euros = (cents: number) => Math.round(cents) / 100;

/** Le bilan d'une période, à partir des lignes de chaque module. */
export function buildBilan(rows: BilanRows, from: string, to: string) {
  const days = daysBetween(from, to) + 1;
  const out: Record<string, unknown> = { from, to, days };

  if (rows.objectifs) {
    const { goals, checkins } = rows.objectifs;
    const active = new Set(checkins.map((c) => c.day));
    out.objectifs = {
      checkins: checkins.length,
      pp: checkins.reduce((s, c) => s + c.pp, 0),
      active_days: active.size,
      per_goal: goals
        .filter((g) => !g.archived)
        .map((g) => {
          const mine = checkins.filter((c) => c.goal_id === g.id);
          return { goal: g.title, checkins: mine.length, pp: mine.reduce((s, c) => s + c.pp, 0), days: new Set(mine.map((c) => c.day)).size };
        })
        .sort((a, b) => b.pp - a.pp),
    };
  }

  if (rows.sport) {
    const { runs, activities, sessions } = rows.sport;
    out.sport = {
      runs: runs.length,
      running_km: Math.round(runs.reduce((s, r) => s + r.distance_m, 0) / 100) / 10,
      running_minutes: Math.round(runs.reduce((s, r) => s + r.duration_s, 0) / 60),
      longest_km: runs.length ? Math.round(Math.max(...runs.map((r) => r.distance_m)) / 100) / 10 : 0,
      strength_sessions: activities.filter((a) => a.sport === 'renfo').length,
      bike_sessions: activities.filter((a) => a.sport === 'velo').length,
      climbing_sessions: activities.filter((a) => a.sport === 'escalade').length,
      plan_sessions: sessions.length ? { planned: sessions.length, done: sessions.filter((s) => s.done).length } : null,
    };
  }

  if (rows.budget) {
    const { entries, categories } = rows.budget;
    const byId = new Map(categories.map((c) => [c.id, c]));
    // Comme le camembert de Budget (`computeMonthlyBreakdown`) : virements et épargne écartés, chaque
    // catégorie (sous-catégories comprises dans leur parente) nette de ses remboursements ; une
    // catégorie au net négatif est une dépense, au net positif une entrée.
    const net = new Map<string, number>();
    for (const e of entries) {
      const own = e.category_id ? byId.get(e.category_id) : undefined;
      if (own?.kind === 'transfert' || own?.kind === 'epargne') continue;
      const top = own?.parent_id ? (byId.get(own.parent_id) ?? own) : own;
      const key = top?.name ?? 'À classer';
      net.set(key, (net.get(key) ?? 0) + e.amount_cents);
    }
    const spentBy = [...net.entries()].filter(([, v]) => v < 0).map(([k, v]) => [k, -v] as const);
    const spentCents = spentBy.reduce((s, [, v]) => s + v, 0);
    const incomeCents = [...net.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0);
    out.budget = {
      spent: euros(spentCents),
      income: euros(incomeCents),
      balance: euros(incomeCents - spentCents),
      to_classify: entries.filter((e) => e.category_id === null).length,
      top_categories: spentBy.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, cents]) => ({ category, spent: euros(cents) })),
    };
  }

  if (rows.taches) {
    const done = rows.taches.done.filter((t) => !t.parent_id);
    out.taches = { done: done.length, done_titles: done.slice(0, 20).map((t) => t.title), open_now: rows.taches.open, overdue_now: rows.taches.overdue };
  }

  if (rows.recettes) out.recettes = { cooked: rows.recettes.cooked.map((c) => ({ day: c.day, recipe: c.title, rating: c.rating })) };

  if (rows.courses) {
    const trips = rows.courses.trips;
    out.courses = { trips: trips.length, total: euros(trips.reduce((s, t) => s + t.total_cents, 0)), stores: [...new Set(trips.map((t) => t.store_name).filter(Boolean))] };
  }

  if (rows.nutrition) {
    const perDay = new Map<string, number>();
    for (const e of rows.nutrition.entries) perDay.set(e.day, (perDay.get(e.day) ?? 0) + e.kcal);
    out.nutrition = perDay.size
      ? { logged_days: perDay.size, average_kcal: Math.round([...perDay.values()].reduce((s, v) => s + v, 0) / perDay.size) }
      : { logged_days: 0 };
  }

  if (rows.hautsfaits) out.hautsfaits = { feats: rows.hautsfaits.feats.map((f) => ({ title: f.title, date: f.date_start })) };

  return out;
}

const MODULES: (keyof BilanRows)[] = ['objectifs', 'sport', 'budget', 'taches', 'recettes', 'courses', 'nutrition', 'hautsfaits'];

/** La période demandée : « semaine » (la semaine en cours, du lundi), « mois », ou deux jours. */
export function bilanPeriod(args: Record<string, unknown>, today: string): { from: string; to: string } {
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof args.from === 'string' && typeof args.to === 'string') {
    if (!DAY.test(args.from) || !DAY.test(args.to) || args.to < args.from) throw new Error('from et to : deux jours AAAA-MM-JJ, dans l’ordre.');
    if (daysBetween(args.from, args.to) > 400) throw new Error('Un an au plus à la fois.');
    return { from: args.from, to: args.to };
  }
  switch (args.period ?? 'semaine') {
    case 'semaine':
      return { from: mondayOf(today), to: today };
    case 'semaine_derniere':
      return { from: shiftDay(mondayOf(today), -7), to: shiftDay(mondayOf(today), -1) };
    case 'mois':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'mois_dernier': {
      const first = `${today.slice(0, 7)}-01`;
      const last = shiftDay(first, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
    default:
      throw new Error('period : semaine, semaine_derniere, mois ou mois_dernier (ou from et to).');
  }
}

export const bilanTools: Tool<{ data: BilanData; today: string }>[] = [
  {
    name: 'atlas_bilan',
    title: 'Bilan d’une période, tous modules',
    description:
      'Le bilan d’une semaine ou d’un mois sur tout Atlas, en lecture seule : Objectifs (coches, PP, jours actifs, par objectif), Sport (sorties et km de course, renfo, vélo et escalade à part, séances du plan faites), Budget (dépensé, entré, solde, catégories, à classer), Tâches (faites, en retard), Recettes (cuisinées), Courses (nombre, total), Nutrition (jours notés, kcal moyennes), Hauts faits. Un module absent n’a rien sur la période. Fais-en un récit court, avec ce qui progresse et ce qui coince.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['semaine', 'semaine_derniere', 'mois', 'mois_dernier'] },
        from: { type: 'string', description: 'AAAA-MM-JJ, avec to, à la place de period.' },
        to: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }): Promise<ToolResult> {
      const { from, to } = bilanPeriod(args, today);
      const rows: BilanRows = {};
      await Promise.all(
        MODULES.map(async (m) => {
          try {
            (rows as Record<string, unknown>)[m] = await data.load(m, from, to, today);
          } catch {
            // Table absente ou module pas utilisé : rien à dire.
          }
        }),
      );
      return { text: JSON.stringify(buildBilan(rows, from, to), null, 2) };
    },
  },
];
