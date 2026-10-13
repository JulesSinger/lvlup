import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/projets.ts';
import { projetsTools, type ProjetsData, type ProjetsRows, type TaskRow } from '../../../../supabase/functions/atlas-mcp/projets.ts';
import { BUDGET_CATEGORY, budgetRef } from './payments';
import { workstreamState } from './progress';
import { STATUS_LABELS } from './status';
import { formatDuration, parseDuration } from './time';
import * as types from './types';

// Les outils de Projets du connecteur (docs/connecteur-claude.md §18).

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const task = (extra: Partial<TaskRow>): TaskRow => ({
  id: uuid(),
  project_id: 'p',
  workstream_id: 'w',
  title: 'T',
  note: '',
  planned_day: null,
  due_day: null,
  waiting_client: false,
  position: 0,
  completed_at: null,
  ...extra,
});
const toApp = (t: TaskRow): types.ProjectTask => ({
  id: t.id,
  projectId: t.project_id,
  workstreamId: t.workstream_id,
  title: t.title,
  note: t.note,
  plannedDay: t.planned_day,
  dueDay: t.due_day,
  waitingClient: t.waiting_client,
  position: t.position,
  completedAt: t.completed_at,
  createdAt: '',
});

describe('connecteur — Projets : les copies suivent le module', () => {
  it('reprend les bornes et les libellés', () => {
    expect(server.PROJECT_STATUSES).toEqual(types.PROJECT_STATUSES);
    expect(server.PAYMENT_METHODS).toEqual(types.PAYMENT_METHODS);
    expect(server.STATUS_LABELS).toEqual(STATUS_LABELS);
    expect(server.TASK_TITLE_MAX).toBe(types.TASK_TITLE_MAX);
    expect(server.NOTE_TEXT_MAX).toBe(types.NOTE_TEXT_MAX);
    expect(server.BUDGET_CATEGORY).toBe(BUDGET_CATEGORY);
    expect(server.budgetRef(7)).toBe(budgetRef({ number: 7 } as types.Payment));
  });

  it('dit l’état d’un chantier pareil', () => {
    const sets: TaskRow[][] = [
      [],
      [task({ completed_at: 'x' })],
      [task({}), task({ waiting_client: true })],
      [task({ completed_at: 'x' }), task({})],
      [task({ planned_day: '2026-10-12' })],
      [task({ planned_day: '2026-10-20' })],
    ];
    for (const s of sets) expect(server.workstreamState(s, '2026-10-12')).toBe(workstreamState(s.map(toApp), '2026-10-12'));
  });

  it('lit les durées pareil', () => {
    for (const d of ['1h30', '1h', '1,5h', '45min', '90', '0', '25h', 'deux heures']) expect(server.parseDuration(d)).toBe(parseDuration(d));
    for (const m of [5, 60, 95]) expect(server.formatDuration(m)).toBe(formatDuration(m));
  });
});

function memory() {
  const P = uuid();
  const W1 = uuid();
  const W2 = uuid();
  const rows: ProjetsRows = {
    clients: [{ id: 'c1', name: 'Fleurs de Lys' }],
    projects: [
      { id: P, client_id: 'c1', number: 3, title: 'Site vitrine', status: 'production', waiting_for: null, waiting_since: null, start_day: '2026-10-01', due_day: '2026-11-15', price_cents: 150000, note: '' },
      { id: uuid(), client_id: 'c1', number: 1, title: 'Ancien site', status: 'done', waiting_for: null, waiting_since: null, start_day: null, due_day: null, price_cents: null, note: '' },
    ],
    workstreams: [
      { id: W1, project_id: P, title: 'Contenus', position: 0, due_day: null },
      { id: W2, project_id: P, title: 'Développement', position: 1, due_day: null },
    ],
    tasks: [task({ project_id: P, workstream_id: W2, title: 'Maquette', planned_day: '2026-10-08' })],
    notes: [],
    payments: [
      { id: uuid(), project_id: P, number: 4, label: 'Acompte', amount_cents: 45000, expected_day: '2026-10-01', received_day: null, method: null, invoice_ref: '' },
      { id: uuid(), project_id: P, number: 5, label: 'Solde', amount_cents: 105000, expected_day: '2026-11-15', received_day: null, method: null, invoice_ref: '' },
    ],
    time: [],
  };
  const budget: { ref: string; amountCents: number; label: string }[] = [];
  const tableOf = { projets_projects: 'projects', projets_tasks: 'tasks', projets_notes: 'notes', projets_payments: 'payments', projets_time: 'time' } as const;
  const data: ProjetsData = {
    load: async () => structuredClone(rows),
    insert: async (table, row) => {
      const made = { id: uuid(), created_at: '2026-10-12T10:00:00Z', ...(table === 'projets_tasks' ? { completed_at: null } : {}), ...row };
      (rows[tableOf[table]] as unknown[]).push(made);
      return made as never;
    },
    update: async (table, id, row) => {
      const found = (rows[tableOf[table]] as { id: string }[]).find((r) => r.id === id);
      return (found ? Object.assign(found, row) : null) as never;
    },
    remove: async (table, id) => {
      const list = rows[tableOf[table]] as { id: string }[];
      const i = list.findIndex((r) => r.id === id);
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    },
    recordIncome: async (e) => {
      if (budget.some((b) => b.ref === e.ref)) return false;
      budget.push(e);
      return true;
    },
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await projetsTools.find((t) => t.name === name)!.run(args, { data, today: '2026-10-12' });
    try {
      return JSON.parse(result.text);
    } catch {
      return { text: result.text };
    }
  };
  return { rows, budget, call };
}

