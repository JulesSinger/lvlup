import { describe, expect, it } from 'vitest';
import {
  goalProgress,
  history,
  ppForRank,
  ppTimeline,
  profilePP,
  profileRank,
  sumCheckinPP,
  todayPP,
  weekStats,
} from './progress';
import { getRank } from './ranks';
import type { RankId } from './ranks';
import { JALON, type Checkin, type Goal, type Tier } from './types';

/**
 * Ces fonctions décident du rang affiché et des points gagnés. Deux règles
 * tiennent tout l'édifice et méritent d'être verrouillées :
 *   · valider un palier ne peut JAMAIS faire baisser le rang d'un objectif ;
 *   · un objectif archivé ne compte plus, ni dans le rang ni dans les PP.
 */

let counter = 0;

function tier(rank: RankId, completedAt: string | null, position = 0): Tier {
  counter += 1;
  return {
    id: `t${counter}`,
    goalId: 'g1',
    title: `Palier ${counter}`,
    rank,
    position,
    completedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...JALON,
  };
}

function goal(tiers: Tier[], archived = false, id = 'g1'): Goal {
  return {
    id,
    title: 'Objectif',
    description: '',
    emoji: '🎯',
    position: 0,
    archived,
    createdAt: '2026-01-01T00:00:00.000Z',
    tiers: tiers.map((t) => ({ ...t, goalId: id })),
  };
}

function checkin(day: string, pp = 10, goalId = 'g1'): Checkin {
  counter += 1;
  return {
    id: `c${counter}`,
    goalId,
    actionId: `a${counter}`,
    pp,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
  };
}

/** ISO d'un jour local à midi — évite les surprises de fuseau dans les tests. */
function at(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12).toISOString();
}

describe('goalProgress', () => {
  it('compte les paliers validés et désigne le suivant', () => {
    const g = goal([
      tier('bronze', at(2026, 5, 1), 0),
      tier('argent', at(2026, 5, 4), 1),
      tier('or', null, 2),
    ]);
    const progress = goalProgress(g);
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(3);
    expect(progress.percent).toBe(67);
    expect(progress.next?.rank).toBe('or');
    expect(progress.complete).toBe(false);
  });

  it('affiche le rang le plus haut validé, pas le dernier en date', () => {
    // On valide Or, puis Bronze : le rang affiché doit rester Or.
    const g = goal([
      tier('or', at(2026, 5, 1), 0),
      tier('bronze', at(2026, 5, 8), 1),
    ]);
    expect(goalProgress(g).rank?.id).toBe('or');
  });

  it('n’a pas de rang tant qu’aucun palier n’est validé', () => {
    expect(goalProgress(goal([tier('bronze', null)])).rank).toBeNull();
  });

  it('un objectif sans palier n’est jamais « terminé »', () => {
    const progress = goalProgress(goal([]));
    expect(progress.complete).toBe(false);
    expect(progress.percent).toBe(0);
  });

  it('trie par position, quel que soit l’ordre du tableau', () => {
    const g = goal([tier('or', null, 2), tier('bronze', null, 0), tier('argent', null, 1)]);
    expect(goalProgress(g).next?.rank).toBe('bronze');
  });
});

describe('profileRank', () => {
  it('fait la moyenne des rangs des objectifs actifs', () => {
    const a = goal([tier('or', at(2026, 5, 1))], false, 'g1'); // valeur 4
    const b = goal([tier('emeraude', at(2026, 5, 1))], false, 'g2'); // valeur 6
    const { rank, average } = profileRank([a, b]);
    expect(average).toBe(5);
    expect(rank?.id).toBe('platine');
  });

  it('un objectif commencé sans palier validé tire la moyenne vers le bas', () => {
    // C'est voulu : sinon, créer des objectifs sans les travailler gonflerait
    // le rang de profil.
    const a = goal([tier('emeraude', at(2026, 5, 1))], false, 'g1'); // 6
    const b = goal([tier('or', null)], false, 'g2'); // 0
    expect(profileRank([a, b]).average).toBe(3);
  });

  it('ignore les objectifs archivés et ceux sans palier', () => {
    const actif = goal([tier('or', at(2026, 5, 1))], false, 'g1');
    const archive = goal([tier('fer', null)], true, 'g2');
    const vide = goal([], false, 'g3');
    const { rank, rankedGoals } = profileRank([actif, archive, vide]);
    expect(rankedGoals).toBe(1);
    expect(rank?.id).toBe('or');
  });

  it('n’attribue aucun rang tant que la moyenne est sous 1', () => {
    expect(profileRank([goal([tier('or', null)])]).rank).toBeNull();
    expect(profileRank([]).rank).toBeNull();
  });

  it('mesure le chemin restant vers le rang suivant', () => {
    const a = goal([tier('or', at(2026, 5, 1))], false, 'g1'); // 4
    const b = goal([tier('platine', at(2026, 5, 1))], false, 'g2'); // 5
    const { average, toNext } = profileRank([a, b]);
    expect(average).toBe(4.5);
    expect(toNext).toBeCloseTo(0.5);
  });
});

