import { describe, expect, it } from 'vitest';
import { goalHeatmap, goalState, goalStreak, missedYesterday, mondayOf } from './heatmap';
import { JALON } from './types';
import type { Checkin, Goal, Tier } from './types';

/**
 * La grille est de la restitution pure — mais une restitution qui ment est
 * pire que pas de restitution du tout. Ces tests gardent trois promesses :
 * rien avant la création de l'objectif, une case vide n'est jamais un
 * reproche, et la règle des deux jours ne se déclenche qu'une fois.
 */

const TODAY = '2026-08-08'; // un samedi

function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Arrêter de me ronger les ongles',
    description: '',
    emoji: '💅',
    position: 0,
    archived: false,
    createdAt: '2026-01-01T09:00:00.000Z',
    tiers: [],
    ...patch,
  };
}

function tier(patch: Partial<Tier> = {}): Tier {
  return {
    id: 't1',
    goalId: 'g1',
    title: '7 jours réussis',
    rank: 'bronze',
    position: 0,
    completedAt: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    ...JALON,
    ...patch,
  };
}

let n = 0;
function checkin(day: string, patch: Partial<Checkin> = {}): Checkin {
  n += 1;
  return {
    id: `c${n}`,
    goalId: 'g1',
    actionId: 'a1',
    pp: 10,
    day,
    note: '',
    createdAt: `${day}T20:00:00.000Z`,
    value: null,
    ...patch,
  };
}

const cell = (map: ReturnType<typeof goalHeatmap>, day: string) =>
  map.cells.find((c) => c.day === day);

describe('géométrie de la grille', () => {
  it('couvre exactement le nombre de semaines demandé', () => {
    const map = goalHeatmap(goal(), [checkin('2026-08-01')], { weeks: 12, today: TODAY });
    expect(map.columns).toBe(12);
    expect(map.cells).toHaveLength(12 * 7);
  });

  it('commence un lundi et finit la semaine d’aujourd’hui', () => {
    const map = goalHeatmap(goal(), [checkin('2026-08-01')], { weeks: 4, today: TODAY });
    expect(mondayOf(TODAY)).toBe('2026-08-03');
    expect(map.cells[0].day).toBe('2026-07-13'); // lundi, 3 semaines avant
    expect(map.cells.some((c) => c.day === TODAY)).toBe(true);
  });

  it('n’étiquette un mois que sur la colonne où il commence vraiment', () => {
    // Sans la garde, « août » atterrissait au-dessus de la dernière semaine
    // de juillet.
    const map = goalHeatmap(goal(), [checkin('2026-08-01')], { weeks: 12, today: TODAY });
    for (const m of map.months) {
      const first = map.cells[m.column * 7].day;
      expect(Number(first.slice(8, 10)), first).toBeLessThanOrEqual(7);
    }
  });
});

describe('ce qui n’est pas dessiné', () => {
  it('rien avant la création de l’objectif', () => {
    // Une grille vide affichée dès le premier jour transforme un outil
    // d'encouragement en bilan d'échec.
    const g = goal({ createdAt: '2026-08-03T09:00:00.000Z' });
    const map = goalHeatmap(g, [checkin('2026-08-04')], { weeks: 12, today: TODAY });
    expect(cell(map, '2026-08-02')?.inRange).toBe(false);
    expect(cell(map, '2026-08-03')?.inRange).toBe(true);
  });

  it('rien après aujourd’hui', () => {
    const map = goalHeatmap(goal(), [checkin('2026-08-04')], { weeks: 12, today: TODAY });
    expect(cell(map, '2026-08-09')?.inRange).toBe(false);
  });

  it('un jour sans rien reste à zéro, sans marque particulière', () => {
    const map = goalHeatmap(goal(), [checkin('2026-08-04')], { weeks: 12, today: TODAY });
    expect(cell(map, '2026-08-05')?.level).toBe(0);
  });
});

