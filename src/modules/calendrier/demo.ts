import { mondayOf, shiftDay } from '../../core/lib/day';
import type { ModuleDemo } from '../../core/lib/module';
import { calendarStore as store } from './data';

/**
 * La démo de Calendar (15/10/2026) : une semaine habitée — un café, une
 * réunion de travail, une séance de sport répétée, un anniversaire, un
 * week-end sur plusieurs jours. Créée par le contrat du module, à part.
 */
export const calendrierDemo: ModuleDemo = {
  async seed(today) {
    const monday = mondayOf(today);
    const timed = (title: string, day: string, startTime: string, endTime: string, color: 'bleu' | 'vert' | 'orange' | 'rose' | 'violet', extra = {}) =>
      store.createEvent({ title, allDay: false, startDay: day, endDay: day, startTime, endTime, color, ...extra });
    await timed('Café avec Léa', today, '09:00', '10:00', 'vert', { location: 'Café du marché' });
    await timed('Réunion projet', today, '14:00', '15:30', 'bleu', { work: true, note: 'Ordre du jour : planning, budget.' });
    await timed('Sport', monday, '18:30', '19:30', 'orange', { recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 4] } });
    await timed('Dentiste', shiftDay(today, 2), '11:00', '11:30', 'violet');
    await store.createEvent({ title: 'Anniversaire de Maman', allDay: true, startDay: shiftDay(today, 1), endDay: shiftDay(today, 1), startTime: null, endTime: null, color: 'rose' });
    await store.createEvent({ title: 'Week-end à Annecy', allDay: true, startDay: shiftDay(monday, 5), endDay: shiftDay(monday, 6), startTime: null, endTime: null, color: 'vert' });
  },
  tour: [
    {
      target: '.fc-view-harness',
      title: 'Ta semaine',
      body: 'Touche un créneau pour créer un événement, glisse pour choisir sa durée. Un événement se déplace et s’étire au doigt ou à la souris.',
    },
    {
      target: '.fc-event',
      title: 'Ouvrir un événement',
      body: 'Titre, horaires ou journée entière, lieu, note, couleur, rappels, répétition — et « 💼 Travail », pour le mode travail.',
    },
    {
      target: '[aria-label="Nouvel événement"]',
      title: 'Nouvel événement',
      body: 'Ici aussi : la fenêtre s’ouvre sur l’heure qui vient. Elle peut aussi créer une tâche, avec la bascule « Événement / Tâche ».',
    },
    {
      target: '.fc-toolbar-chunk:has(.fc-timeGridWeek-button), .fc-footer-toolbar',
      title: 'Mois, semaine, jour, agenda',
      body: 'Quatre façons de regarder le temps ; Calendar retient la dernière choisie.',
    },
    {
      target: '[aria-label="Importer un calendrier"]',
      title: 'Venir d’Apple Calendrier',
      body: 'Un fichier .ics exporté de ton iPhone ou de ton Mac s’importe sans doublon ni effacement.',
    },
    {
      title: 'À toi',
      body: 'Tes tâches, tes courses, ton menu et tes objectifs s’y ajoutent en calques, à cocher en haut. Ici, ce sont des exemples : rien n’est enregistré dans ton compte.',
    },
  ],
};