describe('connecteur — Projets : les outils', () => {
  it('montre le tableau de bord : retards, argent, projets fermés à part', async () => {
    const m = memory();
    const board = await m.call('projets_tableau', {});
    expect(board.projects).toHaveLength(1);
    expect(board.projects[0]).toMatchObject({
      number: 3,
      client: 'Fleurs de Lys',
      status: 'En production',
      tasks: '0/1',
      late_tasks: ['Maquette'],
      money: { price: 1500, received: 0, remaining: 1500, late: [{ label: 'Acompte', amount: 450 }] },
    });
  });

  it('retrouve un projet par son numéro, son titre ou son client', async () => {
    const m = memory();
    for (const p of ['3', 'n°3', 'site vitrine', 'fleurs de lys']) expect((await m.call('projets_projet', { project: p })).number).toBe(3);
    await expect(m.call('projets_projet', { project: '9' })).rejects.toThrow(/n° 9/);
  });

  it('ajoute une tâche dans un chantier, la coche, note le temps et le journal', async () => {
    const m = memory();
    await expect(m.call('projets_tache_ajouter', { project: 3, title: 'Photos' })).rejects.toThrow(/chantier/);
    const added = await m.call('projets_tache_ajouter', { project: 3, workstream: 'contenus', title: 'Photos de la boutique', waiting_client: true });
    const sheet = await m.call('projets_projet', { project: '3' });
    expect(sheet.workstreams[0]).toMatchObject({ title: 'Contenus', state: 'Attend le client', tasks: [{ title: 'Photos de la boutique', waiting_client: true }] });
    await m.call('projets_tache_modifier', { id: added.task.id, done: true });
    expect(m.rows.tasks.find((t) => t.id === added.task.id)!.completed_at).not.toBeNull();
    expect((await m.call('projets_temps', { project: '3', duration: '1h30', workstream: 'Développement' })).text).toBe('1 h 30 notées sur le projet n° 3 (1 h 30 en tout).');
    await m.call('projets_note', { project: '3', text: 'Rendez-vous : elle veut une page boutique.' });
    expect(m.rows.notes[0]).toMatchObject({ day: '2026-10-12', text: 'Rendez-vous : elle veut une page boutique.' });
  });

  it('pose et lève l’attente du client, change le statut', async () => {
    const m = memory();
    await m.call('projets_attente', { project: '3', waiting_for: 'les photos' });
    expect(m.rows.projects[0]).toMatchObject({ waiting_for: 'les photos', waiting_since: '2026-10-12' });
    await m.call('projets_attente', { project: '3', waiting_for: null });
    expect(m.rows.projects[0]).toMatchObject({ waiting_for: null, waiting_since: null });
    await m.call('projets_statut', { project: '3', status: 'delivered' });
    expect(m.rows.projects[0].status).toBe('delivered');
  });

  it('reçoit un paiement et l’ajoute à Budget une seule fois', async () => {
    const m = memory();
    const res = await m.call('projets_paiement_recu', { project: '3', payment: 'acompte', method: 'virement', invoice_ref: 'F-2026-003' });
    expect(res.text).toBe('Acompte de 450 € reçu le 2026-10-12 (virement) — ajouté à Budget.');
    expect(m.rows.payments[0]).toMatchObject({ received_day: '2026-10-12', method: 'virement', invoice_ref: 'F-2026-003' });
    expect(m.budget).toEqual([
      expect.objectContaining({ ref: 'projets:paiement:4', amountCents: 45000, label: 'Fleurs de Lys — Acompte', categoryName: 'Revenus freelance', note: 'Projets, projet n° 3 « Site vitrine », facture F-2026-003' }),
    ]);
    expect((await m.call('projets_paiement_recu', { project: '3', payment: '4', method: 'virement' })).text).toMatch(/déjà dans Budget/);
    await expect(m.call('projets_paiement_recu', { project: '3', payment: 'acompte', method: 'bitcoin' })).rejects.toThrow(/method/);
  });
});
