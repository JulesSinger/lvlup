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