describe('intensité', () => {
  it('une habitude binaire donne une couleur pleine et uniforme', () => {
    // Un seul geste possible par jour : tous les jours actifs se valent, et
    // les nuancer serait inventer une différence qui n'existe pas.
    const list = ['2026-08-03', '2026-08-04', '2026-08-05'].map((d) => checkin(d));
    const map = goalHeatmap(goal(), list, { weeks: 12, today: TODAY });
    expect(list.map((c) => cell(map, c.day)?.level)).toEqual([3, 3, 3]);
  });

  it('les jours chargés se distinguent des jours légers', () => {
    const list = [
      checkin('2026-08-03', { pp: 5 }),
      checkin('2026-08-04', { pp: 20 }),
      checkin('2026-08-05', { pp: 40 }),
    ];
    const map = goalHeatmap(goal(), list, { weeks: 12, today: TODAY });
    expect(cell(map, '2026-08-03')?.level).toBe(1);
    expect(cell(map, '2026-08-04')?.level).toBe(2);
    expect(cell(map, '2026-08-05')?.level).toBe(3);
  });

  it('cumule les actions d’une même journée', () => {
    const list = [checkin('2026-08-04'), checkin('2026-08-04', { actionId: 'a2', pp: 5 })];
    const map = goalHeatmap(goal(), list, { weeks: 12, today: TODAY });
    expect(cell(map, '2026-08-04')?.count).toBe(2);
    expect(cell(map, '2026-08-04')?.pp).toBe(15);
  });

  it('ignore les réalisations d’un autre objectif', () => {
    const map = goalHeatmap(goal(), [checkin('2026-08-04', { goalId: 'g2' })], { today: TODAY });
    expect(map.active).toBe(0);
  });
});

describe('filtrer sur une action', () => {
  // Répond à une autre question que la grille entière : non plus « est-ce que
  // je m'y suis mis » mais « laquelle de mes trois actions je ne fais jamais ».
  const list = [
    checkin('2026-08-03', { actionId: 'a1', pp: 20 }),
    checkin('2026-08-04', { actionId: 'a2', pp: 5 }),
    checkin('2026-08-05', { actionId: 'a1', pp: 20 }),
    checkin('2026-08-05', { actionId: 'a2', pp: 5 }),
  ];

  it('ne garde que les jours de l’action visée', () => {
    const map = goalHeatmap(goal(), list, { today: TODAY, actionId: 'a1' });
    expect(map.active).toBe(2);
    expect(cell(map, '2026-08-04')?.level).toBe(0);
  });

  it('ne compte plus que ses propres PP', () => {
    // Sans filtre, le 5 août cumule les deux actions.
    expect(goalHeatmap(goal(), list, { today: TODAY }).cells.find((c) => c.day === '2026-08-05')?.pp)
      .toBe(25);
    expect(cell(goalHeatmap(goal(), list, { today: TODAY, actionId: 'a2' }), '2026-08-05')?.pp)
      .toBe(5);
  });

  it('une action jamais faite donne une grille vide — et c’est l’information', () => {
    expect(goalHeatmap(goal(), list, { today: TODAY, actionId: 'a9' }).active).toBe(0);
  });

  it('sans filtre, tout compte', () => {
    expect(goalHeatmap(goal(), list, { today: TODAY }).active).toBe(3);
  });

  it('la règle des deux jours suit le filtre', () => {
    const recent = [
      checkin('2026-08-06', { actionId: 'a1' }),
      checkin('2026-08-07', { actionId: 'a2' }),
    ];
    // Sans filtre, hier (le 7) est fait : rien à signaler.
    expect(missedYesterday(goal(), recent, TODAY)).toBeNull();
    // Filtré sur a1, hier est vide et avant-hier ne l'était pas.
    expect(missedYesterday(goal(), recent, TODAY, 'a1')).toBe('2026-08-07');
  });
});

