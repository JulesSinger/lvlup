import { describe, expect, it } from 'vitest';
import {
  freezeFill,
  freezeOffer,
  goalProgress,
  history,
  ppForRank,
  ppTimeline,
  profilePP,
  profileRank,
  sumCheckinPP,
  todayPP,
  weekStats,
  weeklyGoalAmount,
  weeklyPP,
} from './progress';
import { getRank } from './ranks';
import { dayString } from './streak';
import type { RankId } from './ranks';
import { JALON, type Action, type Checkin, type Goal, type Tier } from './types';

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
    title: null,
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

describe('acheter un gel avec les PP de la semaine', () => {
  const jour = (n: number) => {
    const d = new Date(2026, 4, 20 - n, 12); // 20 mai 2026 = un mercredi
    return dayString(d);
  };

  it('le solde est celui de la semaine, pas du cumul à vie', () => {
    // Deux réalisations cette semaine, une la semaine dernière : seules les
    // deux premières comptent.
    const list = [checkin(jour(0), 100), checkin(jour(1), 100), checkin(jour(9), 500)];
    const offre = freezeOffer([], list, [], 0, 3, 200, jour(0));
    expect(offre.balance).toBe(200);
    expect(offre.affordable).toBe(true);
  });

  it('un achat déjà fait cette semaine ampute le solde', () => {
    const list = [checkin(jour(0), 250)];
    const offre = freezeOffer([], list, [{ day: jour(0), cost: 200 }], 1, 3, 200, jour(0));
    expect(offre.balance).toBe(50);
    expect(offre.affordable).toBe(false);
  });

  it('un achat de la semaine dernière ne compte plus', () => {
    const list = [checkin(jour(0), 250)];
    const offre = freezeOffer([], list, [{ day: jour(9), cost: 200 }], 1, 3, 200, jour(0));
    expect(offre.balance).toBe(250);
  });

  it('réserve pleine : rien à vendre, même riche', () => {
    const list = [checkin(jour(0), 1000)];
    const offre = freezeOffer([], list, [], 3, 3, 200, jour(0));
    expect(offre.full).toBe(true);
    expect(offre.affordable).toBe(false);
  });

  it('le solde ne descend jamais sous zéro', () => {
    const offre = freezeOffer([], [], [{ day: jour(0), cost: 200 }], 0, 3, 200, jour(0));
    expect(offre.balance).toBe(0);
  });
});

describe('les PP semaine par semaine', () => {
  const lundi = '2026-05-18'; // un lundi

  it('regroupe les jours dans leur semaine', () => {
    const list = [
      checkin('2026-05-18', 10),
      checkin('2026-05-20', 15),
      checkin('2026-05-24', 5), // dimanche : même semaine
    ];
    const semaines = weeklyPP([], list, '2026-05-24');
    expect(semaines).toHaveLength(1);
    expect(semaines[0]).toMatchObject({ monday: lundi, pp: 30 });
  });

  it('le lundi suivant ouvre une nouvelle barre', () => {
    const list = [checkin('2026-05-24', 10), checkin('2026-05-25', 40)];
    const semaines = weeklyPP([], list, '2026-05-25');
    expect(semaines.map((s) => s.pp)).toEqual([10, 40]);
  });

  /**
   * Le point de tout le changement : une pause doit se voir. Sauter les
   * semaines vides tasserait six semaines d'arrêt en un simple trait — c'est
   * exactement ce qu'une courbe de cumul faisait déjà.
   */
  it('les semaines sans rien restent dans le graphe, à zéro', () => {
    const list = [checkin('2026-05-18', 10), checkin('2026-06-08', 20)];
    const semaines = weeklyPP([], list, '2026-06-08');
    expect(semaines.map((s) => s.pp)).toEqual([10, 0, 0, 20]);
  });

  it('s’arrête à la semaine en cours', () => {
    const list = [checkin('2026-05-18', 10)];
    expect(weeklyPP([], list, '2026-05-20')).toHaveLength(1);
  });

  it('rien du tout ne donne aucune barre', () => {
    expect(weeklyPP([], [], '2026-05-20')).toEqual([]);
  });
});

