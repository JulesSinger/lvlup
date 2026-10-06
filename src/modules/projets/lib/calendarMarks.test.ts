import { describe, expect, it } from 'vitest';
import { markTarget, projectMarks, type MarksData } from './calendarMarks';
import type { Payment, Project, ProjectTask, Workstream } from './types';

const project = (id: string, over: Partial<Project> = {}): Project => ({
  id,
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

const task = (id: string, over: Partial<ProjectTask> = {}): ProjectTask => ({
  id,
  projectId: 'lou',
  workstreamId: 'w',
  title: id,
  note: '',
  plannedDay: null,
  dueDay: null,
  waitingClient: false,
  position: 0,
  completedAt: null,
  createdAt: '',
  ...over,
});

const data = (over: Partial<MarksData> = {}): MarksData => ({
  clients: [{ id: 'c', name: 'Fleurs de Lou' } as MarksData['clients'][number]],
  projects: [project('lou', { dueDay: '2026-10-20' })],
  workstreams: [{ id: 'w', projectId: 'lou', title: 'Recette', position: 0, dueDay: '2026-10-15' } as Workstream],
  tasks: [],
  payments: [],
  ...over,
});

describe('le calque de Projets dans Calendar', () => {
  it('les tâches datées, cochables ; déplaçables seulement avec un jour prévu et à faire', () => {
    const marks = projectMarks(
      data({
        tasks: [
          task('Menu', { plannedDay: '2026-10-12', waitingClient: true }),
          task('Logo', { dueDay: '2026-10-13' }),
          task('Faite', { plannedDay: '2026-10-12', completedAt: '2026-10-12T10:00:00Z' }),
          task('Hors période', { plannedDay: '2026-11-30' }),
          task('Sans date'),
        ],
      }),
      '2026-10-12',
      '2026-10-18',
    ).filter((m) => m.id.startsWith('task:'));
    expect(marks.map((m) => [m.day, m.title, m.done, m.movable])).toEqual([
      ['2026-10-12', 'Fleurs de Lou · Faite', true, false],
      ['2026-10-12', 'Fleurs de Lou · Menu', false, true],
      ['2026-10-13', '⚑ Fleurs de Lou · Logo', false, false],
    ]);
    expect(marks[1]).toMatchObject({ checkable: true, detail: 'Site vitrine · Recette · attend le client', link: 'task:Menu' });
  });

  it('la mise en ligne, la fin d’un chantier, un paiement attendu — pas un paiement reçu', () => {
    const payments = [
      { id: 'p1', projectId: 'lou', label: 'Solde', amountCents: 63_000, expectedDay: '2026-10-20', receivedDay: null } as Payment,
      { id: 'p2', projectId: 'lou', label: 'Acompte', amountCents: 27_000, expectedDay: '2026-10-15', receivedDay: '2026-10-14' } as Payment,
    ];
    const marks = projectMarks(data({ payments }), '2026-10-12', '2026-10-25');
    expect(marks.map((m) => [m.id, m.day, m.title])).toEqual([
      ['ws:w', '2026-10-15', 'Fin du chantier « Recette » — Fleurs de Lou'],
      ['pay:p1', '2026-10-20', '💶 Solde attendu — Fleurs de Lou'],
      ['due:lou', '2026-10-20', '🚀 Mise en ligne — Fleurs de Lou'],
    ]);
    expect(marks.every((m) => m.movable && !m.checkable && m.link === 'project:lou')).toBe(true);
    expect(marks[1].detail).toBe('630 € · Site vitrine');
  });

  it('un projet terminé ou perdu quitte le calendrier', () => {
    const closed = data({ projects: [project('lou', { status: 'done', dueDay: '2026-10-20' })], tasks: [task('Menu', { plannedDay: '2026-10-12' })] });
    expect(projectMarks(closed, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('lit ce que désigne une marque', () => {
    expect(markTarget('task:abc')).toEqual({ kind: 'task', id: 'abc' });
    expect(markTarget('pay:x:y')).toEqual({ kind: 'pay', id: 'x:y' });
    expect(markTarget('autre:1')).toBeNull();
  });
});
