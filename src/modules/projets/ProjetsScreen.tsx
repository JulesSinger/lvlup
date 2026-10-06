import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { newId } from '../../core/data/coreStore';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ClientEditor } from './components/ClientEditor';
import { ClientsView } from './components/ClientsView';
import { Dashboard } from './components/Dashboard';
import { LinkEditor } from './components/LinkEditor';
import { ProjectCreator, type NewProject } from './components/ProjectCreator';
import { ProjectSheet } from './components/ProjectSheet';
import { ProjectsView } from './components/ProjectsView';
import { TaskEditor } from './components/TaskEditor';
import { WorkstreamEditor } from './components/WorkstreamEditor';
import { projetsStore as store } from './data';
import type { ProjetsBackup } from './data/projetsStore';
import { projectProgress, projectWorkstreams } from './lib/progress';
import { instantiateTemplate, templateById } from './lib/templates';
import type { Client, ClientInput, ProjectLink, ProjectPatch, ProjectTask, Workstream } from './lib/types';

type View = 'dash' | 'projects' | 'clients';

/** La dernière vue ouverte, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'projets.view.v1';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'dash' || v === 'projects' || v === 'clients') return v;
  } catch {
    // Stockage refusé : le tableau de bord suffit.
  }
  return 'dash';
}

const EMPTY: Required<ProjetsBackup> = { clients: [], projects: [], workstreams: [], tasks: [], notes: [], links: [] };

const nextPosition = (items: readonly { position: number }[]) => items.reduce((max, i) => Math.max(max, i.position + 1), 0);

/**
 * Écran racine de Projets — la V1 (étape 3, docs/etude-projets.md §10) : le
 * tableau de bord, tous les projets par statut, les clients ; créer un projet
 * d'après un modèle ; la fiche d'un projet avec ses chantiers, son journal et
 * ses infos ; le statut de la relation et l'attente du client. Étape 4 : le
 * questionnaire de besoins, la fiche design, les liens et les accès, et les
 * projets en colonnes (pipeline).
 *
 * Toute la logique est dans les bibliothèques pures (`lib/`) : cet écran ne
 * fait qu'appeler le contrat de stockage et afficher.
 */
