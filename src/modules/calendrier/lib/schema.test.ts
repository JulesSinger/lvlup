import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../../core/lib/recurrence';
import { ALL_DAY_REMINDERS, EVENT_COLORS, EXCEPTION_KINDS, MAX_REMINDERS, REMINDER_OFFSETS, TIMED_REMINDERS } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5 (voir `modules/objectifs/lib/schema.test.ts`
 * pour l'incident qui l'a fait naître). Tous les fichiers SQL sont lus, la
 * DERNIÈRE définition d'une contrainte fait foi.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;

/**
 * Les valeurs autorisées par la dernière définition de la contrainte : la
 * liste de `in (…)` ou de `any (array[…])` — pas les autres chaînes de la
 * contrainte, comme le nom du champ JSON dans `recurrence->>'freq'`.
 */
function allowedBy(constraint: string): string[] | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*(?:,|\\n\\s*\\))`, 'gi');
  let last: string | null = null;
  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const name of files) {
    for (const match of readFileSync(join(SQL_DIR, name), 'utf8').matchAll(pattern)) last = match[1];
  }
  if (last === null) return null;
  const list = /array\[([^\]]*)\]/i.exec(last)?.[1] ?? /\bin\s*\(([^)]*)\)/i.exec(last)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Éclipse)', () => {
  it('les couleurs d’un événement', () => {
    expect(allowedBy('calendar_events_color_check')).toEqual([...EVENT_COLORS].sort());
  });

  it('les fréquences de récurrence', () => {
    expect(allowedBy('calendar_events_freq_check')).toEqual([...FREQUENCIES].sort());
  });

  it('la nature d’une exception', () => {
    expect(allowedBy('calendar_exceptions_kind_check')).toEqual([...EXCEPTION_KINDS].sort());
  });

  it('les rappels possibles, et leur nombre (01/10/2026)', () => {
    const sql = readFileSync(join(SQL_DIR, '2026-10-01-calendar-reminders.sql'), 'utf8');
    const numbers = (list: string) => list.split(',').map((n) => Number(n.trim())).sort((a, b) => a - b);
    const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
    const event = /calendar_events_reminders_check\s+check\s*\(reminders is null or \(cardinality\(reminders\) <= (\d+) and reminders <@ array\[([^\]]*)\]/.exec(sql);
    expect(event).not.toBeNull();
    expect(Number(event![1])).toBe(MAX_REMINDERS);
    expect(numbers(event![2])).toEqual(sorted(REMINDER_OFFSETS));
    expect(numbers(/timed_reminders <@ array\[([^\]]*)\]/.exec(sql)![1])).toEqual(sorted(TIMED_REMINDERS));
    expect(numbers(/all_day_reminders <@ array\[([^\]]*)\]/.exec(sql)![1])).toEqual(sorted(ALL_DAY_REMINDERS));
  });
});
