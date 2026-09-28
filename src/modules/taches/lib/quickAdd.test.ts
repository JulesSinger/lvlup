import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd';

// Lundi 28 septembre 2026 : le jour de référence de toute la batterie.
const today = '2026-09-28';
const parse = (text: string, lists: { id: string; name: string }[] = []) => parseQuickAdd(text, today, lists);
const pick = (text: string) => {
  const r = parse(text);
  return [r.title, r.plannedDay, r.plannedTime, r.dueDay];
};

describe('parseQuickAdd — les jours', () => {
  it('aujourd’hui, ce soir, demain, après-demain (et pas demain !)', () => {
    expect(pick('Rendre le livre aujourd’hui')).toEqual(['Rendre le livre', today, null, null]);
    expect(pick('Dîner ce soir')).toEqual(['Dîner', today, null, null]);
    expect(pick('Appeler le garage demain')).toEqual(['Appeler le garage', '2026-09-29', null, null]);
    expect(pick('Cartons après-demain')).toEqual(['Cartons', '2026-09-30', null, null]);
    expect(pick('Cartons apres demain')).toEqual(['Cartons', '2026-09-30', null, null]);
  });

  it('un jour de la semaine : le prochain, aujourd’hui exclu', () => {
    expect(pick('Sport mercredi')[1]).toBe('2026-09-30');
    expect(pick('Sport lundi')[1]).toBe('2026-10-05'); // on est lundi : c'est le suivant
    expect(pick('Sport dimanche')[1]).toBe('2026-10-04');
    expect(pick('Dentiste mardi prochain')).toEqual(['Dentiste', '2026-09-29', null, null]);
    expect(pick('Bilan la semaine prochaine')).toEqual(['Bilan', '2026-10-05', null, null]);
  });

  it('dans N jours, semaines, mois — en chiffres ou en lettres', () => {
    expect(pick('Arroser dans 3 jours')).toEqual(['Arroser', '2026-10-01', null, null]);
    expect(pick('Vacances dans deux semaines')[1]).toBe('2026-10-12');
    expect(pick('Contrôle dans 1 mois')[1]).toBe('2026-10-28');
  });

  it('une date : le 5, le 15 mars, 1er octobre, 3/10, 03/10/2027', () => {
    expect(pick('Payer le loyer le 5')).toEqual(['Payer le loyer', '2026-10-05', null, null]);
    expect(pick('Relevé le 30')[1]).toBe('2026-09-30');
    expect(pick('Anniversaire de Léa le 15 mars')).toEqual(['Anniversaire de Léa', '2027-03-15', null, null]);
    expect(pick('Soldes 1er octobre')[1]).toBe('2026-10-01');
    expect(pick('le 3/10 médecin')).toEqual(['médecin', '2026-10-03', null, null]);
    expect(pick('Visite 03/10/2027')[1]).toBe('2027-10-03');
    expect(pick('Relancer 3 déc.')[1]).toBe('2026-12-03');
  });

  it('une date qui n’existe pas n’est pas une date', () => {
    expect(pick('Fête le 31 avril')).toEqual(['Fête le 31 avril', null, null, null]);
  });
});

describe('parseQuickAdd — les heures', () => {
  it('9h, 9 h 30, à 18h30, 18:30 ; une heure seule vaut pour aujourd’hui', () => {
    expect(pick('Appeler le garage demain 9h')).toEqual(['Appeler le garage', '2026-09-29', '09:00', null]);
    expect(pick('Relancer vendredi à 10h')).toEqual(['Relancer', '2026-10-02', '10:00', null]);
    expect(pick('Réunion à 18h30')).toEqual(['Réunion', today, '18:30', null]);
    expect(pick('Point 9 h 30 jeudi')).toEqual(['Point', '2026-10-01', '09:30', null]);
    expect(pick('Train 07:45')).toEqual(['Train', today, '07:45', null]);
  });

  it('pas une heure impossible', () => {
    expect(pick('Semaine 25h')[2]).toBeNull();
  });
});

describe('parseQuickAdd — l’échéance', () => {
  it('avant, pour, d’ici, au plus tard : une échéance, pas un jour prévu', () => {
    expect(pick('Impôts avant le 30')).toEqual(['Impôts', null, null, '2026-09-30']);
    expect(pick('Dossier pour vendredi')).toEqual(['Dossier', null, null, '2026-10-02']);
    expect(pick('Rapport d’ici le 15 octobre')).toEqual(['Rapport', null, null, '2026-10-15']);
    expect(pick('Impôts samedi avant le 30 mai')).toEqual(['Impôts', '2026-10-03', null, '2027-05-30']);
  });
});

