/**
 * Les outils d'Objectifs pour Claude (docs/connecteur-claude.md §14) — règles
 * pures, testées par Vitest (`src/modules/objectifs/lib/mcpTools.test.ts`),
 * qui compare le comptage des paliers à celui du module.
 *
 * Priorité n° 5 de l'analyse du 11/10/2026 : « j'ai lu 30 pages ce soir »,
 * « où j'en suis de mes objectifs ? ». Claude coche une action (avec sa
 * quantité), note un geste ponctuel, défait une coche, et dit où en est
 * chaque palier — sans ouvrir l'app.
 *
 * Ce que Claude ne fait pas : **valider un palier**. Un palier atteint par
 * une coche venue d'ailleurs (Sport, un autre appareil, Claude) est validé
 * par l'app à son ouverture, sans cérémonie (`ZenithScreen`, « rattrapage
 * silencieux ») ; Claude le dit, pour que la nouvelle ne se perde pas.
 * Ni créer d'objectif : l'échelle des paliers se construit dans l'app.
 *
 * Les PP d'une coche sont ceux de l'action au moment de la poser, figés
 * (CLAUDE.md §6). Une coche tenue par Sport (`ref`) n'est jamais réécrite ni
 * retirée ici, comme dans l'app.
 */
import type { Tool, ToolResult } from './mcp.ts';
import { daysBetween, shiftDay } from './recurrence.ts';

export const TIER_KINDS = ['jalon', 'compte', 'cumul', 'serie', 'performance', 'mesure'] as const;
export const RANKS = [
  { id: 'fer', label: 'Fer', value: 1 },
  { id: 'bronze', label: 'Bronze', value: 2 },
  { id: 'argent', label: 'Argent', value: 3 },
  { id: 'or', label: 'Or', value: 4 },
  { id: 'platine', label: 'Platine', value: 5 },
  { id: 'emeraude', label: 'Émeraude', value: 6 },
  { id: 'diamant', label: 'Diamant', value: 7 },
  { id: 'maitre', label: 'Maître', value: 8 },
  { id: 'grand-maitre', label: 'Grand Maître', value: 9 },
  { id: 'challenger', label: 'Challenger', value: 10 },
] as const;
export const ONE_OFF_PP = 10;
const NOTE_MAX = 500;
const ONE_OFF_TITLE_MAX = 120;

export interface Tier {
  id: string;
  goalId: string;
  title: string;
  rank: string;
  position: number;
  completedAt: string | null;
  kind: (typeof TIER_KINDS)[number];
  target: number | null;
  unit: string;
  direction: 'hausse' | 'baisse';
  mode: 'absolu' | 'delta';
  sources: string[];
}

export interface Goal {
  id: string;
  title: string;
  emoji: string;
  archived: boolean;
  createdAt: string;
  tiers: Tier[];
}

export interface Action {
  id: string;
  goalId: string;
  title: string;
  pp: number;
  archived: boolean;
  unit: string;
  defaultValue: number | null;
  isMeasure: boolean;
}

export interface Checkin {
  id: string;
  goalId: string;
  actionId: string | null;
  pp: number;
  day: string;
  note: string;
  createdAt: string;
  value: number | null;
  title: string | null;
  ref?: string | null;
}

// --- Le comptage des paliers (copie de `lib/counters.ts`) ---------------------

export interface TierProgress {
  current: number;
  target: number;
  percent: number;
  reached: boolean;
  best: number | null;
  baseline: number | null;
  latest: number | null;
}

export function isCountable(tier: Tier): boolean {
  return tier.kind !== 'jalon' && typeof tier.target === 'number';
}

function feedsByDefault(tier: Tier, action: Action | undefined): boolean {
  if (!action) return true;
  if (tier.kind === 'mesure') return action.isMeasure;
  return !action.isMeasure;
}

