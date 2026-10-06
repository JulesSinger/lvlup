/**
 * Les abonnements déclarés à la main, et leur rencontre avec ceux repérés
 * dans les relevés — bibliothèque pure (docs/etude-astra.md §14).
 *
 * Un abonnement déclaré est une **prévision** : il compte dans le coût par
 * mois et par an, il peut prévenir avant une échéance, mais il ne crée
 * jamais d'écriture. Son motif de libellé, s'il en a un, le rapproche de ses
 * paiements : il n'apparaît alors qu'une fois, « vu dans tes relevés ».
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import { daysBetween, shiftDay } from '../../../core/lib/day';
import { centsToInputValue } from './amount';
import { labelKey } from './classify';
import type { Recurring } from './recurring';
import { fold } from './search';
import { SUBSCRIPTION_NAME_MAX, type BudgetEntry, type BudgetSubscription, type BudgetSubscriptionInput, type IgnoredRecurring, type SubscriptionFrequency } from './types';

const PER_YEAR: Record<SubscriptionFrequency, number> = { hebdomadaire: 52, mensuel: 12, trimestriel: 4, annuel: 1 };
const MONTHS: Partial<Record<SubscriptionFrequency, number>> = { mensuel: 1, trimestriel: 3, annuel: 12 };
/** L'écart habituel entre deux paiements, en jours, pour dire « plus vu depuis longtemps ». */
const PERIOD_DAYS: Record<SubscriptionFrequency, number> = { hebdomadaire: 7, mensuel: 30, trimestriel: 91, annuel: 365 };

/** Ce que coûte un montant à ce rythme, ramené au mois. */
export const monthlyCost = (amountCents: number, frequency: SubscriptionFrequency) => Math.round((amountCents * PER_YEAR[frequency]) / 12);

/**
 * L'échéance n° `n` après `day` : même jour du mois (le 31 devient le dernier
 * jour d'un mois plus court, sans dériver ensuite : on repart toujours du jour
 * d'origine).
 */