describe('parseQuickAdd — priorité et liste', () => {
  it('« ! » importante, « !! » urgente, seuls', () => {
    expect(parse('Passeport !').priority).toBe('importante');
    expect(parse('Passeport !!').priority).toBe('urgente');
    expect(parse('Passeport').priority).toBe('normale');
    expect(parse('Super !génial').priority).toBe('normale');
  });

  it('« #maison » range dans la liste, par son nom sans accents ni espaces, ou son début', () => {
    const lists = [
      { id: 'm', name: 'Maison' },
      { id: 'a', name: 'Papiers administratifs' },
    ];
    expect(parse('Ampoule #maison', lists)).toMatchObject({ title: 'Ampoule', listId: 'm' });
    expect(parse('Carte grise #papiers', lists)).toMatchObject({ title: 'Carte grise', listId: 'a' });
    expect(parse('Idée #inconnue', lists)).toMatchObject({ title: 'Idée #inconnue', listId: null });
  });
});

describe('parseQuickAdd — ce qui a été compris, et l’annuler', () => {
  it('rend les morceaux reconnus, dans l’ordre, tels que tapés', () => {
    const r = parse('Appeler le Garage Demain 9h !');
    expect(r.title).toBe('Appeler le Garage');
    expect(r.tokens.map((t) => [t.kind, t.text])).toEqual([
      ['day', 'Demain'],
      ['time', '9h'],
      ['priority', '!'],
    ]);
  });

  it('un morceau annulé retourne dans le titre', () => {
    const r = parseQuickAdd('Réunion de lundi', today, [], new Set(['day']));
    expect([r.title, r.plannedDay, r.tokens]).toEqual(['Réunion de lundi', null, []]);
  });

  it('une seule date prévue : la seconde reste dans le titre', () => {
    expect(pick('Choisir entre lundi et mardi')).toEqual(['Choisir entre et mardi', '2026-10-05', null, null]);
  });

  it('un texte sans rien de reconnu est un titre, tel quel', () => {
    expect(parse('  Acheter du pain ')).toMatchObject({ title: 'Acheter du pain', plannedDay: null, plannedTime: null, dueDay: null, priority: 'normale', listId: null, tokens: [] });
    expect(pick('Acheter 5 pommes')).toEqual(['Acheter 5 pommes', null, null, null]);
  });
});

describe('parseQuickAdd — les anniversaires, tous les ans', () => {
  // On est le lundi 28 septembre 2026.
  const bday = (text: string) => {
    const r = parse(text);
    return [r.title, r.plannedDay, r.recurrence];
  };
  const yearly = { freq: 'yearly', interval: 1 };

  it('« anniversaire Léa 15 03 » : le prochain 15 mars, tous les ans, le mot reste dans le titre', () => {
    expect(bday('anniversaire Léa 15 03')).toEqual(['anniversaire Léa', '2027-03-15', yearly]);
  });

  it('toutes les façons d’écrire la date', () => {
    for (const text of ['Anniversaire Léa 15/03', 'Anniversaire Léa 15.03', 'Anniversaire Léa 15-03', 'Anniversaire Léa le 15 mars', 'Anniversaire Léa 15 mars', 'Anniversaire de Léa le 15/03']) {
      expect(parse(text)).toMatchObject({ plannedDay: '2027-03-15', recurrence: yearly });
    }
  });

  it('« anniv », et une date encore à venir cette année', () => {
    expect(bday('anniv Paul 3 octobre')).toEqual(['anniv Paul', '2026-10-03', yearly]);
    expect(bday('Anniversaire maman 28/09')).toEqual(['Anniversaire maman', '2026-09-28', yearly]);
  });

  it('une année de naissance est ignorée : c’est le prochain anniversaire qui compte', () => {
    expect(bday('Anniversaire Léa 15/03/1990')).toEqual(['Anniversaire Léa', '2027-03-15', yearly]);
    expect(bday('Anniversaire Léa 15 03 1990')).toEqual(['Anniversaire Léa', '2027-03-15', yearly]);
  });

  it('avec une heure, une priorité, une liste', () => {
    const r = parse('Anniversaire Léa 15 mars 9h ! #famille', [{ id: 'f', name: 'Famille' }]);
    expect(r).toMatchObject({ title: 'Anniversaire Léa', plannedDay: '2027-03-15', plannedTime: '09:00', priority: 'importante', listId: 'f', recurrence: yearly });
  });

  it('la pastille de répétition s’annule : une seule fois, alors', () => {
    const r = parseQuickAdd('Anniversaire Léa 15 03', today, [], new Set(['repeat']));
    expect([r.plannedDay, r.recurrence]).toEqual(['2027-03-15', null]);
  });

  it('sans date, « anniversaire » n’est qu’un mot ; « 15 03 » sans anniversaire n’est pas une date (un téléphone)', () => {
    expect(bday('Idée cadeau anniversaire')).toEqual(['Idée cadeau anniversaire', null, null]);
    expect(pick('Rappeler 01 23 45 67 89')).toEqual(['Rappeler 01 23 45 67 89', null, null, null]);
  });
});

