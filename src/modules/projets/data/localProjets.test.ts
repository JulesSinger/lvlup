import { beforeEach, describe, expect, it } from 'vitest';
import { LocalProjets } from './localProjets';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale — même motif que les autres modules.
 */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

describe('LocalProjets', () => {
  let store: LocalProjets;

  beforeEach(() => {
    memory.clear();
    store = new LocalProjets();
  });

  /** Un client, un projet, un chantier : le décor de la plupart des cas. */
  async function decor() {
    const client = await store.createClient({ name: 'Fleurs de Lou', trade: 'fleuriste' }, 'c-lou');
    const project = await store.createProject({ clientId: client.id, title: 'Site vitrine', template: 'vitrine' }, 'p-1');
    const ws = await store.createWorkstream({ projectId: project.id, title: 'Contenus' }, 'w-1');
    return { client, project, ws };
  }

  it('crée un client et un projet avec leurs valeurs par défaut', async () => {
    const { client, project } = await decor();
    expect(client).toMatchObject({ contactName: '', phone: '', archived: false });
    expect(project).toMatchObject({
      number: 1,
      status: 'lead',
      waitingFor: null,
      waitingSince: null,
      dueDay: null,
      priceCents: null,
      needs: {},
      design: {},
      template: 'vitrine',
    });
  });

  it('numérote les projets à la suite du plus grand numéro', async () => {
    const { client } = await decor();
    const second = await store.createProject({ clientId: client.id, title: 'Refonte' });
    expect(second.number).toBe(2);
    await store.deleteProject(second.id);
    const third = await store.createProject({ clientId: client.id, title: 'Maintenance' });
    expect(third.number).toBe(2); // comme côté Supabase : le plus grand restant + 1
  });

  it('rejouées avec le même id, les créations n’écrivent rien de plus', async () => {
    const { client, project } = await decor();
    expect(await store.createClient({ name: 'Autre', trade: 'autre' }, client.id)).toEqual(client);
    expect(await store.createProject({ clientId: client.id, title: 'Autre' }, project.id)).toEqual(project);
    expect(await store.listProjects()).toHaveLength(1);
  });

  it('refuse un projet sans client, et une tâche dans le chantier d’un autre projet', async () => {
    const { client, ws } = await decor();
    await expect(store.createProject({ clientId: 'inconnu', title: 'X' })).rejects.toThrow();
    const other = await store.createProject({ clientId: client.id, title: 'Refonte' });
    await expect(store.createTask({ projectId: other.id, workstreamId: ws.id, title: 'Photos' })).rejects.toThrow();
  });

  it('un client qui a des projets ne se supprime pas, il s’archive', async () => {
    const { client } = await decor();
    await expect(store.deleteClient(client.id)).rejects.toThrow(/archive/);
    await store.updateClient(client.id, { archived: true });
    expect((await store.listClients())[0].archived).toBe(true);
  });

  it('ne plus rien attendre du client efface aussi la date d’attente', async () => {
    const { project } = await decor();
    await store.updateProject(project.id, { waitingFor: 'les photos', waitingSince: '2026-10-01' });
    await store.updateProject(project.id, { waitingFor: null });
    const [after] = await store.listProjects();
    expect(after.waitingFor).toBeNull();
    expect(after.waitingSince).toBeNull();
  });

  it('coche une tâche, et supprimer un chantier emporte ses tâches', async () => {
    const { project, ws } = await decor();
    const task = await store.createTask({ projectId: project.id, workstreamId: ws.id, title: 'Photos des bouquets', waitingClient: true });
    expect(task).toMatchObject({ completedAt: null, waitingClient: true, note: '' });
    await store.updateTask(task.id, { completedAt: '2026-10-05T10:00:00.000Z' });
    expect((await store.listTasks())[0].completedAt).toBe('2026-10-05T10:00:00.000Z');
    await store.deleteWorkstream(ws.id);
    expect(await store.listTasks()).toEqual([]);
  });

  it('ajoute un modèle d’un bloc, et le rejouer ne double rien', async () => {
    const { project } = await decor();
    const workstreams = [
      { id: 'w-dev', projectId: project.id, title: 'Développement', position: 1 },
      { id: 'w-host', projectId: project.id, title: 'Hébergement & domaine', position: 2 },
    ];
    const tasks = [
      { id: 't-1', projectId: project.id, workstreamId: 'w-dev', title: 'Pages', position: 0 },
      { id: 't-2', projectId: project.id, workstreamId: 'w-host', title: 'Nom de domaine', position: 0 },
    ];
    await store.addWorkstreams(workstreams, tasks);
    await store.addWorkstreams(workstreams, tasks);
    expect(await store.listWorkstreams()).toHaveLength(3);
    expect((await store.listTasks()).map((t) => t.title).sort()).toEqual(['Nom de domaine', 'Pages']);
  });

  it('supprimer un projet emporte chantiers, tâches et journal', async () => {
    const { project, ws } = await decor();
    await store.createTask({ projectId: project.id, workstreamId: ws.id, title: 'Logo' });
    await store.createNote({ projectId: project.id, day: '2026-10-05', text: 'Premier rendez-vous' });
    await store.deleteProject(project.id);
    expect(await store.listWorkstreams()).toEqual([]);
    expect(await store.listTasks()).toEqual([]);
    expect(await store.listNotes()).toEqual([]);
  });

  it('le journal : écrire, corriger, retirer', async () => {
    const { project } = await decor();
    const note = await store.createNote({ projectId: project.id, day: '2026-10-05', text: 'Appel' });
    await store.updateNote(note.id, 'Appel : elle veut une page Mariages');
    expect((await store.listNotes())[0].text).toBe('Appel : elle veut une page Mariages');
    await store.deleteNote(note.id);
    expect(await store.listNotes()).toEqual([]);
  });

  it('les liens : créer, modifier, et ils partent avec leur projet', async () => {
    const { project } = await decor();
    const link = await store.createLink({ projectId: project.id, kind: 'hebergement', label: 'OVH', login: 'lou@fleurs.fr' }, 'l-1');
    expect(link).toMatchObject({ url: '', note: '', position: 0 });
    expect(await store.createLink({ projectId: project.id, kind: 'autre', label: 'X' }, 'l-1')).toEqual(link);
    await store.updateLink(link.id, { url: 'ovh.com/manager' });
    expect((await store.listLinks())[0].url).toBe('ovh.com/manager');
    await store.deleteProject(project.id);
    expect(await store.listLinks()).toEqual([]);
  });

  it('un projet écrit avant l’étape 4 se lit avec une fiche design vide', async () => {
    const { project } = await decor();
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    delete raw.projetsProjects[0].design;
    localStorage.setItem('palier.v1', JSON.stringify(raw));
    expect((await store.listProjects())[0]).toMatchObject({ id: project.id, design: {} });
    await store.updateProject(project.id, { design: { colors: ['#e7b7c3'], mood: 'champêtre' } });
    expect((await store.listProjects())[0].design).toEqual({ colors: ['#e7b7c3'], mood: 'champêtre' });
  });

  it('les paiements : numérotés, reçus puis « dé-reçus » sans garder leur mode', async () => {
    const { project } = await decor();
    const deposit = await store.createPayment({ projectId: project.id, label: 'Acompte 30 %', amountCents: 27_000, expectedDay: '2026-10-06' }, 'pay-1');
    const rest = await store.createPayment({ projectId: project.id, label: 'Solde', amountCents: 63_000 });
    expect([deposit.number, rest.number]).toEqual([1, 2]);
    expect(deposit).toMatchObject({ receivedDay: null, method: null, invoiceRef: '' });
    expect(await store.createPayment({ projectId: project.id, label: 'X', amountCents: 1 }, 'pay-1')).toEqual(deposit);
    await store.updatePayment(deposit.id, { receivedDay: '2026-10-06', method: 'virement', invoiceRef: 'F-1' });
    expect((await store.listPayments())[0]).toMatchObject({ receivedDay: '2026-10-06', method: 'virement' });
    await store.updatePayment(deposit.id, { receivedDay: null });
    expect((await store.listPayments())[0]).toMatchObject({ receivedDay: null, method: null, invoiceRef: 'F-1' });
  });

  it('le temps passé garde ses entrées quand leur chantier disparaît, et part avec le projet', async () => {
    const { project, ws } = await decor();
    await store.createTime({ projectId: project.id, workstreamId: ws.id, day: '2026-10-06', minutes: 150 }, 't-1');
    await store.deleteWorkstream(ws.id);
    expect((await store.listTime())[0]).toMatchObject({ minutes: 150, workstreamId: null, note: '' });
    await store.createPayment({ projectId: project.id, label: 'Solde', amountCents: 1 });
    await store.deleteProject(project.id);
    expect(await store.listTime()).toEqual([]);
    expect(await store.listPayments()).toEqual([]);
  });

  it('préserve les sections des autres modules dans le blob local', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ tachesTasks: [{ id: 't' }] }));
    await decor();
    expect(JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks).toEqual([{ id: 't' }]);
  });

  it('exporte puis restaure tout, identifiants et numéros compris', async () => {
    const { project, ws } = await decor();
    await store.createTask({ projectId: project.id, workstreamId: ws.id, title: 'Logo' }, 't-logo');
    await store.createNote({ projectId: project.id, day: '2026-10-05', text: 'Appel' }, 'n-1');
    await store.createLink({ projectId: project.id, kind: 'maquette', label: 'Figma' }, 'l-1');
    await store.createPayment({ projectId: project.id, label: 'Acompte', amountCents: 100 }, 'pay-1');
    await store.createTime({ projectId: project.id, day: '2026-10-06', minutes: 30 }, 'time-1');
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });
});
