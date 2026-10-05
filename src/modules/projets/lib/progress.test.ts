import { describe, expect, it } from 'vitest';
import { isTaskLate, projectProgress, projectWorkstreams, riskReason, workstreamState } from './progress';
import type { Project, ProjectTask, Workstream } from './types';

const TODAY = '2026-10-05';

function task(over: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: Math.random().toString(36).slice(2),
    projectId: 'p',
    workstreamId: 'w',
    title: 'Tâche',
    note: '',
    plannedDay: null,
    dueDay: null,
    waitingClient: false,
    position: 0,
    completedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}
const done = (over: Partial<ProjectTask> = {}) => task({ completedAt: '2026-10-02T10:00:00Z', ...over });

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p',
    clientId: 'c',
    number: 1,
    title: 'Site vitrine',
    template: 'vitrine',
    status: 'production',
    waitingFor: null,
    waitingSince: null,
    startDay: null,
    dueDay: null,
    priceCents: null,
    needs: {},
    note: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

const ws = (id: string, position: number, over: Partial<Workstream> = {}): Workstream => ({ id, projectId: 'p', title: id, position, dueDay: null, ...over });

describe('l’état d’un chantier, calculé depuis ses tâches', () => {
  it('sans tâche, tout fait, rien de commencé', () => {
    expect(workstreamState([], TODAY)).toBe('empty');
    expect(workstreamState([done(), done()], TODAY)).toBe('done');
    expect(workstreamState([task(), task()], TODAY)).toBe('todo');
  });

  it('en cours dès une tâche cochée, ou une tâche prévue aujourd’hui ou avant', () => {
    expect(workstreamState([done(), task()], TODAY)).toBe('doing');
    expect(workstreamState([task({ plannedDay: TODAY }), task()], TODAY)).toBe('doing');
    expect(workstreamState([task({ plannedDay: '2026-10-06' })], TODAY)).toBe('todo');
  });

  it('une tâche restante qui attend le client l’emporte — mais plus une fois cochée', () => {
    expect(workstreamState([done(), task({ waitingClient: true })], TODAY)).toBe('waiting');
    expect(workstreamState([done({ waitingClient: true }), task()], TODAY)).toBe('doing');
  });
});

describe('les chantiers d’un projet', () => {
  it('rangés par état — en cours, attend, à faire, fait — puis par position', () => {
    const workstreams = [ws('decouverte', 0), ws('contenus', 1), ws('dev', 2), ws('hebergement', 3), ws('apres', 4), ws('autre-projet', 0, { projectId: 'q' })];
    const tasks = [
      done({ workstreamId: 'decouverte' }),
      done({ workstreamId: 'contenus' }),
      task({ workstreamId: 'contenus', waitingClient: true }),
      done({ workstreamId: 'dev' }),
      task({ workstreamId: 'dev' }),
      task({ workstreamId: 'apres' }),
      done({ workstreamId: 'hebergement' }),
      task({ workstreamId: 'hebergement', position: 2, title: 'HTTPS' }),
      task({ workstreamId: 'hebergement', position: 1, title: 'Domaine' }),
    ];
    const views = projectWorkstreams('p', workstreams, tasks, TODAY);
    expect(views.map((v) => [v.workstream.id, v.state])).toEqual([
      ['dev', 'doing'],
      ['hebergement', 'doing'],
      ['contenus', 'waiting'],
      ['apres', 'todo'],
      ['decouverte', 'done'],
    ]);
    const hebergement = views.find((v) => v.workstream.id === 'hebergement')!;
    expect(hebergement.tasks.map((t) => t.title)).toEqual(['Tâche', 'Domaine', 'HTTPS']);
    expect([hebergement.done, hebergement.total]).toEqual([1, 3]);
  });
});

describe('l’avancement et les retards', () => {
  it('la part de toutes les tâches du projet ; aucune tâche, aucun pourcentage', () => {
    expect(projectProgress('p', [done(), task(), task(), task(), task({ projectId: 'q' })])).toEqual({ done: 1, total: 4, ratio: 0.25 });
    expect(projectProgress('p', [])).toEqual({ done: 0, total: 0, ratio: null });
  });

  it('une tâche est en retard si son jour prévu ou son échéance est passé, pas si elle est faite', () => {
    expect(isTaskLate(task({ plannedDay: '2026-10-04' }), TODAY)).toBe(true);
    expect(isTaskLate(task({ dueDay: '2026-10-04', plannedDay: '2026-10-08' }), TODAY)).toBe(true);
    expect(isTaskLate(task({ plannedDay: TODAY }), TODAY)).toBe(false);
    expect(isTaskLate(done({ plannedDay: '2026-10-01' }), TODAY)).toBe(false);
  });
});

describe('un projet en danger', () => {
  const half = (n: number, doneCount: number) => [...Array(doneCount)].map(() => done()).concat([...Array(n - doneCount)].map(() => task()));

  it('échéance dans une semaine ou moins, plus de la moitié des tâches restantes', () => {
    const p = project({ dueDay: '2026-10-10' });
    const tasks = half(10, 4);
    expect(riskReason(p, [], projectProgress('p', tasks), TODAY)).toBe('Mise en ligne dans 5 j, 6 tâches sur 10 restent');
  });

  it('pas en danger : la moitié faite, une échéance lointaine, ou déjà en retard', () => {
    expect(riskReason(project({ dueDay: '2026-10-10' }), [], projectProgress('p', half(10, 5)), TODAY)).toBeNull();
    expect(riskReason(project({ dueDay: '2026-10-20' }), [], projectProgress('p', half(10, 1)), TODAY)).toBeNull();
    expect(riskReason(project({ dueDay: '2026-10-01' }), [], projectProgress('p', half(10, 1)), TODAY)).toBeNull();
  });

  it('un chantier qui a dépassé sa date met le projet en danger', () => {
    const workstreams = [ws('recette', 0, { title: 'Recette', dueDay: '2026-10-03' })];
    const tasks = [task({ workstreamId: 'recette' })];
    const views = projectWorkstreams('p', workstreams, tasks, TODAY);
    expect(riskReason(project(), views, projectProgress('p', tasks), TODAY)).toBe('Le chantier « Recette » a dépassé sa date');
  });
});
