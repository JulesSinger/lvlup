import { describe, expect, it } from 'vitest';
import { activityDays, computeStreak, dayString } from './streak';
import { JALON, type Checkin, type Goal } from './types';

/**
 * Le streak est la donnée à laquelle on tient le plus — c'est elle qui donne
 * envie de revenir, et la seule dont la perte accidentelle serait vraiment
 * rageante. Ces tests couvrent les cas qu'on ne peut pas reproduire à la main :
 * les trous, les gels, et les changements d'heure.
 */

let counter = 0;
function checkin(day: string, pp = 10): Checkin {
  counter += 1;
  return {
    id: `c${counter}`,
    goalId: 'g1',
    actionId: `a${counter}`,
    pp,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
    title: null,
  };
}

/** Suite de jours consécutifs se terminant à `end` (inclus). */
function daysUpTo(end: string, count: number): string[] {
  const [y, m, d] = end.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(y, m - 1, d - (count - 1 - i), 12);
    return dayString(date);
  });
}

function goalWithTier(completedAt: string | null): Goal {
  return {
    id: 'g1',
    title: 'Objectif',
    description: '',
    emoji: '🎯',
    position: 0,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    tiers: [
      {
        id: 't1',
        goalId: 'g1',
        title: 'Palier',
        rank: 'bronze',
        position: 0,
        completedAt,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...JALON,
      },
    ],
  };
}

describe('dayString', () => {
  it('formate en jour local, pas en UTC', () => {
    // 23 h heure locale : en UTC on serait déjà le lendemain dans plusieurs
    // fuseaux. Le streak doit suivre la journée de l'utilisateur.
    const soir = new Date(2026, 2, 14, 23, 30);
    expect(dayString(soir)).toBe('2026-03-14');
  });

  it('reste correct au passage à l’heure d’été', () => {
    // Nuit du 28 au 29 mars 2026 en Europe : 2 h → 3 h.
    expect(dayString(new Date(2026, 2, 29, 3, 30))).toBe('2026-03-29');
    expect(dayString(new Date(2026, 2, 28, 23, 59))).toBe('2026-03-28');
  });
});

describe('activityDays', () => {
  it('réunit réalisations et paliers validés, sans doublon et triés', () => {
    const goal = goalWithTier(new Date(2026, 4, 12, 10, 0).toISOString());
    const days = activityDays([goal], [checkin('2026-05-14'), checkin('2026-05-12')]);
    expect(days).toEqual(['2026-05-12', '2026-05-14']);
  });
});

