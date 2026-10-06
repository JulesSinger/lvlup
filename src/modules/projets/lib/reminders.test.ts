import { describe, expect, it } from 'vitest';
import { plannedReminders, type ReminderData } from './reminders';
import type { Payment, Project, ProjectTask } from './types';

// Lundi 5 octobre 2026, 8 h : les rappels de 9 h du jour sont encore à venir.
const NOW = new Date(2026, 9, 5, 8, 0);

const project = (over: Partial<Project> = {}): Project => ({
  id: 'lou',
  clientId: 'c',
  number: 1,
  title: 'Site vitrine',
  template: '',
  status: 'production',
  waitingFor: null,
  waitingSince: null,
  startDay: null,
  dueDay: null,
  priceCents: null,
  needs: {},
  design: {},
  note: '',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const task = (done: boolean): ProjectTask => ({ projectId: 'lou', completedAt: done ? '2026-10-01T00:00:00Z' : null }) as ProjectTask;

const data = (over: Partial<ReminderData> = {}): ReminderData => ({
  clients: [{ id: 'c', name: 'Fleurs de Lou' } as ReminderData['clients'][number]],
  projects: [project()],
  tasks: [],
  payments: [],
  ...over,
});

describe('les rappels de Projets', () => {
  it('la mise en ligne, deux jours avant, à 9 h — s’il reste des tâches', () => {
    const r = plannedReminders(data({ projects: [project({ dueDay: '2026-10-08' })], tasks: [task(true), task(false), task(false)] }), NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      ref: 'due:lou:2026-10-08',
      fireAt: new Date(2026, 9, 6, 9, 0).toISOString(),
      title: '🚀 Fleurs de Lou : mise en ligne après-demain',
      body: 'Site vitrine — 2 tâches sur 3 restent',
      url: '/#/projets',
    });
    expect(plannedReminders(data({ projects: [project({ dueDay: '2026-10-08' })], tasks: [task(true)] }), NOW)).toEqual([]);
  });

  it('un paiement attendu, le jour même ; pas s’il est reçu', () => {
    const payments = [
      { id: 'p1', projectId: 'lou', label: 'Solde', amountCents: 63_000, expectedDay: '2026-10-05', receivedDay: null } as Payment,
      { id: 'p2', projectId: 'lou', label: 'Acompte', amountCents: 27_000, expectedDay: '2026-10-06', receivedDay: '2026-10-04' } as Payment,
    ];
    const r = plannedReminders(data({ payments }), NOW);
    expect(r.map((x) => [x.ref, x.title, x.body])).toEqual([['pay:p1:2026-10-05', '💶 Solde attendu aujourd’hui', 'Fleurs de Lou — 630 € (Site vitrine)']]);
  });

  it('une relance quand l’attente atteint une semaine', () => {
    const r = plannedReminders(data({ projects: [project({ waitingFor: 'les photos', waitingSince: '2026-10-01' })] }), NOW);
    expect(r.map((x) => [x.ref, x.fireAt, x.title])).toEqual([['nudge:lou:2026-10-01', new Date(2026, 9, 8, 9, 0).toISOString(), '⏳ Relancer Fleurs de Lou']]);
  });

  it('rien de passé, rien au-delà de sept jours, rien pour un projet clos', () => {
    expect(plannedReminders(data({ projects: [project({ dueDay: '2026-10-06' })], tasks: [task(false)] }), NOW)).toEqual([]);
    expect(plannedReminders(data({ projects: [project({ dueDay: '2026-10-30' })], tasks: [task(false)] }), NOW)).toEqual([]);
    expect(plannedReminders(data({ projects: [project({ status: 'lost', dueDay: '2026-10-08' })], tasks: [task(false)] }), NOW)).toEqual([]);
  });
});
