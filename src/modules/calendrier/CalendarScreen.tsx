import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import type { CalendarMark, MarkMove, MarkSlot } from '../../core/lib/services';
import type { ViewName } from './components/CalendarView';
import { EventEditor, type EditorValues } from './components/EventEditor';
import { KindSwitch, type Kind } from './components/KindSwitch';
import { MarkDialog } from './components/MarkDialog';
import { ScopeDialog } from './components/ScopeDialog';
import { calendarStore } from './data';
import { applyPlan } from './data/applyPlan';
import { syncReminders } from './data/syncReminders';
import { defaultSpan, markItem, slotFromValues, toCalendarItem, type EventSpan } from './lib/calendarBridge';
import { dayString, shiftDay } from '../../core/lib/day';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { expandEvents, type Occurrence } from './lib/recurrence';
import { planDelete, planEdit, type OccurrenceValues, type Scope } from './lib/seriesEdit';
import { DEFAULT_CALENDAR_SETTINGS, type CalendarEvent, type CalendarSettings, type EventException, type EventInput } from './lib/types';

/**
 * FullCalendar n'est chargé qu'ici, à l'ouverture d'Éclipse : un fichier à
 * part au build (76 Ko compressés, étude §13), que ni le hub ni les autres
 * modules ne téléchargent.
 */
const CalendarView = lazy(() => import('./components/CalendarView'));

/** La dernière vue choisie, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'calendrier.view.v1';
const NARROW = 700;

function initialView(narrow: boolean): ViewName {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'dayGridMonth' || saved === 'timeGridWeek' || saved === 'timeGridDay' || saved === 'listWeek') return saved;
  } catch {
    // Stockage refusé : la vue par défaut suffit.
  }
  return narrow ? 'timeGridDay' : 'timeGridWeek';
}

/** `occurrenceDay`, `before` : pour une occurrence existante — le jour qu'elle a dans la série, et ce que la fenêtre en montrait. */
/** Les calques allumés ou éteints à la main, retenus sur cet appareil — un confort, pas une donnée. */
const LAYERS_KEY = 'calendrier.layers.v1';