describe('points', () => {
  it('barème : 25 PP par échelon, de Fer à Challenger', () => {
    expect(ppForRank(getRank('fer'))).toBe(25);
    expect(ppForRank(getRank('or'))).toBe(100);
    expect(ppForRank(getRank('challenger'))).toBe(250);
  });

  it('les check-ins d’avant les actions valent toujours leurs 10 PP', () => {
    const ancien = { ...checkin('2026-05-01'), pp: undefined } as unknown as Checkin;
    expect(sumCheckinPP([ancien])).toBe(10);
  });

  it('le total du profil additionne paliers et réalisations', () => {
    const g = goal([tier('or', at(2026, 5, 1)), tier('platine', null)]);
    expect(profilePP([g], [checkin('2026-05-01', 15)])).toBe(115);
  });

  it('un objectif archivé ne compte plus dans les PP', () => {
    const g = goal([tier('or', at(2026, 5, 1))], true);
    expect(profilePP([g], [])).toBe(0);
  });
});

describe('todayPP', () => {
  it('additionne les réalisations du jour et les paliers validés le jour même', () => {
    const g = goal([tier('bronze', at(2026, 5, 20))]); // 50 PP
    const checkins = [checkin('2026-05-20', 15), checkin('2026-05-19', 30)];
    expect(todayPP([g], checkins, '2026-05-20')).toBe(65);
  });

  it('ignore un palier validé hier', () => {
    const g = goal([tier('bronze', at(2026, 5, 19))]);
    expect(todayPP([g], [], '2026-05-20')).toBe(0);
  });
});

describe('weekStats', () => {
  it('couvre bien du lundi au dimanche', () => {
    // 18 mai 2026 est un lundi, 24 mai le dimanche.
    const checkins = [
      checkin('2026-05-17', 10), // dimanche précédent : exclu
      checkin('2026-05-18', 10),
      checkin('2026-05-24', 10),
      checkin('2026-05-25', 10), // lundi suivant : exclu
    ];
    const stats = weekStats([], checkins, 0, '2026-05-20');
    expect(stats.checkins).toBe(2);
    expect(stats.pp).toBe(20);
  });

  it('sait remonter à la semaine précédente', () => {
    const stats = weekStats([], [checkin('2026-05-13', 10)], -1, '2026-05-20');
    expect(stats.checkins).toBe(1);
  });

  it('compte les paliers validés dans la semaine', () => {
    const g = goal([tier('or', at(2026, 5, 20))]);
    const stats = weekStats([g], [], 0, '2026-05-20');
    expect(stats.tiersValidated).toBe(1);
    expect(stats.pp).toBe(100);
  });
});

describe('ppTimeline', () => {
  it('cumule jour par jour, du plus ancien au plus récent', () => {
    const g = goal([tier('bronze', at(2026, 5, 3))]); // 50 PP le 3
    const points = ppTimeline([g], [checkin('2026-05-01', 10), checkin('2026-05-03', 20)]);
    expect(points.map((p) => p.day)).toEqual(['2026-05-01', '2026-05-03']);
    expect(points.map((p) => p.total)).toEqual([10, 80]);
    expect(points[1].tiers).toBe(1);
  });

  it('ne crée pas de point pour les jours sans activité', () => {
    expect(ppTimeline([], [checkin('2026-05-01'), checkin('2026-05-09')])).toHaveLength(2);
  });
});

describe('history', () => {
  it('liste les paliers validés du plus récent au plus ancien', () => {
    const g = goal([
      tier('bronze', at(2026, 5, 1), 0),
      tier('argent', at(2026, 5, 9), 1),
      tier('or', null, 2),
    ]);
    const entries = history([g]);
    expect(entries).toHaveLength(2);
    expect(entries[0].tier.rank).toBe('argent');
  });
});
