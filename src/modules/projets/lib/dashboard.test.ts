import { describe, expect, it } from 'vitest';
import { activeProjectCards, lateItems, waitingItems, weekTasks } from './dashboard';
import type { Project, ProjectTask, Workstream } from './types';

const TODAY = '2026-10-05';

function project(id: string, number: number, over: Partial<Project> = {}): Project {
  return {
    id,
    clientId: 'c',
    number,
    title: id,
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

let seq = 0;
function task(projectId: string, over: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: `t-${++seq}`,
    projectId,
    workstreamId: `${projectId}-w`,
    title: 'Tâche',
    note: '',
    plannedDay: null,
    dueDay: null,
    waitingClient: false,
    position: 0,
    completedAt: null,
    createdAt: '',
    ...over,
  };
}

const ws = (projectId: string, over: Partial<Workstream> = {}): Workstream => ({ id: `${projectId}-w`, projectId, title: 'Recette', position: 0, dueDay: null, ...over });

describe('cette semaine', () => {
  it('aujourd’hui et les six jours suivants, triés par jour puis par projet ; ni retards, ni faites, ni projets clos', () => {
    const lou = project('lou', 1);
    const camion = project('camion', 2);
    const perdu = project('perdu', 3, { status: 'lost' });
    const tasks = [
      task('camion', { plannedDay: TODAY, title: 'Maquette' }),
      task('lou', { plannedDay: TODAY, title: 'Menu' }),
      task('lou', { dueDay: '2026-10-11', title: 'Dernier jour' }),
      task('lou', { dueDay: '2026-10-12', title: 'Trop loin' }),
      task('lou', { plannedDay: '2026-10-04', title: 'Retard' }),
      task('lou', { plannedDay: '2026-10-06', title: 'Faite', completedAt: '2026-10-05T08:00:00Z' }),
      task('perdu', { plannedDay: TODAY, title: 'Projet perdu' }),
      task('lou', { title: 'Sans date' }),
    ];
    const items = weekTasks({ projects: [lou, camion, perdu], workstreams: [], tasks }, TODAY);
    expect(items.map((i) => [i.day, i.task.title])).toEqual([
      [TODAY, 'Menu'],
      [TODAY, 'Maquette'],
      ['2026-10-11', 'Dernier jour'],
    ]);
  });

  it('le jour prévu l’emporte sur l’échéance', () => {
    const items = weekTasks({ projects: [project('lou', 1)], workstreams: [], tasks: [task('lou', { plannedDay: '2026-10-06', dueDay: '2026-10-09' })] }, TODAY);
    expect(items[0].day).toBe('2026-10-06');
  });
});

describe('les retards', () => {
  it('tâches, chantiers et projets, les plus anciens d’abord', () => {
    const lou = project('lou', 1, { dueDay: '2026-10-02' });
    const camion = project('camion', 2);
    const data = {
      projects: [lou, camion],
      workstreams: [ws('lou'), ws('camion', { dueDay: '2026-10-03' })],
      tasks: [
        task('lou', { plannedDay: '2026-10-04', dueDay: '2026-09-30', title: 'Menu' }),
        task('camion', { title: 'Pages' }),
      ],
    };
    expect(lateItems(data, TODAY).map((i) => [i.kind, i.project.id, i.day])).toEqual([
      ['task', 'lou', '2026-09-30'],
      ['project', 'lou', '2026-10-02'],
      ['workstream', 'camion', '2026-10-03'],
    ]);
  });

  it('un projet dont toutes les tâches sont faites n’est pas en retard', () => {
    const lou = project('lou', 1, { dueDay: '2026-10-02' });
    const data = { projects: [lou], workstreams: [ws('lou')], tasks: [task('lou', { completedAt: '2026-10-01T10:00:00Z' })] };
    expect(lateItems(data, TODAY)).toEqual([]);
  });
});

describe('en attente du client', () => {
  it('les attentes de projet, la plus longue d’abord, puis les tâches qui attendent', () => {
    const data = {
      projects: [
        project('lou', 1, { waitingFor: 'les photos', waitingSince: '2026-09-26' }),
        project('meche', 2, { waitingFor: 'les tarifs', waitingSince: '2026-10-03' }),
        project('clos', 3, { status: 'done', waitingFor: 'rien', waitingSince: '2026-09-01' }),
      ],
      workstreams: [],
      tasks: [task('meche', { waitingClient: true, title: 'Logo' }), task('lou', { waitingClient: true, completedAt: '2026-10-01T00:00:00Z' })],
    };
    const items = waitingItems(data, TODAY);
    expect(items.map((i) => (i.kind === 'project' ? [i.project.id, i.what, i.days] : [i.project.id, i.task.title]))).toEqual([
      ['lou', 'les photos', 9],
      ['meche', 'les tarifs', 2],
      ['meche', 'Logo'],
    ]);
  });
});

describe('les projets actifs', () => {
  it('signés ou en production seulement, l’échéance la plus proche d’abord, sans échéance à la fin', () => {
    const projects = [
      project('sans', 1),
      project('loin', 2, { dueDay: '2026-11-15' }),
      project('proche', 3, { dueDay: '2026-10-10', status: 'signed' }),
      project('piste', 4, { status: 'lead', dueDay: '2026-10-06' }),
      project('livre', 5, { status: 'delivered', dueDay: '2026-10-06' }),
    ];
    const cards = activeProjectCards({ projects, workstreams: [], tasks: [] }, TODAY);
    expect(cards.map((c) => [c.project.id, c.daysLeft])).toEqual([
      ['proche', 5],
      ['loin', 41],
      ['sans', null],
    ]);
  });

  it('une carte dit son avancement, ses chantiers, son retard et son danger', () => {
    const lou = project('lou', 1, { dueDay: '2026-10-09' });
    const tasks = [task('lou', { completedAt: '2026-10-01T00:00:00Z' }), task('lou'), task('lou')];
    const [card] = activeProjectCards({ projects: [lou], workstreams: [ws('lou')], tasks }, TODAY);
    expect(card.progress).toEqual({ done: 1, total: 3, ratio: 1 / 3 });
    expect(card.workstreams.map((w) => w.state)).toEqual(['doing']);
    expect(card.late).toBe(false);
    expect(card.risk).toBe('Mise en ligne dans 4 j, 2 tâches sur 3 restent');
  });
});