describe('weeklyGoalAmount', () => {
  const lundi = '2026-05-18'; // un lundi

  function amountCheckin(day: string, patch: Partial<Checkin> = {}): Checkin {
    counter += 1;
    return {
      id: `ca${counter}`,
      goalId: 'g1',
      actionId: null,
      pp: 10,
      day,
      note: '',
      createdAt: `${day}T08:00:00.000Z`,
      value: null,
      title: null,
      ...patch,
    };
  }

  function action(patch: Partial<Action>): Action {
    counter += 1;
    return {
      id: patch.id ?? `a${counter}`,
      goalId: 'g1',
      title: 'Action',
      pp: 15,
      position: 0,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      unit: '',
      defaultValue: null,
      isMeasure: false,
      ...patch,
    };
  }

  /** Un palier réellement comptable — `tier()` seul renvoie un jalon (JALON). */
  function compté(kind: 'cumul' | 'performance' | 'compte' | 'serie' | 'mesure', unit = 'km'): Tier {
    return { ...tier('or', null), kind, unit, target: 100 };
  }

  /**
   * L'objectif marathon (journal 2026-09-06) : plusieurs actions différentes
   * qui courent toutes des km, plus des gestes ponctuels quantifiés — tout
   * doit se retrouver dans le même cumul.
   */
  it('additionne plusieurs actions de l’objectif dans la même semaine', () => {
    const g = goal([compté('cumul')]);
    const list = [
      amountCheckin(lundi, { actionId: 'a1', value: 8 }),
      amountCheckin('2026-05-20', { actionId: 'a2', value: 5 }),
    ];
    const summary = weeklyGoalAmount(g, list, [], '2026-05-20');
    expect(summary?.total).toBe(13);
    expect(summary?.weeks).toEqual([{ monday: lundi, amount: 13 }]);
  });

  it('inclut les gestes ponctuels quantifiés', () => {
    const g = goal([compté('cumul')]);
    const list = [
      amountCheckin(lundi, { actionId: 'a1', value: 8 }),
      amountCheckin('2026-05-19', { actionId: null, title: 'sortie improvisée', value: 6 }),
    ];
    const summary = weeklyGoalAmount(g, list, [], '2026-05-19');
    expect(summary?.total).toBe(14);
  });

  it('exclut une mesure (ex. la VMA) du cumul', () => {
    const g = goal([compté('cumul')]);
    const vma = action({ id: 'a1', unit: 'km/h', isMeasure: true });
    const list = [amountCheckin(lundi, { actionId: 'a1', value: 15 })];
    expect(weeklyGoalAmount(g, list, [vma], lundi)?.total).toBeUndefined();
  });

  it('remplit les semaines sans rien à zéro, comme weeklyPP', () => {
    const g = goal([compté('cumul')]);
    const list = [
      amountCheckin('2026-05-18', { value: 10 }),
      amountCheckin('2026-06-08', { value: 20 }),
    ];
    const summary = weeklyGoalAmount(g, list, [], '2026-06-08');
    expect(summary?.weeks.map((w) => w.amount)).toEqual([10, 0, 0, 20]);
    expect(summary?.total).toBe(30);
  });

  it('vaut null sans aucune réalisation à sommer', () => {
    const g = goal([compté('cumul')]);
    expect(weeklyGoalAmount(g, [], [], '2026-05-20')).toBeNull();
  });

  it('ignore les réalisations d’un autre objectif', () => {
    const g = goal([compté('cumul')]);
    const list = [amountCheckin(lundi, { goalId: 'g2', value: 8 })];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')).toBeNull();
  });

  it('vaut null sans aucun palier comptable (échelle à cocher)', () => {
    const g = goal([tier('or', null)]); // jalon
    const list = [amountCheckin(lundi, { actionId: 'a1', value: 8 })];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')).toBeNull();
  });

  it('vaut null pour une mesure : sommer des relevés n’a pas de sens', () => {
    const g = goal([compté('mesure', 'kg')]);
    const list = [amountCheckin(lundi, { actionId: 'a1', value: 80 })];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')).toBeNull();
  });

  /**
   * Rapporté par Jules : « Apprendre l'anglais », un palier en jours
   * (`compte`) avec une action « Duolingo » cochée sans quantité — sommer
   * `contribution` (toujours 0, aucune action de ce genre n'est quantifiée)
   * affichait un total et des semaines à zéro. Il faut compter des **jours**,
   * pas sommer une valeur qui n'existe pas.
   */
  it('compte des jours distincts pour un palier « compte », pas une somme', () => {
    const g = goal([compté('compte', 'jours')]);
    const duolingo = action({ id: 'a1', unit: '', defaultValue: null, isMeasure: false });
    const list = [
      amountCheckin(lundi, { actionId: 'a1' }),
      amountCheckin('2026-05-20', { actionId: 'a1' }),
    ];
    const summary = weeklyGoalAmount(g, list, [duolingo], '2026-05-20');
    expect(summary?.total).toBe(2);
    expect(summary?.weeks).toEqual([{ monday: lundi, amount: 2 }]);
  });

  it('un même jour, coché deux fois, ne compte qu’une fois', () => {
    const g = goal([compté('compte', 'jours')]);
    const list = [
      amountCheckin(lundi, { actionId: 'a1' }),
      amountCheckin(lundi, { actionId: 'a2' }),
    ];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')?.total).toBe(1);
  });

  it('une série compte aussi des jours, pas une somme', () => {
    const g = goal([compté('serie', 'jours')]);
    const list = [amountCheckin(lundi, { actionId: 'a1' }), amountCheckin('2026-05-20', { actionId: 'a1' })];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')?.total).toBe(2);
  });

  it('un geste ponctuel compte aussi comme un jour, pour compte/série', () => {
    const g = goal([compté('compte', 'jours')]);
    const list = [amountCheckin(lundi, { actionId: null, title: 'un pas de côté' })];
    expect(weeklyGoalAmount(g, list, [], '2026-05-20')?.total).toBe(1);
  });
});

describe('freezeFill', () => {
  // La jauge est ce qui enseigne le lien PP → gel à quelqu'un qui n'a jamais
  // eu de quoi payer. Elle doit donc être juste surtout dans le bas.
  it('vaut la part du prix déjà couverte', () => {
    expect(freezeFill({ balance: 0, cost: 200 })).toBe(0);
    expect(freezeFill({ balance: 50, cost: 200 })).toBe(25);
    expect(freezeFill({ balance: 199, cost: 200 })).toBe(100);
    expect(freezeFill({ balance: 200, cost: 200 })).toBe(100);
  });

  it('ne déborde pas au-delà de 100 %', () => {
    // Un solde de trois gels ne remplit pas la jauge trois fois.
    expect(freezeFill({ balance: 600, cost: 200 })).toBe(100);
  });

  it('ne descend pas sous zéro', () => {
    // `freezeOffer` borne déjà le solde, mais une jauge à -30 % casserait le
    // rendu sans rien signaler : on tient l'invariant des deux côtés.
    expect(freezeFill({ balance: -50, cost: 200 })).toBe(0);
  });

  it('reste défini si le prix tombe à zéro', () => {
    expect(freezeFill({ balance: 0, cost: 0 })).toBe(100);
  });
});
