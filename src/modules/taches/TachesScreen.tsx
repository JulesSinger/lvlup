import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { newId } from '../../core/data/coreStore';
import { isNetworkError } from '../../core/data/outbox';
import { dayString, shiftDay } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ForecastRow } from './components/ForecastRow';
import { ListEditor } from './components/ListEditor';
import { QuickAddBar } from './components/QuickAddBar';
import { TaskEditor } from './components/TaskEditor';
import { TaskRow } from './components/TaskRow';
import { TriageDialog } from './components/TriageDialog';
import { tachesStore } from './data';
import { applyCompletion, applyUndo } from './data/applyPlans';
import { syncReminders } from './data/syncReminders';
import { applyPendingTasks, pendingTaskIds } from './data/taskOutbox';
import { taskWriter } from './data/taskWriter';
import { dayLabel, shortDate } from './lib/format';
import type { QuickAdd } from './lib/quickAdd';
import { moveItem, positionPatches } from './lib/order';
import { completionPlan, undoCompletion, upcomingOccurrences } from './lib/repeat';
import type { Task, TaskInput, TaskList, TaskPatch } from './lib/types';
import { validateTask } from './lib/validation';
import { doneView, inboxView, listView, subtasksOf, todayView, upcomingView } from './lib/views';

/** La vue ouverte : Aujourd'hui, À venir, la boîte de réception, les terminées, ou une liste. */
type View = 'today' | 'upcoming' | 'inbox' | 'done' | `list:${string}`;

