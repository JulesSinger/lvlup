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

  it('préserve les sections des autres modules dans le blob local', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ tachesTasks: [{ id: 't' }] }));
    await decor();
    expect(JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks).toEqual([{ id: 't' }]);
  });

  it('exporte puis restaure tout, identifiants et numéros compris', async () => {
    const { project, ws } = await decor();
    await store.createTask({ projectId: project.id, workstreamId: ws.id, title: 'Logo' }, 't-logo');
    await store.createNote({ projectId: project.id, day: '2026-10-05', text: 'Appel' }, 'n-1');
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });
});