export function feedingCheckins(tier: Tier, checkins: Checkin[], actions: Action[] = []): Checkin[] {
  const sources = new Set(tier.sources);
  const byId = new Map(actions.map((a) => [a.id, a]));
  return checkins.filter((c) => {
    if (c.goalId !== tier.goalId) return false;
    if (c.title !== null) return false;
    if (sources.size > 0) return c.actionId !== null && sources.has(c.actionId);
    return feedsByDefault(tier, c.actionId ? byId.get(c.actionId) : undefined);
  });
}

export function contribution(checkin: Checkin, actions: Action[]): number {
  if (typeof checkin.value === 'number') return checkin.value;
  const action = actions.find((a) => a.id === checkin.actionId);
  if (action && typeof action.defaultValue === 'number') return action.defaultValue;
  return 0;
}

function distinctDays(checkins: Checkin[]): string[] {
  return [...new Set(checkins.map((c) => c.day))].sort();
}

function seriesCounts(days: string[], today: string): { current: number; best: number } {
  if (days.length === 0) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const last = days[days.length - 1];
  const gap = daysBetween(last, today);
  const current = gap <= 1 ? run : 0;
  return { current, best };
}

export function tierProgress(tier: Tier, actions: Action[], checkins: Checkin[], today: string): TierProgress | null {
  if (!isCountable(tier)) return null;
  const target = tier.target as number;
  const feeding = feedingCheckins(tier, checkins, actions).filter((c) => c.day <= today);
  const empty: TierProgress = { current: 0, target, percent: 0, reached: false, best: null, baseline: null, latest: null };

  switch (tier.kind) {
    case 'compte': {
      const current = distinctDays(feeding).length;
      return { ...empty, current, percent: target === 0 ? 0 : Math.min(1, current / target), reached: current >= target };
    }
    case 'cumul': {
      const current = feeding.reduce((sum, c) => sum + contribution(c, actions), 0);
      return { ...empty, current, percent: target === 0 ? 0 : Math.min(1, current / target), reached: current >= target };
    }
    case 'serie': {
      const { current, best } = seriesCounts(distinctDays(feeding), today);
      const peak = Math.max(current, best);
      return { ...empty, current, best, percent: target === 0 ? 0 : Math.min(1, current / target), reached: peak >= target };
    }
    case 'performance': {
      const values = feeding.map((c) => contribution(c, actions)).filter((v) => Number.isFinite(v) && v !== 0);
      if (values.length === 0) return empty;
      const best = tier.direction === 'baisse' ? Math.min(...values) : Math.max(...values);
      const reached = tier.direction === 'baisse' ? best <= target : best >= target;
      return {
        ...empty,
        current: best,
        best,
        percent: target === 0 ? 0 : Math.min(1, tier.direction === 'baisse' ? target / best : best / target),
        reached,
      };
    }
    case 'mesure': {
      const relevés = feeding
        .filter((c) => typeof c.value === 'number')
        .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt));
      if (relevés.length === 0) return empty;
      const baseline = relevés[0].value as number;
      const latest = relevés[relevés.length - 1].value as number;
      const absolute = tier.mode === 'delta' ? baseline + target : target;
      const satisfied = (v: number) => (tier.direction === 'baisse' ? v <= absolute : v >= absolute);
      const reached = relevés.some((c) => satisfied(c.value as number));
      const span = absolute - baseline;
      const done = latest - baseline;
      const percent = span === 0 ? (reached ? 1 : 0) : Math.max(0, Math.min(1, done / span));
      return {
        current: done,
        target: span,
        percent,
        reached,
        best: tier.direction === 'baisse' ? Math.min(...relevés.map((c) => c.value as number)) : Math.max(...relevés.map((c) => c.value as number)),
        baseline,
        latest,
      };
    }
    default:
      return null;
  }
}

const rankOf = (id: string) => RANKS.find((r) => r.id === id) ?? RANKS[0];

