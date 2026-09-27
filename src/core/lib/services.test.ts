import { describe, expect, it } from 'vitest';
import { collectServices, type CalendarSource, type ExpenseService } from './services';

const fake = (): ExpenseService => ({
  record: async () => {},
  remove: async () => {},
  recorded: async () => new Set(),
});

describe('collectServices', () => {
  it('rassemble les services déclarés par les modules', () => {
    const expenses = fake();
    expect(collectServices([{}, { provides: { expenses } }]).expenses).toBe(expenses);
  });

  it('aucun module ne fournit rien : aucun service', () => {
    expect(collectServices([{}, {}])).toEqual({});
  });

  it('deux fournisseurs du même service : le premier du registre l’emporte', () => {
    const first = fake();
    expect(collectServices([{ provides: { expenses: first } }, { provides: { expenses: fake() } }]).expenses).toBe(first);
  });

  it('les calques du calendrier s’additionnent, dans l’ordre du registre', () => {
    const source = (id: string): CalendarSource => ({ id, label: id, color: '#fff', defaultVisible: true, marksBetween: async () => [] });
    const a = source('objectifs');
    const b = source('flashcards');
    const c = source('courses');
    const services = collectServices([{ provides: { calendarSources: [a] } }, {}, { provides: { calendarSources: [b, c] } }]);
    expect(services.calendarSources).toEqual([a, b, c]);
  });
});
