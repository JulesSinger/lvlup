import { activeProjectCards, lateItems, NUDGE_DAYS, waitingItems, weekTasks, type DashboardData } from '../lib/dashboard';
import { projectColor } from '../lib/colors';
import { dayLabel, sinceLabel } from '../lib/format';
import type { Client, ProjectTask, Workstream } from '../lib/types';
import { ProjectCard } from './ProjectCard';
import { TaskLine } from './TaskLine';

interface Props {
  data: DashboardData;
  clients: readonly Client[];
  today: string;
  onOpenProject: (projectId: string) => void;
  onToggleTask: (task: ProjectTask) => void;
  onOpenTask: (task: ProjectTask) => void;
  onNewProject: () => void;
}

/** Le tableau de bord (§4.1) : sur quoi je travaille, qu'est-ce qui brûle, qu'est-ce que j'attends. */
export function Dashboard({ data, clients, today, onOpenProject, onToggleTask, onOpenTask, onNewProject }: Props) {
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client inconnu';
  const wsTitle = new Map<string, Workstream>(data.workstreams.map((w) => [w.id, w]));
  const week = weekTasks(data, today);
  const late = lateItems(data, today);
  const waiting = waitingItems(data, today);
  const cards = activeProjectCards(data, today);

  if (data.projects.length === 0) {
    return (
      <div className="projets-empty">
        <p>Aucun projet pour l’instant.</p>
        <p className="projets-hint">Crée ton premier projet : choisis un modèle, et ses chantiers et ses tâches sont prêts.</p>
        <button className="btn btn-primary" onClick={onNewProject}>
          + Nouveau projet
        </button>
      </div>
    );
  }

  return (
    <div className="projets-dash">
      <div className="projets-dash-col">
        {late.length > 0 && (
          <section className="projets-panel projets-panel-late" aria-label="En retard">
            <h2 className="projets-section-title late">
              En retard <span className="projets-count">{late.length}</span>
            </h2>
            <ul className="projets-tasks">
              {late.map((item) =>
                item.kind === 'task' ? (
                  <TaskLine
                    key={`t-${item.task.id}`}
                    task={item.task}
                    today={today}
                    project={item.project}
                    clientName={clientName(item.project.clientId)}
                    workstreamTitle={wsTitle.get(item.task.workstreamId)?.title}
                    onToggle={onToggleTask}
                    onOpen={onOpenTask}
                  />
                ) : (
                  <li key={`${item.kind}-${item.kind === 'workstream' ? item.workstream.id : item.project.id}`} className="projets-task projets-late-row">
                    <button type="button" className="projets-link" onClick={() => onOpenProject(item.project.id)}>
                      <span className="projets-task-title">
                        {item.kind === 'workstream' ? `Chantier « ${item.workstream.title} »` : `Mise en ligne de « ${item.project.title} »`}
                      </span>
                      <span className="projets-task-meta">
                        <span className="projets-tag" style={{ ['--c' as string]: projectColor(item.project.number) }}>
                          {clientName(item.project.clientId)}
                        </span>
                      </span>
                    </button>
                    <span className="projets-when late">{dayLabel(item.day, today)}</span>
                  </li>
                ),
              )}
            </ul>
          </section>
        )}

        <section className="projets-panel" aria-label="Cette semaine">
          <h2 className="projets-section-title">
            Cette semaine <span className="projets-count">{week.length}</span>
          </h2>
          {week.length === 0 ? (
            <p className="projets-hint">Rien de prévu ces sept jours. Donne un jour aux tâches que tu veux faire, depuis la fiche d’un projet.</p>
          ) : (
            <ul className="projets-tasks">
              {week.map(({ task, project }) => (
                <TaskLine
                  key={task.id}
                  task={task}
                  today={today}
                  project={project}
                  clientName={clientName(project.clientId)}
                  workstreamTitle={wsTitle.get(task.workstreamId)?.title}
                  onToggle={onToggleTask}
                  onOpen={onOpenTask}
                />
              ))}
            </ul>
          )}
        </section>

        {waiting.length > 0 && (
          <section className="projets-panel" aria-label="En attente du client">
            <h2 className="projets-section-title">
              En attente du client <span className="projets-count">{waiting.length}</span>
            </h2>
            <ul className="projets-waits">
              {waiting.map((item) => (
                <li key={item.kind === 'task' ? `t-${item.task.id}` : `${item.kind}-${item.project.id}`}>
                  <button type="button" className="projets-wait" onClick={() => onOpenProject(item.project.id)}>
                    <span aria-hidden="true">⏳</span>
                    <span className="projets-wait-main">
                      <b>
                        {item.kind === 'project'
                          ? item.what
                          : item.kind === 'task'
                            ? item.task.title
                            : `${item.questions.length} question${item.questions.length > 1 ? 's' : ''} à lui poser`}
                      </b>
                      {item.kind === 'needs' && <span className="projets-wait-detail">{item.questions.join(' · ')}</span>}
                      <span className="projets-tag" style={{ ['--c' as string]: projectColor(item.project.number) }}>
                        {clientName(item.project.clientId)}
                      </span>
                    </span>
                    {item.kind === 'project' && item.days !== null && (
                      <span className={`projets-wait-days${item.days >= NUDGE_DAYS ? ' old' : ''}`}>{sinceLabel(item.days)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="projets-dash-col">
        <section aria-label="Projets actifs">
          <h2 className="projets-section-title">
            Projets actifs <span className="projets-count">{cards.length}</span>
          </h2>
          {cards.length === 0 ? (
            <p className="projets-hint">Aucun projet signé ou en production. Les pistes et les devis sont dans « Projets ».</p>
          ) : (
            <div className="projets-cards">
              {cards.map((card) => (
                <ProjectCard key={card.project.id} card={card} clientName={clientName(card.project.clientId)} onOpen={() => onOpenProject(card.project.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