/** Le rang d'un objectif : celui du palier validé le plus élevé (CLAUDE.md §6). */
export function goalRank(goal: Goal): string | null {
  const best = goal.tiers.filter((t) => t.completedAt).reduce<Tier | null>((acc, t) => (!acc || rankOf(t.rank).value > rankOf(acc.rank).value ? t : acc), null);
  return best ? rankOf(best.rank).label : null;
}

// --- Les outils ---------------------------------------------------------------

export interface ObjectifsData {
  listGoals(): Promise<Goal[]>;
  listActions(): Promise<Action[]>;
  listCheckins(): Promise<Checkin[]>;
  insertCheckin(row: Record<string, unknown>): Promise<Checkin>;
  updateCheckin(id: string, row: Record<string, unknown>): Promise<void>;
  deleteCheckin(id: string): Promise<void>;
}

export interface ObjectifsContext {
  data: ObjectifsData;
  today: string;
}

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const round = (n: number) => Math.round(n * 100) / 100;

function day(v: unknown, today: string): string {
  if (v === undefined) return today;
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused('day s’écrit AAAA-MM-JJ.');
  if (v > today) throw new Refused('On ne coche pas un jour à venir.');
  return v;
}

function quantity(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || Math.abs(n) > 1_000_000) throw new Refused('value : un nombre.');
  return n;
}

function note(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw new Refused('note : un texte.');
  if (v.trim().length > NOTE_MAX) throw new Refused(`note : ${NOTE_MAX} caractères au plus.`);
  return v.trim();
}

function findGoal(goals: Goal[], v: unknown): Goal {
  if (typeof v !== 'string' || !v.trim()) throw new Refused('goal : le titre ou l’id d’un objectif.');
  const open = goals.filter((g) => !g.archived);
  const found = UUID.test(v) ? open.filter((g) => g.id === v.toLowerCase()) : open.filter((g) => fold(g.title) === fold(v));
  const loose = found.length ? found : open.filter((g) => fold(g.title).includes(fold(v)));
  if (loose.length === 1) return loose[0];
  if (loose.length > 1) throw new Refused(`Plusieurs objectifs répondent à « ${v} » : ${loose.map((g) => g.title).join(', ')}. Donne son id.`);
  throw new Refused(`Aucun objectif en cours « ${v} » : relis objectifs_resume.`);
}

/** Une action par son id, ou par son titre (dans un objectif si plusieurs portent le même). */
function findAction(goals: Goal[], actions: Action[], v: unknown, goal: unknown): Action {
  if (typeof v !== 'string' || !v.trim()) throw new Refused('action : le titre ou l’id d’une action.');
  const openGoals = new Set(goals.filter((g) => !g.archived).map((g) => g.id));
  const scope = goal === undefined ? null : findGoal(goals, goal).id;
  const pool = actions.filter((a) => !a.archived && openGoals.has(a.goalId) && (!scope || a.goalId === scope));
  const exact = UUID.test(v) ? pool.filter((a) => a.id === v.toLowerCase()) : pool.filter((a) => fold(a.title) === fold(v));
  const found = exact.length ? exact : pool.filter((a) => fold(a.title).includes(fold(v)));
  if (found.length === 1) return found[0];
  const titleOf = (a: Action) => `${goals.find((g) => g.id === a.goalId)?.title} › ${a.title}`;
  if (found.length > 1) throw new Refused(`Plusieurs actions répondent à « ${v} » : ${found.map(titleOf).join(', ')}. Donne goal ou l’id.`);
  throw new Refused(`Aucune action « ${v} »${scope ? ' dans cet objectif' : ''} : relis objectifs_resume.`);
}

const formatAmount = (value: number, unit: string) => {
  const r = Math.round(value * 10) / 10;
  const text = Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
};