/** La dernière vue ouverte, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'taches.view.v1';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'today' || v === 'upcoming' || v === 'inbox' || v === 'done' || v?.startsWith('list:')) return v as View;
  } catch {
    // Stockage refusé : Aujourd'hui suffit.
  }
  return 'today';
}

const LONG_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const LONG_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « lundi 28 septembre », sous le titre d'Aujourd'hui. */
function longDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${LONG_DAYS[new Date(y, m - 1, d).getDay()]} ${d === 1 ? '1er' : d} ${LONG_MONTHS[m - 1]}`;
}

/** Ce qui s'affiche quelques secondes en bas de l'écran, avec de quoi défaire. */
type Toast = { text: string; undo?: () => Promise<void> };

const PLACEHOLDERS: Record<string, string> = {
  today: 'Appeler le garage 9h, Impôts avant le 30 !…',
  upcoming: 'Dentiste jeudi 14h, Anniversaire de Léa le 15 mars…',
  inbox: 'Une idée, une chose à faire — tu la rangeras plus tard',
  list: 'Ajouter à cette liste — « demain », « !! », « #liste » fonctionnent',
};

/**
 * Écran racine de Polaris — la V1 (étape 3, docs/etude-taches.md §12) :
 * l'ajout rapide en langage naturel, les vues Aujourd'hui, À venir, Boîte de
 * réception et les listes ; cocher (et défaire), modifier, supprimer ; les
 * sous-tâches et les priorités. Étape 4 : la répétition réglée dans la
 * fenêtre d'une tâche, la vue Terminées, réordonner une liste, et « Faire le
 * point » sur les retards.
 *
 * Toute la logique est dans les bibliothèques pures (`lib/`) : cet écran ne
 * fait qu'appeler le contrat de stockage et afficher.
 */
export function TachesScreen({ error, onError, onOpenSettings, onBackToHub, reloadToken, intent }: ModuleScreenProps) {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setViewState] = useState<View>(savedView);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listEditing, setListEditing] = useState<TaskList | 'new' | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [triaging, setTriaging] = useState(false);
  // Réordonner : l'ordre affiché pendant le glisser, et la tâche tenue.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const today = dayString();

  /**
   * Les dernières tâches reçues du serveur, gardées pour réappliquer la file
   * hors ligne dessus quand une relecture échoue faute de réseau (étape 7).
   */
  const serverTasks = useRef<Task[]>([]);
  /** Les tâches qui attendent le réseau. */
  const [waiting, setWaiting] = useState(() => pendingTaskIds(taskWriter.pending()));

  const refresh = useCallback(async () => {
    try {
      const [nextLists, nextTasks] = await Promise.all([tachesStore.listLists(), tachesStore.listTasks()]);
      serverTasks.current = nextTasks;
      // La file par-dessus le serveur : une relecture n'efface jamais ce qui n'est pas encore parti.
      const shown = applyPendingTasks(nextTasks, taskWriter.pending());
      setLists(nextLists);
      setTasks(shown);
      onError('');
      // Les rappels suivent les tâches ; un échec ici ne doit rien bloquer.
      syncReminders(shown).catch((err) => console.warn('Rappels de Polaris :', err));
    } catch (err) {
      if (isNetworkError(err)) {
        setTasks(applyPendingTasks(serverTasks.current, taskWriter.pending()));
        onError('Hors ligne : Polaris montre les dernières tâches connues, ce que tu fais partira au retour du réseau.');
      } else {
        onError(err instanceof Error ? err.message : 'Chargement impossible.');
      }
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- File hors ligne (étape 7) ---------------------------------------------
  /** Envoie ce qui attend, puis relit : même motif que Zénith et Cérès. */
  const sync = useCallback(async () => {
    const result = await taskWriter.flush();
    if (result.dropped.length > 0) onError(result.dropped[0]);
    if (result.sent > 0 || result.dropped.length > 0) await refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Au démarrage (une tâche peut attendre depuis la dernière visite), au
  // retour du réseau, et au retour sur l'application.
  useEffect(() => {
    void sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [sync]);

  // Ouvert depuis un autre module sur une tâche précise (« Modifier dans
  // Polaris », depuis Éclipse) : sa fenêtre s'ouvre dès les tâches chargées,
  // une seule fois.
  const intentDone = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || !intent?.startsWith('task:') || intentDone.current === intent) return;
    intentDone.current = intent;
    const id = intent.slice(5);
    if (tasks.some((t) => t.id === id)) setEditingId(id);
    else onError('Cette tâche n’existe plus.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, intent, tasks]);

  // Seuls les repères « en attente » suivent la file en direct ; les tâches,
  // elles, se recalculent à chaque relecture (comme dans Cérès : les
  // recalculer ici ferait disparaître un instant une tâche tout juste envoyée).
  useEffect(() => taskWriter.onPendingChange((ops) => setWaiting(pendingTaskIds(ops))), []);

  // Au montage, et après une restauration de sauvegarde (reloadToken).
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function setView(next: View) {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Sans stockage, la vue n'est simplement pas retenue.
    }
  }

  function showToast(next: Toast) {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }

  /** Une écriture : l'erreur s'affiche en haut de l'écran, et remonte à l'appelant. */
  async function write(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      throw err;
    }
  }

  const activeLists = useMemo(() => lists.filter((l) => !l.archived).sort((a, b) => a.position - b.position), [lists]);
  const currentList = view.startsWith('list:') ? lists.find((l) => `list:${l.id}` === view) : undefined;
  // Une liste supprimée entre-temps : retour à Aujourd'hui.
  useEffect(() => {
    if (loaded && view.startsWith('list:') && !currentList) setView('today');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, view, currentList]);

  const listName = (id: string | null) => lists.find((l) => l.id === id)?.name;
  const counts = useMemo(() => {
    const t = todayView(tasks, today);
    return {
      today: t.overdue.length + t.today.length,
      inbox: inboxView(tasks).length,
      lists: new Map(activeLists.map((l) => [l.id, listView(tasks, l.id).length])),
    };
  }, [tasks, today, activeLists]);

  // --- Ajouter ---------------------------------------------------------------

  async function add(parsed: QuickAdd) {
    const input: TaskInput = {
      title: parsed.title,
      plannedDay: parsed.plannedDay,
      plannedTime: parsed.plannedTime,
      durationMinutes: parsed.durationMinutes,
      dueDay: parsed.dueDay,
      priority: parsed.priority,
      listId: parsed.listId,
      // « tous les lundis », « anniversaire … » : à date fixe, comme une date qui revient.
      recurrence: parsed.recurrence,
      repeatFrom: 'schedule',
    };
    // Ajoutée là où l'on est : prévue aujourd'hui dans Aujourd'hui, demain
    // dans À venir, dans la liste ouverte — sauf si le texte a dit autre chose.
    const dated = parsed.plannedDay || parsed.dueDay;
    if (view === 'today' && !dated) input.plannedDay = today;
    if (view === 'upcoming' && !dated) input.plannedDay = shiftDay(today, 1);
    if (currentList && !parsed.listId) input.listId = currentList.id;
    input.position = tasks.filter((t) => t.listId === (input.listId ?? null) && !t.parentId).length;

    const problem = validateTask(input, tasks);
    if (problem) {
      onError(problem);
      throw new Error(problem);
    }
    let created: Task | undefined;
    await write(async () => {
      created = await taskWriter.createTask(input, newId());
    });
    // Rangée ailleurs que sous les yeux : on dit où, pour qu'elle ne semble pas perdue.
    if (created && !shownIn(view, created)) {
      const where = created.plannedDay
        ? `prévue ${dayLabel(created.plannedDay, today).toLowerCase()}`
        : created.dueDay
          ? `à faire avant le ${shortDate(created.dueDay, today)}`
          : created.listId
            ? `dans ${listName(created.listId)}`
            : 'dans la boîte de réception';
      showToast({ text: `« ${created.title} » ajoutée, ${where}.` });
    }
  }

  /** La tâche apparaît-elle dans la vue ? Les mêmes règles que l'affichage, sans les recopier. */
  function shownIn(where: View, task: Task): boolean {
    if (where === 'today') {
      const v = todayView([task], today);
      return v.overdue.length + v.today.length > 0;
    }
    if (where === 'upcoming') return upcomingView([task], today).some((d) => d.tasks.length > 0);
    if (where === 'inbox') return inboxView([task]).length > 0;
    if (where === 'done') return false;
    return currentList !== undefined && listView([task], currentList.id).length > 0;
  }

  // --- Cocher, défaire ---------------------------------------------------------

  async function toggle(task: Task) {
    if (task.completedAt) {
      await write(() => taskWriter.updateTask(task.id, { completedAt: null })).catch(() => {});
      return;
    }
    const subtasks = subtasksOf(tasks, task.id);
    const plan = completionPlan(task, subtasks, new Date().toISOString(), today, newId());
    setPending((p) => new Set(p).add(task.id));
    try {
      await write(() => applyCompletion(taskWriter, plan));
      const next = plan.updates.find((u) => u.id === task.id)?.patch.plannedDay;
      showToast({
        text: next ? `« ${task.title} » faite — la prochaine : ${dayLabel(next, today).toLowerCase()}.` : `« ${task.title} » faite.`,
        undo: () => write(() => applyUndo(taskWriter, undoCompletion(task, subtasks, plan))),
      });
    } catch {
      // Déjà affiché.
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(task.id);
        return next;
      });
    }
  }

  // --- Réordonner une liste -----------------------------------------------------------
  // Le glisser ne fait que déplacer un identifiant ; seules les positions qui
  // changent sont écrites à la fin (`lib/order.ts`).

  async function saveOrder(order: string[]) {
    const patches = positionPatches(tasks, order);
    if (patches.length === 0) return;
    // L'écran garde le nouvel ordre pendant l'écriture, sans revenir en arrière.
    setTasks((prev) => prev.map((t) => ({ ...t, position: order.includes(t.id) ? order.indexOf(t.id) : t.position })));
    await write(async () => {
      for (const { id, position } of patches) await taskWriter.updateTask(id, { position });
    }).catch(() => {});
  }

  // Pendant un glisser, c'est la fenêtre qui écoute le pointeur : la ligne
  // tenue change de place dans la page à chaque pas, et un élément déplacé
  // perd le suivi du pointeur (vu en vérifiant : le glisser s'arrêtait à
  // mi-chemin).
  const drag = useRef<{ id: string; order: string[] } | null>(null);
  useEffect(() => {
    if (!dragId) return;
    const move = (e: globalThis.PointerEvent) => {
      const current = drag.current;
      if (!current || !listRef.current) return;
      // La nouvelle place : le nombre d'autres lignes dont le milieu est au-dessus du pointeur.
      const others = [...listRef.current.querySelectorAll<HTMLElement>(':scope > [data-task-id]')].filter((el) => el.dataset.taskId !== current.id);
      const to = others.filter((el) => {
        const box = el.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
      const from = current.order.indexOf(current.id);
      if (to === from) return;
      current.order = moveItem(current.order, from, to);
      setDragOrder(current.order);
    };
    const up = () => {
      const order = drag.current?.order;
      drag.current = null;
      setDragId(null);
      setDragOrder(null);
      if (order) void saveOrder(order);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  function dragHandle(task: Task, ids: string[]) {
    return {
      dragging: dragId === task.id,
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        drag.current = { id: task.id, order: ids };
        setDragOrder(ids);
        setDragId(task.id);
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const from = ids.indexOf(task.id);
        const to = e.key === 'ArrowUp' ? from - 1 : from + 1;
        if (to < 0 || to >= ids.length) return;
        void saveOrder(moveItem(ids, from, to)).then(() => {
          // Le focus suit la tâche déplacée, pour enchaîner les flèches.
          listRef.current?.querySelector<HTMLElement>(`[data-task-id="${task.id}"] .taches-handle`)?.focus();
        });
      },
    };
  }

  // --- Modifier -------------------------------------------------------------------

  const editing = editingId ? tasks.find((t) => t.id === editingId) : undefined;

  async function saveTask(patch: TaskPatch) {
    if (!editing) return;
    await write(() => taskWriter.updateTask(editing.id, patch));
    setEditingId(null);
  }

  async function deleteTask() {
    if (!editing) return;
    const title = editing.title;
    await write(() => taskWriter.deleteTask(editing.id));
    setEditingId(null);
    showToast({ text: `« ${title} » supprimée.` });
  }

  async function addSubtask(title: string) {
    if (!editing) return;
    const input: TaskInput = { title, parentId: editing.id, listId: editing.listId, position: subtasksOf(tasks, editing.id).length };
    const problem = validateTask(input, tasks);
    if (problem) throw new Error(problem);
    await write(async () => {
      await taskWriter.createTask(input, newId());
    });
  }

  async function saveList(name: string, color: TaskList['color']) {
    if (listEditing === 'new') {
      let created: TaskList | undefined;
      await write(async () => {
        created = await tachesStore.createList({ name, color });
      });
      if (created) setView(`list:${created.id}`);
    } else if (listEditing) {
      const id = listEditing.id;
      await write(() => tachesStore.updateList(id, { name, color }));
    }
    setListEditing(null);
  }

  async function deleteList() {
    if (!listEditing || listEditing === 'new') return;
    const id = listEditing.id;
    await write(() => tachesStore.deleteList(id));
    setListEditing(null);
    setView('inbox');
  }

  // --- Affichage ---------------------------------------------------------------------

  const row = (task: Task, showDay: boolean, handle?: ReturnType<typeof dragHandle>) => (
    <TaskRow
      key={task.id}
      task={task}
      subtasks={subtasksOf(tasks, task.id)}
      today={today}
      listName={currentList ? undefined : listName(task.listId)}
      showDay={showDay}
      pending={pending.has(task.id)}
      waiting={waiting.has(task.id)}
      onToggle={(t) => void toggle(t)}
      onOpen={(t) => setEditingId(t.id)}
      handle={handle}
    />
  );

  function content() {
    if (!loaded) return <p className="taches-empty">Chargement…</p>;
    if (view === 'today') {
      const { overdue, today: current } = todayView(tasks, today);
      if (overdue.length + current.length === 0) {
        return (
          <div className="taches-empty">
            <p>Rien de prévu aujourd’hui.</p>
            <p className="taches-hint">Écris une tâche en haut, avec un jour si tu veux : « demain », « lundi 9h », « avant le 30 ».</p>
          </div>
        );
      }
      return (
        <>
          {overdue.length > 0 && (
            <div className="taches-triage-banner" role="status">
              <span>
                {overdue.length} tâche{overdue.length > 1 ? 's' : ''} en retard.
              </span>
              <button className="btn btn-sm" onClick={() => setTriaging(true)}>
                Faire le point
              </button>
            </div>
          )}
          {overdue.length > 0 && (
            <section className="taches-section">
              <h2 className="taches-section-title late">En retard</h2>
              <ul className="taches-list">{overdue.map((t) => row(t, true))}</ul>
            </section>
          )}
          <section className="taches-section">
            {overdue.length > 0 && <h2 className="taches-section-title">{dayLabel(today, today)}</h2>}
            {current.length > 0 ? <ul className="taches-list">{current.map((t) => row(t, false))}</ul> : <p className="taches-hint">Le reste est fait.</p>}
          </section>
        </>
      );
    }
    if (view === 'upcoming') {
      const days = upcomingView(tasks, today);
      // Les prochaines fois des tâches répétées, en aperçu, sous les tâches du jour.
      const forecast = new Map<string, Task[]>();
      for (const t of tasks) {
        for (const d of upcomingOccurrences(t, today, days[0].day, days[days.length - 1].day)) forecast.set(d, [...(forecast.get(d) ?? []), t]);
      }
      return days.map(({ day, tasks: dayTasks }) => {
        const ghosts = forecast.get(day) ?? [];
        const empty = dayTasks.length + ghosts.length === 0;
        return (
          <section key={day} className={`taches-section taches-day${empty ? ' taches-day-empty' : ''}`}>
            <h2 className="taches-section-title">{dayLabel(day, today)}</h2>
            {!empty && (
              <ul className="taches-list">
                {dayTasks.map((t) => row(t, false))}
                {ghosts.map((t) => (
                  <ForecastRow key={`${t.id}:${day}`} task={t} onOpen={(task) => setEditingId(task.id)} />
                ))}
              </ul>
            )}
          </section>
        );
      });
    }
    if (view === 'done') {
      const groups = doneView(tasks, (iso) => dayString(new Date(iso)));
      if (groups.length === 0) return <div className="taches-empty"><p>Rien de terminé pour l’instant.</p></div>;
      return groups.map(({ day, tasks: dayTasks }) => (
        <section key={day} className="taches-section">
          <h2 className="taches-section-title">{dayLabel(day, today)}</h2>
          <ul className="taches-list">{dayTasks.map((t) => row(t, false))}</ul>
        </section>
      ));
    }
    if (currentList) {
      const ordered = listView(tasks, currentList.id);
      if (ordered.length === 0) return <div className="taches-empty"><p>Cette liste est vide.</p></div>;
      const ids = ordered.map((t) => t.id);
      const byId = new Map(ordered.map((t) => [t.id, t]));
      const shown = (dragOrder ?? ids).map((id) => byId.get(id)).filter((t): t is Task => !!t);
      return <ul className="taches-list" ref={listRef}>{shown.map((t) => row(t, true, dragHandle(t, ids)))}</ul>;
    }
    const items = view === 'inbox' ? inboxView(tasks) : [];
    if (items.length === 0) {
      return (
        <div className="taches-empty">
          <p>La boîte de réception est vide.</p>
          <p className="taches-hint">Ce que tu ajoutes sans liste arrive ici, pour le ranger plus tard.</p>
        </div>
      );
    }
    return <ul className="taches-list">{items.map((t) => row(t, true))}</ul>;
  }

  const title =
    view === 'today' ? 'Aujourd’hui' : view === 'upcoming' ? 'À venir' : view === 'inbox' ? 'Boîte de réception' : view === 'done' ? 'Terminées' : (currentList?.name ?? '');

  return (
    <div className="layout">
      <main className="main taches-main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">⭐</span>
            <span className="brand-name">Polaris</span>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm taches-topbar-btn" onClick={onBackToHub} title="Modules" aria-label="Modules">
              <span aria-hidden="true">←</span>
              <span className="taches-topbar-label">Modules</span>
            </button>
            <button className="btn btn-ghost btn-sm taches-topbar-btn" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span aria-hidden="true">⚙</span>
              <span className="taches-topbar-label">Réglages</span>
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

        {waiting.size > 0 && (
          <div className="notice info taches-waiting-notice" role="status">
            {waiting.size} tâche{waiting.size > 1 ? 's' : ''} en attente d’envoi : {waiting.size > 1 ? 'elles partiront' : 'elle partira'} dès le retour du
            réseau.
          </div>
        )}

        <nav className="taches-nav" aria-label="Vues">
          {(
            [
              ['today', 'Aujourd’hui', counts.today],
              ['upcoming', 'À venir', 0],
              ['inbox', 'Boîte de réception', counts.inbox],
              ['done', 'Terminées', 0],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" className={`taches-nav-item${view === id ? ' on' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
              {label}
              {n > 0 && <span className="taches-count">{n}</span>}
            </button>
          ))}
          <span className="taches-nav-sep" aria-hidden="true" />
          {activeLists.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`taches-nav-item taches-nav-list taches-color-${l.color}${view === `list:${l.id}` ? ' on' : ''}`}
              aria-current={view === `list:${l.id}` ? 'page' : undefined}
              onClick={() => setView(`list:${l.id}`)}
            >
              <span className="taches-list-dot" aria-hidden="true" />
              {l.name}
              {(counts.lists.get(l.id) ?? 0) > 0 && <span className="taches-count">{counts.lists.get(l.id)}</span>}
            </button>
          ))}
          <button type="button" className="taches-nav-item taches-nav-add" onClick={() => setListEditing('new')}>
            + Liste
          </button>
        </nav>

        <div className="taches-head">
          <h1 className="taches-title">
            {title}
            {view === 'today' && <span className="taches-subtitle">{longDate(today)}</span>}
          </h1>
          {currentList && (
            <button className="btn btn-ghost btn-sm" onClick={() => setListEditing(currentList)}>
              Modifier la liste
            </button>
          )}
        </div>

        {view !== 'done' && (
          <QuickAddBar today={today} lists={activeLists} placeholder={PLACEHOLDERS[view.startsWith('list:') ? 'list' : view]} onAdd={add} />
        )}

        <div className="taches-content">{content()}</div>

        {toast && (
          <div className="taches-toast" role="status">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  const undo = toast.undo;
                  setToast(null);
                  void undo?.().catch(() => {});
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}

        {editing && (
          <TaskEditor
            task={editing}
            today={today}
            subtasks={subtasksOf(tasks, editing.id)}
            allTasks={tasks}
            lists={lists}
            onCancel={() => setEditingId(null)}
            onSave={saveTask}
            onDelete={deleteTask}
            onAddSubtask={addSubtask}
            onToggleSubtask={(s) => void toggle(s)}
            onDeleteSubtask={(s) => write(() => taskWriter.deleteTask(s.id))}
          />
        )}

        {triaging && (
          <TriageDialog
            tasks={todayView(tasks, today).overdue}
            today={today}
            onClose={() => setTriaging(false)}
            onPatch={(task, patch) => write(() => taskWriter.updateTask(task.id, patch))}
            onDone={(task) => toggle(task)}
            onDelete={(task) => write(() => taskWriter.deleteTask(task.id))}
          />
        )}

        {listEditing && (
          <ListEditor
            list={listEditing === 'new' ? null : listEditing}
            onCancel={() => setListEditing(null)}
            onSave={saveList}
            onDelete={listEditing === 'new' ? undefined : deleteList}
          />
        )}
      </main>
    </div>
  );
}