export function ProjetsScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, label, emoji }: ModuleScreenProps) {
  const [data, setData] = useState<Required<ProjetsBackup>>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [view, setViewState] = useState<View>(savedView);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientEditing, setClientEditing] = useState<Client | 'new' | null>(null);
  const [taskEditingId, setTaskEditingId] = useState<string | null>(null);
  const [linkEditing, setLinkEditing] = useState<{ projectId: string; link: ProjectLink | null } | null>(null);
  const [wsEditing, setWsEditing] = useState<{ projectId: string; workstream: Workstream | null } | null>(null);
  const today = dayString();

  const refresh = useCallback(async () => {
    try {
      const [clients, projects, workstreams, tasks, notes, links] = await Promise.all([
        store.listClients(),
        store.listProjects(),
        store.listWorkstreams(),
        store.listTasks(),
        store.listNotes(),
        store.listLinks(),
      ]);
      setData({ clients, projects, workstreams, tasks, notes, links });
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  function setView(v: View) {
    setViewState(v);
    setOpenId(null);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Sans stockage, la vue n'est simplement pas retenue.
    }
  }

  /** Écrit puis relit. L'erreur remonte : une fenêtre l'affiche et garde sa saisie. */
  async function write(action: () => Promise<unknown>) {
    await action();
    await refresh();
  }

  /** Même chose hors fenêtre : l'erreur va dans le bandeau commun, et la promesse ne rejette jamais. */
  function writeOrReport(action: () => Promise<unknown>): Promise<void> {
    return write(action).catch((err) => {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      void refresh();
    });
  }

  /** Cocher est immédiat à l'écran ; en cas d'échec, la relecture remet la vérité. */
  function toggleTask(task: ProjectTask) {
    const completedAt = task.completedAt === null ? new Date().toISOString() : null;
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, completedAt } : t)) }));
    store.updateTask(task.id, { completedAt }).catch((err) => {
      onError(err instanceof Error ? err.message : 'La tâche n’a pas pu être cochée.');
      void refresh();
    });
  }

  async function createProject(draft: NewProject) {
    let clientId: string;
    if ('id' in draft.client) clientId = draft.client.id;
    else clientId = (await store.createClient(draft.client.input, newId())).id;
    const projectId = newId();
    await store.createProject({ ...draft.project, clientId }, projectId);
    const template = templateById(draft.template);
    if (template) {
      const copy = instantiateTemplate(template, projectId, newId);
      await store.addWorkstreams(copy.workstreams, copy.tasks);
    }
    await refresh();
    setCreating(false);
    setOpenId(projectId);
  }

  async function saveClient(input: ClientInput) {
    if (clientEditing === 'new') await write(() => store.createClient(input, newId()));
    else if (clientEditing) await write(() => store.updateClient(clientEditing.id, input));
    setClientEditing(null);
  }

  const open = data.projects.find((p) => p.id === openId) ?? null;
  const editingTask = data.tasks.find((t) => t.id === taskEditingId) ?? null;
  const projectCount = (clientId: string) => data.projects.filter((p) => p.clientId === clientId).length;
  const counts = useMemo(() => ({ projects: data.projects.length, clients: data.clients.length }), [data]);

  function content() {
    if (!loaded) return <p className="projets-hint">Chargement…</p>;
    if (open) {
      const views = projectWorkstreams(open.id, data.workstreams, data.tasks, today);
      return (
        <ProjectSheet
          key={open.id}
          project={open}
          client={data.clients.find((c) => c.id === open.clientId)}
          clients={data.clients}
          views={views}
          notes={data.notes.filter((n) => n.projectId === open.id)}
          links={data.links.filter((l) => l.projectId === open.id)}
          progress={projectProgress(open.id, data.tasks)}
          today={today}
          onBack={() => setOpenId(null)}
          onPatch={(patch: ProjectPatch) => write(() => store.updateProject(open.id, patch))}
          onQuickPatch={(patch: ProjectPatch) => writeOrReport(() => store.updateProject(open.id, patch))}
          onDelete={async () => {
            await store.deleteProject(open.id);
            setOpenId(null);
            await refresh();
          }}
          onToggleTask={toggleTask}
          onOpenTask={(t) => setTaskEditingId(t.id)}
          onAddTask={(workstreamId, title) =>
            write(() =>
              store.createTask(
                { projectId: open.id, workstreamId, title, position: nextPosition(data.tasks.filter((t) => t.workstreamId === workstreamId)) },
                newId(),
              ),
            )
          }
          onEditWorkstream={(workstream) => setWsEditing({ projectId: open.id, workstream })}
          onAddNote={(day, text) => write(() => store.createNote({ projectId: open.id, day, text }, newId()))}
          onDeleteNote={(note) => write(() => store.deleteNote(note.id))}
          onSaveNeeds={(needs) => write(() => store.updateProject(open.id, { needs }))}
          onSaveDesign={(design) => write(() => store.updateProject(open.id, { design }))}
          onEditLink={(link) => setLinkEditing({ projectId: open.id, link })}
        />
      );
    }
    if (view === 'projects') return <ProjectsView projects={data.projects} tasks={data.tasks} clients={data.clients} today={today} onOpen={setOpenId} />;
    if (view === 'clients') {
      return (
        <>
          <div className="projets-view-actions">
            <button className="btn btn-sm" onClick={() => setClientEditing('new')}>
              + Client
            </button>
          </div>
          <ClientsView clients={data.clients} projects={data.projects} onEdit={setClientEditing} onOpenProject={setOpenId} />
        </>
      );
    }
    return (
      <Dashboard
        data={data}
        clients={data.clients}
        today={today}
        onOpenProject={setOpenId}
        onToggleTask={toggleTask}
        onOpenTask={(t) => setTaskEditingId(t.id)}
        onNewProject={() => setCreating(true)}
      />
    );
  }

  return (
    <div className="layout">
      <main className="main projets-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button className="btn topbar-settings" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span className="topbar-settings-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="topbar-settings-label">Réglages</span>
            </button>
            <button className="btn btn-primary topbar-add" onClick={() => setCreating(true)} aria-label="Nouveau projet">
              <span aria-hidden="true">+</span>
              <span className="topbar-add-label">Projet</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        <nav className="projets-nav" aria-label="Vues">
          {(
            [
              ['dash', 'Tableau de bord', 0],
              ['projects', 'Projets', counts.projects],
              ['clients', 'Clients', counts.clients],
            ] as const
          ).map(([id, text, n]) => (
            <button
              key={id}
              type="button"
              className={`projets-nav-item${view === id && !open ? ' on' : ''}`}
              aria-current={view === id && !open ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              {text}
              {n > 0 && <span className="projets-count">{n}</span>}
            </button>
          ))}
        </nav>

        <div className="projets-content">{content()}</div>

        {creating && <ProjectCreator clients={data.clients} onClose={() => setCreating(false)} onCreate={createProject} />}

        {clientEditing && (
          <ClientEditor
            client={clientEditing === 'new' ? null : clientEditing}
            projectCount={clientEditing === 'new' ? 0 : projectCount(clientEditing.id)}
            onClose={() => setClientEditing(null)}
            onSave={saveClient}
            onArchive={
              clientEditing === 'new'
                ? undefined
                : async (archived) => {
                    await write(() => store.updateClient(clientEditing.id, { archived }));
                    setClientEditing(null);
                  }
            }
            onDelete={
              clientEditing === 'new'
                ? undefined
                : async () => {
                    await write(() => store.deleteClient(clientEditing.id));
                    setClientEditing(null);
                  }
            }
          />
        )}

        {editingTask && (
          <TaskEditor
            task={editingTask}
            workstreams={data.workstreams.filter((w) => w.projectId === editingTask.projectId).sort((a, b) => a.position - b.position)}
            onClose={() => setTaskEditingId(null)}
            onSave={async (patch) => {
              await write(() => store.updateTask(editingTask.id, patch));
              setTaskEditingId(null);
            }}
            onDelete={async () => {
              await write(() => store.deleteTask(editingTask.id));
              setTaskEditingId(null);
            }}
          />
        )}

        {linkEditing && (
          <LinkEditor
            link={linkEditing.link}
            onClose={() => setLinkEditing(null)}
            onSave={async (input) => {
              const current = linkEditing.link;
              if (current) await write(() => store.updateLink(current.id, input));
              else {
                const siblings = data.links.filter((l) => l.projectId === linkEditing.projectId);
                await write(() => store.createLink({ ...input, projectId: linkEditing.projectId, position: nextPosition(siblings) }, newId()));
              }
              setLinkEditing(null);
            }}
            onDelete={
              linkEditing.link
                ? async () => {
                    await write(() => store.deleteLink(linkEditing.link!.id));
                    setLinkEditing(null);
                  }
                : undefined
            }
          />
        )}

        {wsEditing && (
          <WorkstreamEditor
            workstream={wsEditing.workstream}
            taskCount={wsEditing.workstream ? data.tasks.filter((t) => t.workstreamId === wsEditing.workstream!.id).length : 0}
            onClose={() => setWsEditing(null)}
            onSave={async ({ title, dueDay }) => {
              const current = wsEditing.workstream;
              if (current) await write(() => store.updateWorkstream(current.id, { title, dueDay }));
              else {
                const siblings = data.workstreams.filter((w) => w.projectId === wsEditing.projectId);
                await write(() => store.createWorkstream({ projectId: wsEditing.projectId, title, dueDay, position: nextPosition(siblings) }, newId()));
              }
              setWsEditing(null);
            }}
            onDelete={
              wsEditing.workstream
                ? async () => {
                    await write(() => store.deleteWorkstream(wsEditing.workstream!.id));
                    setWsEditing(null);
                  }
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