function tierOut(t: Tier, actions: Action[], checkins: Checkin[], today: string) {
  const p = tierProgress(t, actions, checkins, today);
  return {
    title: t.title,
    rank: rankOf(t.rank).label,
    kind: t.kind,
    progress: p
      ? {
          current: round(p.current),
          target: round(p.target),
          unit: t.unit || undefined,
          percent: Math.round(p.percent * 100),
          reached: p.reached,
          best: p.best === null ? undefined : round(p.best),
          latest: p.latest === null ? undefined : round(p.latest),
        }
      : 'à valider à la main dans l’app (jalon)',
  };
}

/** Les paliers que cette écriture a fait atteindre : l'app les validera à son ouverture. */
function newlyReached(goal: Goal, actions: Action[], before: Checkin[], after: Checkin[], today: string): string[] {
  return goal.tiers
    .filter((t) => !t.completedAt && isCountable(t) && !tierProgress(t, actions, before, today)?.reached && tierProgress(t, actions, after, today)?.reached)
    .map((t) => `${t.title} (${rankOf(t.rank).label})`);
}

const reachedNote = (titles: string[]) =>
  titles.length ? `Palier atteint : ${titles.join(', ')} ! Il sera validé à la prochaine ouverture d’Objectifs.` : undefined;

export const objectifsTools: Tool<ObjectifsContext>[] = [
  {
    name: 'objectifs_resume',
    title: 'Où en sont les objectifs',
    description:
      'Les objectifs en cours : rang (le palier validé le plus haut), prochain palier et sa progression, actions (id, PP, unité, quantité habituelle, relevé ou non), ce qui est coché aujourd’hui (ou le jour donné), et les 7 derniers jours.',
    inputSchema: { type: 'object', properties: { day: { type: 'string', description: 'AAAA-MM-JJ ; aujourd’hui par défaut.' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const at = day(args.day, today);
      const [goals, actions, checkins] = await Promise.all([data.listGoals(), data.listActions(), data.listCheckins()]);
      const week = shiftDay(at, -6);
      return json({
        day: at,
        pp_today: checkins.filter((c) => c.day === at).reduce((s, c) => s + c.pp, 0),
        goals: goals
          .filter((g) => !g.archived)
          .map((g) => {
            const mine = checkins.filter((c) => c.goalId === g.id);
            const tiers = [...g.tiers].sort((a, b) => a.position - b.position);
            const next = tiers.find((t) => !t.completedAt);
            return {
              id: g.id,
              title: `${g.emoji} ${g.title}`.trim(),
              rank: goalRank(g) ?? 'non classé',
              tiers_done: `${tiers.filter((t) => t.completedAt).length}/${tiers.length}`,
              next_tier: next ? tierOut(next, actions, checkins, at) : 'tous les paliers sont validés',
              actions: actions
                .filter((a) => a.goalId === g.id && !a.archived)
                .map((a) => {
                  const done = mine.find((c) => c.actionId === a.id && c.day === at);
                  const last = a.isMeasure ? mine.filter((c) => c.actionId === a.id && typeof c.value === 'number').sort((x, y) => y.day.localeCompare(x.day))[0] : undefined;
                  return {
                    id: a.id,
                    title: a.title,
                    pp: a.pp,
                    unit: a.unit || undefined,
                    usual: a.defaultValue ?? undefined,
                    measure: a.isMeasure || undefined,
                    done: done ? (typeof done.value === 'number' ? formatAmount(done.value, a.unit) : true) : false,
                    held_by_sport: done?.ref ? true : undefined,
                    last_reading: last ? { day: last.day, value: last.value } : undefined,
                  };
                }),
              one_offs_today: mine.filter((c) => c.title !== null && c.day === at).map((c) => ({ id: c.id, title: c.title, value: c.value ?? undefined })),
              active_days_last_7: new Set(mine.filter((c) => c.day >= week && c.day <= at).map((c) => c.day)).size,
            };
          }),
      });
    },
  },
  {
    name: 'objectifs_cocher',
    title: 'Cocher une action',
    description:
      'Coche une action d’un objectif pour un jour (aujourd’hui par défaut, jamais à venir), avec sa quantité (value, dans l’unité de l’action ; la quantité habituelle sinon) et une note. Une action de relevé (mesure : un poids, une VMA) exige value. Recocher le même jour remplace la quantité. Dit si un palier vient d’être atteint.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'L’id ou le titre de l’action.' },
        goal: { type: 'string', description: 'Le titre de l’objectif, si deux actions portent le même nom.' },
        day: { type: 'string' },
        value: { type: 'number' },
        note: { type: 'string', maxLength: NOTE_MAX },
      },
      required: ['action'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data, today }) {
      const [goals, actions, checkins] = await Promise.all([data.listGoals(), data.listActions(), data.listCheckins()]);
      const action = findAction(goals, actions, args.action, args.goal);
      const goal = goals.find((g) => g.id === action.goalId)!;
      const at = day(args.day, today);
      const value = quantity(args.value);
      if (action.isMeasure && value === null) throw new Refused(`« ${action.title} » est un relevé : donne value${action.unit ? ` (en ${action.unit})` : ''}.`);
      const text = note(args.note);
      const existing = checkins.find((c) => c.actionId === action.id && c.day === at);
      if (existing?.ref) throw new Refused(`« ${action.title} » du ${at} est cochée par Sport, d’après la sortie du jour : c’est dans Sport qu’elle se change.`);

      let after: Checkin[];
      if (existing) {
        const patch: Record<string, unknown> = {};
        if (args.value !== undefined) patch.value = value;
        if (args.note !== undefined) patch.note = text;
        if (Object.keys(patch).length === 0) return { text: `« ${action.title} » est déjà cochée le ${at}.` };
        await data.updateCheckin(existing.id, patch);
        after = checkins.map((c) => (c.id === existing.id ? { ...c, ...(patch as Partial<Checkin>) } : c));
      } else {
        const created = await data.insertCheckin({ goal_id: goal.id, action_id: action.id, day: at, pp: action.pp, value, note: text });
        after = [...checkins, created];
      }
      const shown = value ?? action.defaultValue;
      return json({
        message: `« ${action.title} » cochée le ${at}${shown !== null ? ` (${formatAmount(shown, action.unit)})` : ''}${existing ? ', quantité mise à jour' : `, +${action.pp} PP`}.`,
        reached: reachedNote(newlyReached(goal, actions, checkins, after, today)),
        next_tier: (() => {
          const next = [...goal.tiers].sort((a, b) => a.position - b.position).find((t) => !t.completedAt);
          return next ? tierOut(next, actions, after, today) : undefined;
        })(),
      });
    },
  },
  {
    name: 'objectifs_decocher',
    title: 'Défaire une coche',
    description: 'Retire la coche d’une action pour un jour (aujourd’hui par défaut). Une coche posée par Sport se change dans Sport.',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string' }, goal: { type: 'string' }, day: { type: 'string' } },
      required: ['action'],
    },
    annotations: { destructiveHint: true },
    async run(args, { data, today }) {
      const [goals, actions, checkins] = await Promise.all([data.listGoals(), data.listActions(), data.listCheckins()]);
      const action = findAction(goals, actions, args.action, args.goal);
      const at = day(args.day, today);
      const existing = checkins.find((c) => c.actionId === action.id && c.day === at);
      if (!existing) return { text: `« ${action.title} » n’était pas cochée le ${at}.` };
      if (existing.ref) throw new Refused(`Cette coche vient de Sport (la sortie du ${at}) : elle reviendrait. C’est dans Sport qu’elle se change.`);
      await data.deleteCheckin(existing.id);
      return { text: `Coche de « ${action.title} » du ${at} retirée (−${existing.pp} PP). Un palier déjà validé le reste.` };
    },
  },
  {
    name: 'objectifs_geste',
    title: 'Noter un geste ponctuel',
    description:
      `Un geste qui n’est pas une action habituelle (« regardé un tuto de grammaire ») : ${ONE_OFF_PP} PP, compte pour la série du jour, pas pour les paliers. value facultatif, dans l’unité de l’objectif. Pour le retirer : objectifs_geste_retirer avec l’id rendu par objectifs_resume.`,
    inputSchema: {
      type: 'object',
      properties: { goal: { type: 'string' }, title: { type: 'string', maxLength: ONE_OFF_TITLE_MAX }, day: { type: 'string' }, value: { type: 'number' } },
      required: ['goal', 'title'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const goal = findGoal(await data.listGoals(), args.goal);
      if (typeof args.title !== 'string' || !args.title.trim()) throw new Refused('title : ce qui a été fait.');
      if (args.title.trim().length > ONE_OFF_TITLE_MAX) throw new Refused(`title : ${ONE_OFF_TITLE_MAX} caractères au plus.`);
      const at = day(args.day, today);
      const created = await data.insertCheckin({ goal_id: goal.id, action_id: null, day: at, pp: ONE_OFF_PP, title: args.title.trim(), value: quantity(args.value) });
      return json({ message: `Geste noté dans « ${goal.title} » le ${at}, +${ONE_OFF_PP} PP.`, id: created.id });
    },
  },
  {
    name: 'objectifs_geste_retirer',
    title: 'Retirer un geste ponctuel',
    description: 'Retire un geste ponctuel par son id (objectifs_resume, one_offs_today).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide.');
      const found = (await data.listCheckins()).find((c) => c.id === id);
      if (!found || found.title === null) throw new Refused('Aucun geste ponctuel avec cet id (une coche d’action se retire avec objectifs_decocher).');
      await data.deleteCheckin(found.id);
      return { text: `Geste « ${found.title} » du ${found.day} retiré.` };
    },
  },
  {
    name: 'objectifs_historique',
    title: 'Les coches d’une période',
    description: 'Les coches et gestes entre deux jours (les 30 derniers par défaut), d’un objectif ou de tous : jour, action, quantité, PP, note — avec un total par action.',
    inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, goal: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const to = args.to === undefined ? today : day(args.to, today);
      const from = args.from === undefined ? shiftDay(to, -29) : day(args.from, today);
      if (from > to) throw new Refused('from après to.');
      if (daysBetween(from, to) > 400) throw new Refused('Un an au plus à la fois.');
      const [goals, actions, checkins] = await Promise.all([data.listGoals(), data.listActions(), data.listCheckins()]);
      const goal = args.goal === undefined ? null : findGoal(goals, args.goal);
      const rows = checkins.filter((c) => c.day >= from && c.day <= to && (!goal || c.goalId === goal.id)).sort((a, b) => a.day.localeCompare(b.day));
      const name = (c: Checkin) => c.title ?? actions.find((a) => a.id === c.actionId)?.title ?? '(action supprimée)';
      const totals = new Map<string, { action: string; goal: string; times: number; amount: number; unit: string }>();
      for (const c of rows) {
        const a = actions.find((x) => x.id === c.actionId);
        const key = c.actionId ?? `geste:${c.goalId}`;
        const t = totals.get(key) ?? { action: c.actionId ? name(c) : 'gestes ponctuels', goal: goals.find((g) => g.id === c.goalId)?.title ?? '?', times: 0, amount: 0, unit: a?.unit ?? '' };
        t.times++;
        t.amount += contribution(c, actions);
        totals.set(key, t);
      }
      return json({
        from,
        to,
        pp: rows.reduce((s, c) => s + c.pp, 0),
        totals: [...totals.values()].map((t) => ({ ...t, amount: t.amount ? formatAmount(t.amount, t.unit) : undefined, unit: undefined })),
        checkins: rows.slice(-300).map((c) => ({ day: c.day, goal: goals.find((g) => g.id === c.goalId)?.title, action: name(c), value: c.value ?? undefined, pp: c.pp, note: c.note || undefined })),
      });
    },
  },
];