function savedLayers(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/**
 * La fenêtre d'un autre module ouverte par-dessus le calendrier (06/10/2026) :
 * pour modifier une marque (`link`), ou créer sur un créneau (`slot`) — avec,
 * pour revenir à « Événement », le créneau d'où l'on est parti.
 */
type Lent = { sourceId: string; link?: string; slot?: MarkSlot; span?: EventSpan };

type Editing = { eventId: string | null; occurrenceDay: string | null; inSeries: boolean; values: EditorValues; before: OccurrenceValues | null };

/** Un déplacement d'occurrence en attente de « laquelle ? » : FullCalendar attend la réponse pour le garder ou l'annuler. */
type PendingMove = { eventId: string; occurrenceDay: string; span: EventSpan; resolve: () => void; reject: (err: Error) => void };

function valuesOf(o: Occurrence): OccurrenceValues {
  const { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders } = o;
  return { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders };
}

/**
 * Écran racine d'Éclipse — le calendrier, étape 3 (docs/etude-calendrier.md
 * §12) : la V1. Quatre vues (mois, semaine, jour, agenda), créer un
 * événement en touchant ou en glissant sur un créneau, le déplacer ou
 * l'étirer, le modifier ou le supprimer.
 *
 * Les occurrences ne sont jamais stockées : elles sont dépliées ici, pour la
 * seule période affichée, à partir des séries et de leurs exceptions.
 * Étape 4 : les séries se créent dans la fenêtre d'un événement ; modifier,
 * déplacer ou supprimer une occurrence demande « cet événement, les
 * suivants ou tous », traduit en écritures par `lib/seriesEdit.ts`.
 */
export function CalendarScreen({ user, error, onError, onOpenSettings, onSwitchModule, onOpenModule, reloadToken, services, label, emoji }: ModuleScreenProps) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < NARROW;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [exceptions, setExceptions] = useState<EventException[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_CALENDAR_SETTINGS);
  const [range, setRange] = useState(() => {
    const today = dayString();
    return { from: shiftDay(today, -7), to: shiftDay(today, 7) };
  });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // --- Les calques des autres modules (étape 5) ---
  const sources = useMemo(() => services.calendarSources ?? [], [services]);
  const [layerChoice, setLayerChoice] = useState<Record<string, boolean>>(savedLayers);
  const [marks, setMarks] = useState<Record<string, CalendarMark[]>>({});
  const [failedLayers, setFailedLayers] = useState<Set<string>>(new Set());
  // Relire les calques après une coche faite depuis le calendrier.
  const [marksVersion, setMarksVersion] = useState(0);
  /** La marque dont la fenêtre est ouverte (toucher une marque ailleurs que sur son rond). */
  const [openedMark, setOpenedMark] = useState<{ sourceId: string; markId: string } | null>(null);
  const [lent, setLent] = useState<Lent | null>(null);
  /** Ce qu'on peut créer sur un créneau : un événement, et ce que les calques proposent (« Tâche »). */
  const kinds = useMemo<Kind[]>(
    () => [{ id: 'event', label: 'Événement' }, ...sources.filter((s) => s.Editor && s.createLabel).map((s) => ({ id: s.id, label: s.createLabel! }))],
    [sources],
  );
  const isVisible = useCallback((id: string, byDefault: boolean) => layerChoice[id] ?? byDefault, [layerChoice]);

  useEffect(() => {
    // Chaque calque se charge seul : un module en panne n'empêche pas les autres.
    let current = true;
    for (const source of sources) {
      if (!isVisible(source.id, source.defaultVisible)) continue;
      source.marksBetween(range.from, range.to).then(
        (found) => {
          if (!current) return;
          setMarks((m) => ({ ...m, [source.id]: found }));
          setFailedLayers((f) => (f.has(source.id) ? new Set([...f].filter((id) => id !== source.id)) : f));
        },
        () => current && setFailedLayers((f) => new Set(f).add(source.id)),
      );
    }
    return () => {
      current = false;
    };
  }, [sources, range, isVisible, reloadToken, marksVersion]);

  /**
   * Cocher une marque d'un autre module (une tâche de Polaris, étape 6 de
   * Polaris). L'écran la coche tout de suite ; c'est le module qui écrit, puis
   * le calque est relu — une tâche répétée cochée réapparaît alors à sa date
   * suivante. En cas d'échec, la marque revient comme avant et l'erreur
   * s'affiche.
   */
  async function toggleMark(sourceId: string, markId: string) {
    const source = sources.find((s) => s.id === sourceId);
    if (!source?.toggleMark) return;
    const flip = (list: CalendarMark[] = []) => list.map((m) => (m.id === markId ? { ...m, done: !m.done } : m));
    setMarks((m) => ({ ...m, [sourceId]: flip(m[sourceId]) }));
    try {
      await source.toggleMark(markId);
    } catch (err) {
      setMarks((m) => ({ ...m, [sourceId]: flip(m[sourceId]) }));
      onError(err instanceof Error ? err.message : 'Impossible de cocher.');
    }
    setMarksVersion((v) => v + 1);
  }

  /**
   * Une marque d'un autre module glissée ou étirée (une tâche de Polaris) :
   * c'est le module qui écrit, puis le calque est relu. En cas de refus,
   * l'erreur s'affiche et FullCalendar remet la marque à sa place.
   */
  async function moveMark(sourceId: string, markId: string, to: MarkMove) {
    const source = sources.find((s) => s.id === sourceId);
    if (!source?.moveMark) throw new Error('Ce calque ne se déplace pas.');
    try {
      await source.moveMark(markId, to);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Déplacement impossible.');
      throw err;
    } finally {
      setMarksVersion((v) => v + 1);
    }
  }

  function toggleLayer(id: string, visible: boolean) {
    const next = { ...layerChoice, [id]: visible };
    setLayerChoice(next);
    try {
      localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
    } catch {
      // Sans stockage, le choix vaut pour cette visite seulement.
    }
  }

  const refresh = useCallback(async () => {
    try {
      const [nextEvents, nextExceptions, nextSettings] = await Promise.all([
        calendarStore.listEvents(),
        calendarStore.listExceptions(),
        calendarStore.getSettings(),
      ]);
      setEvents(nextEvents);
      setExceptions(nextExceptions);
      setSettings(nextSettings);
      onError('');
      // Les rappels suivent les événements ; un échec ici ne doit rien bloquer.
      syncReminders(nextEvents, nextExceptions).catch((err) => console.warn('Rappels du calendrier :', err));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken).
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  const occurrences = useMemo(() => expandEvents(events, exceptions, range.from, range.to), [events, exceptions, range]);
  const items = useMemo(
    () => [
      ...occurrences.map(toCalendarItem),
      ...sources.flatMap((source, i) =>
        isVisible(source.id, source.defaultVisible) ? (marks[source.id] ?? []).map((mark) => markItem(source, mark, i + 1)) : [],
      ),
    ],
    [occurrences, sources, marks, isVisible],
  );

  function openNew(span: EventSpan, title = '') {
    setEditing({
      eventId: null,
      occurrenceDay: null,
      inSeries: false,
      values: { ...span, title, color: 'bleu', location: '', note: '', recurrence: null, reminders: null },
      before: null,
    });
  }

  function openExisting(eventId: string, occurrenceDay: string) {
    const event = events.find((e) => e.id === eventId);
    const occurrence = occurrences.find((o) => o.eventId === eventId && o.occurrenceDay === occurrenceDay);
    if (!event || !occurrence) return;
    // La fenêtre montre l'occurrence touchée (exception comprise), avec la règle de sa série.
    const before = valuesOf(occurrence);
    setEditing({ eventId, occurrenceDay, inSeries: event.recurrence !== null, values: { ...before, recurrence: event.recurrence }, before });
  }

  /**
   * Toucher une marque : la fenêtre de son module si elle en prête une (une
   * tâche, 06/10/2026), sinon son résumé (`MarkDialog`).
   */
  function openMark(sourceId: string, markId: string) {
    const source = sources.find((s) => s.id === sourceId);
    const mark = marks[sourceId]?.find((m) => m.id === markId);
    if (source?.Editor && mark?.link) setLent({ sourceId, link: mark.link });
    else setOpenedMark({ sourceId, markId });
  }

  /** « Tâche » choisi dans la fenêtre d'un nouvel événement : la fenêtre du module reprend le créneau. */
  function switchKind(id: string, values: EditorValues) {
    setEditing(null);
    const { allDay, startDay, endDay, startTime, endTime } = values;
    setLent({ sourceId: id, slot: slotFromValues(values), span: { allDay, startDay, endDay, startTime, endTime } });
  }

  function closeLent(changed: boolean) {
    setLent(null);
    if (changed) setMarksVersion((v) => v + 1);
  }

  async function save(input: EventInput, scope: Scope = 'all') {
    const event = editing?.eventId ? events.find((e) => e.id === editing.eventId) : undefined;
    if (!editing?.eventId) await calendarStore.createEvent(input);
    else if (event && editing.inSeries && editing.occurrenceDay && editing.before) {
      await applyPlan(calendarStore, planEdit(event, exceptions, editing.occurrenceDay, editing.before, input, scope));
    } else await calendarStore.updateEvent(editing.eventId, input);
    setEditing(null);
    await refresh();
  }

  async function remove(scope: Scope = 'all') {
    if (!editing?.eventId) return;
    const event = events.find((e) => e.id === editing.eventId);
    if (event && editing.inSeries && editing.occurrenceDay) {
      await applyPlan(calendarStore, planDelete(event, exceptions, editing.occurrenceDay, scope));
    } else await calendarStore.deleteEvent(editing.eventId);
    setEditing(null);
    await refresh();
  }

  /**
   * Déplacer ou étirer : l'écran bouge tout de suite (FullCalendar), le
   * stockage suit. Pour une série, on demande d'abord laquelle. En cas
   * d'échec ou d'abandon, l'événement revient à sa place (`onMove` rejette).
   */
  function move(eventId: string, occurrenceDay: string, span: EventSpan): Promise<void> {
    const event = events.find((e) => e.id === eventId);
    if (event?.recurrence) {
      return new Promise((resolve, reject) => setPendingMove({ eventId, occurrenceDay, span, resolve, reject }));
    }
    return write(() => calendarStore.updateEvent(eventId, span));
  }

  async function write(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Déplacement impossible.');
      throw err;
    }
  }

  function chooseMove(scope: Scope) {
    const pending = pendingMove;
    if (!pending) return;
    setPendingMove(null);
    const event = events.find((e) => e.id === pending.eventId);
    const occurrence = occurrences.find((o) => o.eventId === pending.eventId && o.occurrenceDay === pending.occurrenceDay);
    if (!event || !occurrence) return pending.reject(new Error('Événement introuvable.'));
    const before = valuesOf(occurrence);
    write(() =>
      applyPlan(
        calendarStore,
        planEdit(event, exceptions, pending.occurrenceDay, before, { ...before, ...pending.span, recurrence: event.recurrence }, scope),
      ),
    ).then(pending.resolve, pending.reject);
  }

  return (
    <div className="layout">
      <main className="main calendrier-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button
              className="btn btn-primary btn-sm calendrier-new"
              onClick={() => openNew(defaultSpan())}
              title="Nouvel événement"
              aria-label="Nouvel événement"
            >
              <span aria-hidden="true">+</span>
              <span className="calendrier-topbar-label">Nouvel événement</span>
            </button>
            <button className="btn btn-ghost btn-sm calendrier-topbar-btn" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span aria-hidden="true">⚙</span>
              <span className="calendrier-topbar-label">Réglages</span>
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

        {sources.length > 0 && (
          <div className="calendrier-layers" role="group" aria-label="Calques">
            <span className="calendrier-layers-label">Calques</span>
            {sources.map((source) => {
              const on = isVisible(source.id, source.defaultVisible);
              const failed = failedLayers.has(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  className={`calendrier-layer-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  title={failed ? `${source.label} : chargement impossible` : on ? `Masquer ${source.label}` : `Afficher ${source.label}`}
                  onClick={() => toggleLayer(source.id, !on)}
                  style={{ '--calendrier-layer-color': source.color } as React.CSSProperties}
                >
                  <span className="calendrier-layer-dot" aria-hidden="true" />
                  {source.label}
                  {failed && on && <span aria-hidden="true"> ⚠</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="calendrier-view">
          <Suspense fallback={<p className="calendrier-loading">Chargement du calendrier…</p>}>
            <CalendarView
              items={items}
              initialView={initialView(narrow)}
              narrow={narrow}
              onRangeChange={(from, to, view) => {
                setRange((r) => (r.from === from && r.to === to ? r : { from, to }));
                try {
                  localStorage.setItem(VIEW_KEY, view);
                } catch {
                  // Sans stockage, la vue n'est simplement pas retenue.
                }
              }}
              onSelect={openNew}
              onOpen={openExisting}
              onToggleMark={(sourceId, markId) => void toggleMark(sourceId, markId)}
              onOpenMark={openMark}
              onMoveMark={moveMark}
              onMove={move}
            />
          </Suspense>
        </div>

        {openedMark &&
          (() => {
            const source = sources.find((src) => src.id === openedMark.sourceId);
            const mark = marks[openedMark.sourceId]?.find((m) => m.id === openedMark.markId);
            if (!source || !mark) return null;
            return (
              <MarkDialog
                source={source}
                mark={mark}
                onClose={() => setOpenedMark(null)}
                onToggle={() => void toggleMark(source.id, mark.id)}
                onOpenInModule={mark.link ? () => onOpenModule(source.id, mark.link) : undefined}
              />
            );
          })()}

        {lent &&
          (() => {
            const source = sources.find((s) => s.id === lent.sourceId);
            if (!source?.Editor) return null;
            const Editor = source.Editor;
            const span = lent.span;
            return (
              <Editor
                key={`${lent.sourceId}:${lent.link ?? 'new'}`}
                link={lent.link}
                slot={lent.slot}
                header={
                  !lent.link && span && kinds.length > 1 ? (
                    <KindSwitch
                      kinds={kinds}
                      current={lent.sourceId}
                      onChange={(id) => {
                        if (id === 'event') {
                          setLent(null);
                          openNew(span, lent.slot?.title);
                        } else setLent({ ...lent, sourceId: id });
                      }}
                    />
                  ) : undefined
                }
                onClose={closeLent}
              />
            );
          })()}

        {pendingMove && (
          <ScopeDialog
            action="move"
            allowThis
            onChoose={chooseMove}
            onCancel={() => {
              pendingMove.reject(new Error('Déplacement abandonné.'));
              setPendingMove(null);
            }}
          />
        )}

        {editing && (
          <EventEditor
            eventId={editing.eventId}
            inSeries={editing.inSeries}
            initial={editing.values}
            defaults={settings}
            local={!user || user.isLocal}
            onCancel={() => setEditing(null)}
            onSave={save}
            onDelete={editing.eventId ? remove : undefined}
            kinds={kinds}
            onSwitchKind={switchKind}
          />
        )}
      </main>
    </div>
  );
}
