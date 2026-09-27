import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import type { ViewName } from './components/CalendarView';
import { EventEditor, type EditorValues } from './components/EventEditor';
import { calendarStore } from './data';
import { defaultSpan, toCalendarItem, type EventSpan } from './lib/calendarBridge';
import { dayString, shiftDay } from './lib/day';
import { expandEvents } from './lib/recurrence';
import type { CalendarEvent, EventException, EventInput } from './lib/types';

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

type Editing = { eventId: string | null; values: EditorValues };

/**
 * Écran racine d'Éclipse — le calendrier, étape 3 (docs/etude-calendrier.md
 * §12) : la V1. Quatre vues (mois, semaine, jour, agenda), créer un
 * événement en touchant ou en glissant sur un créneau, le déplacer ou
 * l'étirer, le modifier ou le supprimer.
 *
 * Les occurrences ne sont jamais stockées : elles sont dépliées ici, pour la
 * seule période affichée, à partir des séries et de leurs exceptions.
 * Créer une répétition et modifier une seule occurrence arrivent à l'étape 4.
 */
export function CalendarScreen({ error, onError, onOpenSettings, onBackToHub, reloadToken }: ModuleScreenProps) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < NARROW;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [exceptions, setExceptions] = useState<EventException[]>([]);
  const [range, setRange] = useState(() => {
    const today = dayString();
    return { from: shiftDay(today, -7), to: shiftDay(today, 7) };
  });
  const [editing, setEditing] = useState<Editing | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextEvents, nextExceptions] = await Promise.all([calendarStore.listEvents(), calendarStore.listExceptions()]);
      setEvents(nextEvents);
      setExceptions(nextExceptions);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken).
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  const items = useMemo(
    () => expandEvents(events, exceptions, range.from, range.to).map(toCalendarItem),
    [events, exceptions, range],
  );

  function openNew(span: EventSpan) {
    setEditing({ eventId: null, values: { ...span, title: '', color: 'bleu', location: '', note: '', recurrence: null } });
  }

  function openExisting(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const { id: _id, timezone: _tz, createdAt: _created, ...values } = event;
    setEditing({ eventId, values });
  }

  async function save(input: EventInput) {
    if (editing?.eventId) await calendarStore.updateEvent(editing.eventId, input);
    else await calendarStore.createEvent(input);
    setEditing(null);
    await refresh();
  }

  async function remove() {
    if (!editing?.eventId) return;
    await calendarStore.deleteEvent(editing.eventId);
    setEditing(null);
    await refresh();
  }

  /**
   * Déplacer ou étirer : l'écran bouge tout de suite (FullCalendar), le
   * stockage suit. En cas d'échec, l'erreur s'affiche et l'événement
   * revient à sa place (`onMove` rejette).
   */
  async function move(eventId: string, span: EventSpan) {
    try {
      await calendarStore.updateEvent(eventId, span);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Déplacement impossible.');
      throw err;
    }
  }

  return (
    <div className="layout">
      <main className="main calendrier-main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">🌒</span>
            <span className="brand-name">Éclipse</span>
          </div>
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
            <button className="btn btn-ghost btn-sm calendrier-topbar-btn" onClick={onBackToHub} title="Modules" aria-label="Modules">
              <span aria-hidden="true">←</span>
              <span className="calendrier-topbar-label">Modules</span>
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
              onMove={move}
            />
          </Suspense>
        </div>

        {editing && (
          <EventEditor
            eventId={editing.eventId}
            initial={editing.values}
            onCancel={() => setEditing(null)}
            onSave={save}
            onDelete={editing.eventId ? remove : undefined}
          />
        )}
      </main>
    </div>
  );
}
