import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { dayString, shiftDay } from '../../../core/lib/day';
import { spanFromRange, spanFromSelection, type CalendarItem, type EventSpan } from '../lib/calendarBridge';

export const VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'] as const;
export type ViewName = (typeof VIEWS)[number];

interface Props {
  items: CalendarItem[];
  initialView: ViewName;
  narrow: boolean;
  /** La période affichée a changé (jours inclus), ou la vue. */
  onRangeChange: (from: string, to: string, view: ViewName) => void;
  /** Un créneau choisi : toucher ou glisser dans la grille. */
  onSelect: (span: EventSpan) => void;
  onOpen: (eventId: string, occurrenceDay: string) => void;
  /** Toucher une marque cochable d'un autre module (une tâche de Polaris). */
  onToggleMark: (sourceId: string, markId: string) => void;
  /** Un événement déplacé ou étiré. Rejette en cas d'échec ou d'abandon : il revient alors à sa place. */
  onMove: (eventId: string, occurrenceDay: string, span: EventSpan) => Promise<void>;
}

/**
 * Les quatre vues d'Éclipse, dessinées par FullCalendar (MIT, décision du
 * 27/09/2026, étude §12) : mois, semaine, jour, agenda. Ce composant est le
 * seul à importer FullCalendar ; il est chargé à la demande
 * (`React.lazy` dans `CalendarScreen`), si bien que le reste d'Atlas n'en
 * porte jamais le poids.
 *
 * FullCalendar ne reçoit que des occurrences déjà dépliées
 * (`lib/recurrence.ts`) : la récurrence reste à nous. Les dates sont
 * locales, sans fuseau (`timeZone: 'local'`) : une heure affichée est une
 * heure lue, sans conversion.
 */
export default function CalendarView({ items, initialView, narrow, onRangeChange, onSelect, onOpen, onToggleMark, onMove }: Props) {
  const scrollHour = Math.max(0, new Date().getHours() - 1);
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      locale={frLocale}
      timeZone="local"
      initialView={initialView}
      headerToolbar={
        narrow
          ? { left: 'prev,next', center: 'title', right: 'today' }
          : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }
      }
      footerToolbar={narrow ? { center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' } : undefined}
      views={{ listWeek: { buttonText: 'Agenda' } }}
      allDayText="Journée"
      noEventsText="Rien de prévu cette semaine."
      firstDay={1}
      height="100%"
      nowIndicator
      scrollTime={`${String(scrollHour).padStart(2, '0')}:00:00`}
      dayMaxEvents
      selectable
      selectMirror
      editable
      // Au doigt : un appui un peu long pour sélectionner ou déplacer, pour ne
      // pas confondre avec le simple défilement de la grille.
      longPressDelay={350}
      events={items}
      // Les événements d'Éclipse avant les calques des autres modules.
      eventOrder="order,start,-duration,allDay,title"
      eventDidMount={(arg) => {
        const { layer, detail, checkable } = arg.event.extendedProps as { layer?: string; detail?: string; checkable?: boolean };
        if (layer) arg.el.title = `${layer} — ${detail ?? arg.event.title}${checkable ? ' · toucher pour cocher' : ''}`;
      }}
      datesSet={(arg) =>
        onRangeChange(dayString(arg.start), shiftDay(dayString(arg.end), -1), arg.view.type as ViewName)
      }
      select={(arg) => {
        onSelect(spanFromSelection(arg.start, arg.end, arg.allDay));
        arg.view.calendar.unselect();
      }}
      eventClick={(arg) => {
        arg.jsEvent.preventDefault();
        // Une marque d'un autre module n'a rien à ouvrir ici : son détail est au
        // survol. Si elle se coche (une tâche), le toucher la coche.
        const { layer, checkable, sourceId, markId } = arg.event.extendedProps;
        if (layer) {
          if (checkable) onToggleMark(sourceId as string, markId as string);
          return;
        }
        onOpen(arg.event.extendedProps.eventId as string, arg.event.extendedProps.occurrenceDay as string);
      }}
      eventDrop={(arg) => {
        if (!arg.event.start) return arg.revert();
        onMove(
          arg.event.extendedProps.eventId as string,
          arg.event.extendedProps.occurrenceDay as string,
          spanFromRange(arg.event.start, arg.event.end, arg.event.allDay),
        ).catch(() => arg.revert());
      }}
      eventResize={(arg) => {
        if (!arg.event.start) return arg.revert();
        onMove(
          arg.event.extendedProps.eventId as string,
          arg.event.extendedProps.occurrenceDay as string,
          spanFromRange(arg.event.start, arg.event.end, arg.event.allDay),
        ).catch(() => arg.revert());
      }}
    />
  );
}
