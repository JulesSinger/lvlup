import { newId } from '../../core/data/coreStore';
import { shiftDay } from '../../core/lib/day';
import type { ModuleDemo } from '../../core/lib/module';
import { tachesStore as store } from './data';

/**
 * La démo de Tâches (15/10/2026) : une boîte « À faire » vivante, deux listes
 * (une favorite, une de travail), une tâche répétée, des sous-tâches, un retard.
 * Créée par le contrat du module, dans le stockage à part de la démo.
 */
export const tachesDemo: ModuleDemo = {
  async seed(today) {
    const maison = await store.createList({ name: 'Maison', color: 'vert' });
    await store.updateList(maison.id, { favorite: true });
    const travail = await store.createList({ name: 'Travail', color: 'bleu' });
    await store.updateList(travail.id, { work: true });
    const add = (input: Parameters<typeof store.createTask>[0]) => store.createTask(input, newId());
    await add({ title: 'Rappeler le plombier', plannedDay: today, plannedTime: '09:00', priority: 'urgente', position: 0 });
    await add({ title: 'Prendre rendez-vous chez le dentiste', dueDay: shiftDay(today, 3), position: 1 });
    await add({ title: 'Idée de cadeau pour Léa', note: 'Un livre de cuisine ?', position: 2 });
    await add({ title: 'Renvoyer le colis', plannedDay: shiftDay(today, -1), position: 3 });
    await add({ title: 'Arroser les plantes', listId: maison.id, plannedDay: today, recurrence: { freq: 'daily', interval: 3 }, repeatFrom: 'completion', position: 0 });
    await add({ title: 'Changer l’ampoule du salon', listId: maison.id, position: 1 });
    const demo = await add({ title: 'Préparer la démo de jeudi', listId: travail.id, plannedDay: today, plannedTime: '14:00', durationMinutes: 60, priority: 'importante', position: 0 });
    await add({ title: 'Relire les slides', listId: travail.id, parentId: demo.id, position: 0 });
    await add({ title: 'Tester sur le téléphone', listId: travail.id, parentId: demo.id, position: 1 });
  },
  tour: [
    {
      target: '.taches-quickadd',
      title: 'Ajouter en une phrase',
      body: 'Écris comme tu parles : « Appeler le garage demain 9h !! #maison ». La date, l’heure, la priorité et la liste sont comprises, et tu peux annuler chaque morceau compris.',
    },
    {
      target: '.taches-row .taches-check',
      title: 'Cocher',
      body: 'Le rond coche la tâche ; « Annuler » revient en bas de l’écran. Une tâche répétée passe d’elle-même à sa prochaine fois.',
    },
    {
      target: '.taches-row .taches-edit',
      title: 'Modifier',
      body: 'Le crayon ouvre la tâche : jour prévu, échéance, priorité, rappels, répétition, sous-tâches.',
    },
    {
      target: '.taches-nav',
      title: 'Tes vues',
      body: 'Aujourd’hui (avec les retards à part), À venir sur deux semaines, À faire pour ce qui n’a pas de liste, et Terminées.',
    },
    {
      target: '.taches-nav-list',
      title: 'Tes listes',
      body: 'Une liste par domaine. ★ Favorite : en tête. 💼 Travail : la seule visible en mode travail. « + Liste » en crée une.',
    },
    {
      title: 'À toi',
      body: 'Ce sont des exemples : coche, ajoute, déplace, rien n’est enregistré dans ton compte. « Quitter la démo » te ramène à tes tâches.',
    },
  ],
};