describe('computeStreak', () => {
  it('vaut zéro sans aucune activité', () => {
    const streak = computeStreak([], [], '2026-05-20');
    expect(streak).toMatchObject({ current: 0, best: 0, activeToday: false, atRisk: false });
  });

  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    const days = daysUpTo('2026-05-20', 5);
    const streak = computeStreak([], days.map((d) => checkin(d)), '2026-05-20');
    expect(streak.current).toBe(5);
    expect(streak.activeToday).toBe(true);
    expect(streak.atRisk).toBe(false);
  });

  it('un palier validé entretient le streak au même titre qu’une action', () => {
    const goal = goalWithTier(new Date(2026, 4, 20, 9, 0).toISOString());
    const streak = computeStreak([goal], [checkin('2026-05-19')], '2026-05-20');
    expect(streak.current).toBe(2);
    expect(streak.activeToday).toBe(true);
  });

  it('met le streak « à risque » tant que la journée n’est pas finie', () => {
    const days = daysUpTo('2026-05-19', 3);
    const streak = computeStreak([], days.map((d) => checkin(d)), '2026-05-20');
    // Rien fait aujourd'hui : le streak n'est pas cassé, il est en sursis.
    expect(streak.current).toBe(3);
    expect(streak.activeToday).toBe(false);
    expect(streak.atRisk).toBe(true);
  });

  it('gagne un gel tous les sept jours, plafonné à trois', () => {
    expect(computeStreak([], daysUpTo('2026-05-20', 6).map((d) => checkin(d)), '2026-05-20').freezes)
      .toBe(0);
    expect(computeStreak([], daysUpTo('2026-05-20', 7).map((d) => checkin(d)), '2026-05-20').freezes)
      .toBe(1);
    expect(computeStreak([], daysUpTo('2026-05-20', 21).map((d) => checkin(d)), '2026-05-20').freezes)
      .toBe(3);
    expect(computeStreak([], daysUpTo('2026-05-20', 70).map((d) => checkin(d)), '2026-05-20').freezes)
      .toBe(3);
  });

  it('un gel absorbe un jour manqué sans casser la série', () => {
    // Sept jours d'affilée (1 gel gagné), un jour sauté, puis on reprend.
    const first = daysUpTo('2026-05-17', 7); // 11 → 17 mai
    const after = ['2026-05-19', '2026-05-20']; // 18 mai manqué
    const streak = computeStreak([], [...first, ...after].map((d) => checkin(d)), '2026-05-20');
    expect(streak.current).toBe(9);
    expect(streak.freezes).toBe(0); // le gel a été consommé
  });

  /**
   * Le compteur de gels était juste partout SAUF dans la fenêtre où on le
   * regarde : celle où on a déjà manqué un ou deux jours et où l'on se demande
   * si l'on peut se permettre d'en sauter un de plus. Il annonçait alors la
   * réserve d'avant, sans en retrancher les jours déjà à couvrir.
   */
  it('n’annonce jamais un gel déjà engagé par un jour manqué', () => {
    const quatorze = daysUpTo('2026-05-14', 14); // 2 gels gagnés
    const avant = computeStreak([], quatorze.map((d) => checkin(d)), '2026-05-14');
    expect(avant.freezes).toBe(2);

    // Le 16 : le 15 est définitivement manqué (un gel lui est promis), le 16
    // est encore ouvert. Il reste donc UN gel libre, pas deux.
    const le16 = computeStreak([], quatorze.map((d) => checkin(d)), '2026-05-16');
    expect(le16.current).toBe(14);
    expect(le16.atRisk).toBe(true);
    expect(le16.freezes).toBe(1);

    // Et le chiffre annoncé se vérifie : cocher le 16 consomme bien le gel du
    // 15, et il en reste exactement un.
    const coche16 = computeStreak(
      [],
      [...quatorze, '2026-05-16'].map((d) => checkin(d)),
      '2026-05-16',
    );
    expect(coche16.current).toBe(15);
    expect(coche16.freezes).toBe(1);

    // Le 17 sans rien avoir fait : les deux jours pleins sont manqués, la
    // réserve annoncée tombe à zéro — la série ne tient plus qu'à aujourd'hui.
    const le17 = computeStreak([], quatorze.map((d) => checkin(d)), '2026-05-17');
    expect(le17.atRisk).toBe(true);
    expect(le17.freezes).toBe(0);
  });

  it('la réserve de gels ne survit pas à la rupture de la série', () => {
    // Trois semaines pleines (3 gels), dix jours d'absence, puis on revient.
    const avant = daysUpTo('2026-05-21', 21);
    const reprise = computeStreak(
      [],
      [...avant, '2026-06-01'].map((d) => checkin(d)),
      '2026-06-01',
    );
    expect(reprise.current).toBe(1);
    expect(reprise.best).toBe(21); // le record, lui, reste acquis
    // Sans quoi les trois premiers trous de la nouvelle habitude seraient
    // absorbés en silence, par une réserve gagnée par une série qui n'existe
    // plus.
    expect(reprise.freezes).toBe(0);
  });

  it('et elle ne survit pas non plus tant qu’on n’est pas revenu', () => {
    const streak = computeStreak([], daysUpTo('2026-05-21', 21).map((d) => checkin(d)), '2026-06-01');
    expect(streak.current).toBe(0);
    expect(streak.freezes).toBe(0);
  });

  it('un trou plus grand que la réserve de gels remet la série à zéro', () => {
    const first = daysUpTo('2026-05-10', 7); // 1 gel
    const after = ['2026-05-18', '2026-05-19', '2026-05-20']; // 7 jours manqués
    const streak = computeStreak([], [...first, ...after].map((d) => checkin(d)), '2026-05-20');
    expect(streak.current).toBe(3);
    // Le meilleur streak, lui, reste acquis : rien ne se perd jamais.
    expect(streak.best).toBe(7);
  });

  it('après une absence trop longue, plus rien n’est sauvable aujourd’hui', () => {
    const days = daysUpTo('2026-05-01', 3);
    const streak = computeStreak([], days.map((d) => checkin(d)), '2026-05-20');
    expect(streak.current).toBe(0);
    expect(streak.atRisk).toBe(false);
    expect(streak.best).toBe(3);
  });

  it('ignore une activité datée dans le futur', () => {
    const streak = computeStreak([], [checkin('2026-05-25')], '2026-05-20');
    expect(streak.current).toBe(0);
  });

  it('ne compte qu’une fois plusieurs actions du même jour', () => {
    const same = [checkin('2026-05-20'), checkin('2026-05-20'), checkin('2026-05-20')];
    expect(computeStreak([], same, '2026-05-20').current).toBe(1);
  });

  it('franchit un changement d’heure sans perdre un jour', () => {
    // 26 mars → 1er avril 2026 : le passage à l'heure d'été tombe au milieu.
    const days = ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'];
    const streak = computeStreak([], days.map((d) => checkin(d)), '2026-03-30');
    expect(streak.current).toBe(5);
  });

  it('franchit un changement de mois et une année bissextile', () => {
    const days = ['2026-02-27', '2026-02-28', '2026-03-01'];
    expect(computeStreak([], days.map((d) => checkin(d)), '2026-03-01').current).toBe(3);
    const bissextile = ['2028-02-28', '2028-02-29', '2028-03-01'];
    expect(computeStreak([], bissextile.map((d) => checkin(d)), '2028-03-01').current).toBe(3);
  });
});