describe('la règle des deux jours', () => {
  const week = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30'].map((d) => checkin(d));

  it('signale hier quand il est vide et qu’aujourd’hui l’est aussi', () => {
    expect(missedYesterday(goal(), week, TODAY)).toBe('2026-08-07');
  });

  it('ne dit rien si aujourd’hui est déjà fait — le danger est écarté', () => {
    expect(missedYesterday(goal(), [...week, checkin(TODAY)], TODAY)).toBeNull();
  });

  it('ne dit rien si hier est fait', () => {
    expect(missedYesterday(goal(), [...week, checkin('2026-08-07')], TODAY)).toBeNull();
  });

  it('ne réclame pas pour une habitude abandonnée depuis des mois', () => {
    expect(missedYesterday(goal(), [checkin('2026-03-01')], TODAY)).toBeNull();
  });

  it('ne réclame pas le lendemain de la création', () => {
    // Aucun historique : il n'y a pas encore d'habitude à protéger.
    expect(missedYesterday(goal(), [], TODAY)).toBeNull();
  });

  it('se tait sur un objectif archivé', () => {
    expect(missedYesterday(goal({ archived: true }), week, TODAY)).toBeNull();
  });

  it('la grille porte le repère sur la bonne case', () => {
    const map = goalHeatmap(goal(), week, { weeks: 12, today: TODAY });
    expect(map.warnDay).toBe('2026-08-07');
  });
});

describe('streak d’un objectif', () => {
  // La flamme du profil compte les jours où on a fait *quelque chose*, tous
  // objectifs confondus. Celle-ci ne parle que de cet objectif — « je tiens
  // depuis douze jours sur celle-là » est ce qu'on veut savoir d'une habitude.
  const run = (days: string[]) => days.map((d) => checkin(d));

  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    expect(goalStreak(goal(), run(['2026-08-06', '2026-08-07', '2026-08-08']), TODAY)).toBe(3);
  });

  it('rien fait aujourd’hui ne casse rien tant que la journée n’est pas finie', () => {
    // Même tolérance que le streak global : sinon le compteur retombe à zéro
    // à 8 h du matin, tous les matins.
    expect(goalStreak(goal(), run(['2026-08-06', '2026-08-07']), TODAY)).toBe(2);
  });

  it('deux jours vides de suite le cassent', () => {
    expect(goalStreak(goal(), run(['2026-08-05', '2026-08-06']), TODAY)).toBe(0);
  });

  it('un trou au milieu arrête le compte à ce trou', () => {
    // Pas de gels ici : un gel protège le streak du profil, celui qu'on
    // perdrait vraiment. En distribuer un par objectif les viderait de sens.
    expect(goalStreak(goal(), run(['2026-08-04', '2026-08-06', '2026-08-07']), TODAY)).toBe(2);
  });

  it('ignore les autres objectifs', () => {
    const list = [checkin('2026-08-07'), checkin('2026-08-08', { goalId: 'g2' })];
    expect(goalStreak(goal(), list, TODAY)).toBe(1);
  });

  it('suit le filtre par action', () => {
    const list = [
      checkin('2026-08-06', { actionId: 'a1' }),
      checkin('2026-08-07', { actionId: 'a1' }),
      checkin('2026-08-08', { actionId: 'a2' }),
    ];
    expect(goalStreak(goal(), list, TODAY)).toBe(3);
    expect(goalStreak(goal(), list, TODAY, 'a1')).toBe(2);
    expect(goalStreak(goal(), list, TODAY, 'a2')).toBe(1);
  });

  it('vaut zéro sans aucune réalisation', () => {
    expect(goalStreak(goal(), [], TODAY)).toBe(0);
  });
});

describe('entretien', () => {
  const done = tier({ completedAt: '2026-06-01T10:00:00.000Z' });

  it('un objectif dont il reste des paliers est en cours', () => {
    const g = goal({ tiers: [done, tier({ id: 't2' })] });
    expect(goalState(g, [checkin('2026-08-07')], TODAY)).toBe('en-cours');
  });

  it('tous les paliers validés mais on coche encore : entretien', () => {
    // On ne finit pas une habitude. « Accompli » la sortirait de l'écran
    // alors qu'on la fait tous les jours.
    const g = goal({ tiers: [done] });
    expect(goalState(g, [checkin('2026-08-07')], TODAY)).toBe('entretien');
  });

  it('tous les paliers validés et plus rien depuis un mois : accompli', () => {
    const g = goal({ tiers: [done] });
    expect(goalState(g, [checkin('2026-06-01')], TODAY)).toBe('accompli');
  });

  it('un objectif sans palier n’est jamais « accompli » par accident', () => {
    expect(goalState(goal({ tiers: [] }), [], TODAY)).toBe('en-cours');
  });
});