describe('parseQuickAdd — les répétitions', () => {
  const r = (text: string) => {
    const x = parse(text);
    return [x.title, x.plannedDay, x.plannedTime, x.recurrence];
  };

  it('tous les jours, tous les N jours', () => {
    expect(r('Médicament tous les jours 8h')).toEqual(['Médicament', today, '08:00', { freq: 'daily', interval: 1 }]);
    expect(r('Arroser les plantes tous les 3 jours')).toEqual(['Arroser les plantes', today, null, { freq: 'daily', interval: 3 }]);
    expect(r('Vitamines chaque jour')[3]).toEqual({ freq: 'daily', interval: 1 });
  });

  it('un jour de la semaine : le premier à partir d’aujourd’hui', () => {
    expect(r('Sport tous les lundis 18h')).toEqual(['Sport', today, '18:00', { freq: 'weekly', interval: 1, byWeekday: [1] }]);
    expect(r('Poubelles chaque mercredi')).toEqual(['Poubelles', '2026-09-30', null, { freq: 'weekly', interval: 1, byWeekday: [3] }]);
    expect(r('Piscine les mardis et jeudis')).toEqual(['Piscine', '2026-09-29', null, { freq: 'weekly', interval: 1, byWeekday: [2, 4] }]);
    expect(r('Cours tous les lundis, mercredis et vendredis')[3]).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] });
    expect(r('Ménage un samedi sur deux')).toEqual(['Ménage', '2026-10-03', null, { freq: 'weekly', interval: 2, byWeekday: [6] }]);
  });

  it('toutes les semaines, toutes les N semaines', () => {
    expect(r('Bilan toutes les semaines')).toEqual(['Bilan', today, null, { freq: 'weekly', interval: 1 }]);
    expect(r('Draps toutes les 2 semaines')[3]).toEqual({ freq: 'weekly', interval: 2 });
  });

  it('tous les mois, avec ou sans jour', () => {
    expect(r('Loyer tous les mois le 5')).toEqual(['Loyer', '2026-10-05', null, { freq: 'monthly', interval: 1 }]);
    expect(r('Relevé chaque mois')).toEqual(['Relevé', today, null, { freq: 'monthly', interval: 1 }]);
    expect(r('Coiffeur tous les 2 mois')[3]).toEqual({ freq: 'monthly', interval: 2 });
  });

  it('tous les ans, chaque année', () => {
    expect(r('Assurance tous les ans le 1er décembre')).toEqual(['Assurance', '2026-12-01', null, { freq: 'yearly', interval: 1 }]);
    expect(r('Bilan de santé chaque année')[3]).toEqual({ freq: 'yearly', interval: 1 });
  });

  it('« le lundi » seul reste un jour, pas une répétition', () => {
    expect(r('Réunion le lundi')).toEqual(['Réunion', '2026-10-05', null, null]);
  });

  it('ce qui a été compris se montre, pastille « repeat » comprise', () => {
    expect(parse('Sport tous les lundis 18h').tokens.map((t) => [t.kind, t.text])).toEqual([
      ['repeat', 'tous les lundis'],
      ['time', '18h'],
    ]);
  });
});

describe('parseQuickAdd — la durée', () => {
  const d = (text: string) => {
    const x = parse(text);
    return [x.title, x.plannedTime, x.durationMinutes];
  };

  it('un intervalle : l’heure et la durée', () => {
    expect(d('Réunion 15h-16h30')).toEqual(['Réunion', '15:00', 90]);
    expect(d('Réunion de 15h à 16h')).toEqual(['Réunion', '15:00', 60]);
    expect(d('Dentiste entre 9h et 9h45')).toEqual(['Dentiste', '09:00', 45]);
    expect(d('Train 07:45 – 09:10')).toEqual(['Train', '07:45', 85]);
    expect(d('Soirée 22h-1h')).toEqual(['Soirée', '22:00', 180]);
  });

  it('« pendant » : une durée, avec l’heure dite ailleurs', () => {
    expect(d('Sport 18h pendant 1h30')).toEqual(['Sport', '18:00', 90]);
    expect(d('Lecture 21h pendant 45 min')).toEqual(['Lecture', '21:00', 45]);
    expect(d('Ménage samedi 10h pendant 2 heures')).toEqual(['Ménage', '10:00', 120]);
    expect(d('Sieste 14h pendant une demi-heure')).toEqual(['Sieste', '14:00', 30]);
  });

  it('une durée sans heure reste dans le titre ; une heure seule n’a pas de durée', () => {
    expect(d('Lire pendant 1h')).toEqual(['Lire pendant 1h', null, null]);
    expect(d('Appeler 15h')).toEqual(['Appeler', '15:00', null]);
  });

  it('la pastille dit l’intervalle', () => {
    expect(parse('Réunion demain 15h-16h30').tokens.map((t) => [t.kind, t.text])).toEqual([
      ['day', 'demain'],
      ['time', '15h-16h30'],
    ]);
  });
});