export function addPeriods(day: string, frequency: SubscriptionFrequency, n: number): string {
  const months = MONTHS[frequency];
  if (!months) return shiftDay(day, 7 * n);
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + months * n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** La prochaine échéance à partir d'aujourd'hui (aujourd'hui compris), en partant d'une échéance connue. */
export function nextOccurrence(day: string, frequency: SubscriptionFrequency, today: string): string {
  if (day >= today) return day;
  let n = 1;
  while (addPeriods(day, frequency, n) < today) n++;
  return addPeriods(day, frequency, n);
}

export interface SeenPayment {
  day: string;
  amountCents: number;
  count: number;
}

/** Le dernier paiement des relevés qui correspond au motif (une dépense dont le libellé le contient). */
export function lastSeen(pattern: string, entries: readonly BudgetEntry[]): SeenPayment | null {
  const p = fold(pattern);
  if (p.length < 3) return null;
  const matching = entries.filter((e) => e.amountCents < 0 && fold(e.label).includes(p)).sort((a, b) => b.day.localeCompare(a.day));
  if (matching.length === 0) return null;
  return { day: matching[0].day, amountCents: -matching[0].amountCents, count: matching.length };
}

/** La dépense repérée que le motif d'un abonnement déclaré désigne, s'il y en a une. */
export function matchedRecurring(pattern: string, detected: readonly Recurring[]): Recurring | null {
  const key = labelKey(pattern);
  if (key.length < 3) return null;
  return detected.find((r) => r.key.includes(key)) ?? null;
}

export interface DeclaredView {
  subscription: BudgetSubscription;
  next: string;
  monthlyCents: number;
  seen: SeenPayment | null;
  /** Vu dans les relevés, mais plus depuis une fois et demie son rythme : résilié ? */
  stale: boolean;
}

export interface SubscriptionsView {
  declared: DeclaredView[];
  /** Les dépenses repérées ni rapprochées d'un abonnement déclaré, ni écartées. */
  detected: Recurring[];
  ignored: IgnoredRecurring[];
  monthlyCents: number;
  yearlyCents: number;
}

/**
 * Ce que montre l'onglet : les abonnements déclarés (avec ce que les relevés
 * en disent), puis ce que la détection a trouvé d'autre. Le total compte les
 * déclarés (sauf ceux qu'on ne voit plus passer) et les repérés encore payés.
 */
export function subscriptionsView(
  subscriptions: readonly BudgetSubscription[],
  detected: readonly Recurring[],
  ignored: readonly IgnoredRecurring[],
  entries: readonly BudgetEntry[],
  today: string,
): SubscriptionsView {
  const matchedKeys = new Set<string>();
  const declared = subscriptions
    .map((subscription) => {
      const match = subscription.pattern ? matchedRecurring(subscription.pattern, detected) : null;
      if (match) matchedKeys.add(match.key);
      const seen = subscription.pattern ? lastSeen(subscription.pattern, entries) : null;
      return {
        subscription,
        next: nextOccurrence(subscription.nextDay, subscription.frequency, today),
        monthlyCents: monthlyCost(subscription.amountCents, subscription.frequency),
        seen,
        stale: seen !== null && daysBetween(seen.day, today) > PERIOD_DAYS[subscription.frequency] * 1.5,
      };
    })
    .sort((a, b) => a.next.localeCompare(b.next) || a.subscription.name.localeCompare(b.subscription.name, 'fr'));
  const ignoredKeys = new Set(ignored.map((i) => i.key));
  const others = detected.filter((r) => !matchedKeys.has(r.key) && !ignoredKeys.has(r.key));
  const monthlyCents =
    declared.filter((d) => !d.stale).reduce((sum, d) => sum + d.monthlyCents, 0) + others.filter((r) => r.active).reduce((sum, r) => sum + r.monthlyCents, 0);
  return { declared, detected: others, ignored: [...ignored], monthlyCents, yearlyCents: monthlyCents * 12 };
}

/** Ce qu'il faut pour déclarer une dépense repérée comme abonnement : tout est déjà connu. */
export function draftFromRecurring(r: Recurring, today: string): BudgetSubscriptionInput {
  return {
    name: r.label,
    amountCents: r.lastAmountCents,
    frequency: r.frequency,
    nextDay: nextOccurrence(r.nextDay, r.frequency, today),
    categoryId: r.categoryId,
    pattern: r.label,
    remindDays: null,
  };
}

export function validateSubscription(input: { name: string; amountCents: number | null | undefined; nextDay: string; pattern?: string }): string | null {
  const name = input.name.trim();
  if (!name) return 'Donne un nom à l’abonnement.';
  if (name.length > SUBSCRIPTION_NAME_MAX) return `Le nom est trop long (${SUBSCRIPTION_NAME_MAX} caractères au plus).`;
  if (input.amountCents === undefined) return 'Le montant doit être un nombre positif, par exemple 13,99.';
  if (input.amountCents === null || input.amountCents <= 0) return 'Indique le montant.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDay)) return 'Indique la prochaine échéance.';
  if ((input.pattern ?? '').trim().length > 200) return 'Le motif est trop long (200 caractères au plus).';
  return null;
}

/** Jusqu'où les rappels sont posés à l'avance : un mois de plus que le plus long préavis. */
export const REMINDER_HORIZON_DAYS = 60;
export const REMINDER_TIME = '09:00';

function localInstant(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const frDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/**
 * Les rappels avant échéance : `remindDays` jours avant chaque échéance des
 * soixante jours qui viennent, à 9 h — le moment où l'on peut encore
 * résilier. Le module les déclare au socle (`coreStore.scheduleReminders`).
 */
export function plannedReminders(subscriptions: readonly BudgetSubscription[], now: Date, today: string): ReminderInput[] {
  const last = shiftDay(today, REMINDER_HORIZON_DAYS);
  const reminders: ReminderInput[] = [];
  for (const sub of subscriptions) {
    if (!sub.remindDays) continue;
    let occurrence = nextOccurrence(sub.nextDay, sub.frequency, today);
    for (let guard = 0; guard < 20; guard++) {
      const day = shiftDay(occurrence, -sub.remindDays);
      if (day > last) break;
      const at = localInstant(day, REMINDER_TIME);
      if (at > now) {
        reminders.push({
          ref: `sub:${sub.id}:${occurrence}`,
          fireAt: at.toISOString(),
          title: `🔁 ${sub.name} : prélèvement dans ${sub.remindDays} jours`,
          body: `${centsToInputValue(sub.amountCents)} € le ${frDay(occurrence)} — c’est le moment de résilier si tu n’en veux plus.`,
          url: '/#/budget',
        });
      }
      occurrence = nextOccurrence(addPeriods(occurrence, sub.frequency, 1), sub.frequency, today);
    }
  }
  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}
