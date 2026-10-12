import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as server from '../../../supabase/functions/atlas-mcp/recurrence.ts';
import * as day from './day';
import * as recurrence from './recurrence';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * La copie serveur du moteur de récurrence et des jours
 * (`supabase/functions/atlas-mcp/recurrence.ts`) doit rester celle de l'app :
 * le texte des fonctions est comparé, puis leur résultat sur des centaines de
 * cas. Corriger l'un sans l'autre casse ce test.
 */
describe('la copie serveur du moteur de récurrence', () => {
  it('a le même texte que l’app', () => {
    const copy = read('../../../supabase/functions/atlas-mcp/recurrence.ts');
    const dayCore = read('./day.ts');
    const recCore = read('./recurrence.ts');
    const dayBody = dayCore.slice(dayCore.indexOf('export function dayString'));
    const recBody = recCore.slice(recCore.indexOf('/**\n * Fréquences'), recCore.indexOf('// --- Les choix proposés à l'));
    expect(copy).toContain(dayBody.trim());
    expect(copy).toContain(recBody.trim());
  });

  it('rend les mêmes jours', () => {
    const rules: recurrence.Recurrence[] = [
      { freq: 'daily', interval: 1 },
      { freq: 'daily', interval: 3, count: 7 },
      { freq: 'daily', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
      { freq: 'weekly', interval: 1, byWeekday: [1, 4] },
      { freq: 'weekly', interval: 2 },
      { freq: 'monthly', interval: 1 },
      { freq: 'monthly', interval: 1, byNthWeekday: { nth: -1, weekday: 5 } },
      { freq: 'yearly', interval: 1, until: '2030-01-01' },
    ];
    for (const start of ['2026-01-31', '2024-02-29', '2026-10-13', '2026-03-29']) {
      for (const rule of rules) {
        const series = { startDay: start, recurrence: rule };
        expect(server.ruleDays(series, '2026-01-01', '2027-12-31')).toEqual(recurrence.ruleDays(series, '2026-01-01', '2027-12-31'));
        expect(server.describeRecurrence(rule, start)).toBe(recurrence.describeRecurrence(rule, start));
      }
    }
    for (const [a, b] of [['2026-10-13', '2027-03-28'], ['2026-03-29', '2026-03-30']]) {
      expect(server.daysBetween(a, b)).toBe(day.daysBetween(a, b));
      expect(server.shiftDay(a, 200)).toBe(day.shiftDay(a, 200));
      expect(server.mondayOf(b)).toBe(day.mondayOf(b));
    }
  });
});
