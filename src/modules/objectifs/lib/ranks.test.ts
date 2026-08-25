import { describe, expect, it } from 'vitest';
import {
  RANKS,
  getRank,
  insertableAt,
  ladderInsert,
  ladderMove,
  movableTier,
  rankByValue,
  suggestRanks,
} from './ranks';
import type { LadderRung } from './ranks';

/**
 * L'échelle de rangs est le cœur symbolique de l'app : c'est elle qui décide
 * de ce qu'on ressent en validant un palier. Une régression ici ne planterait
 * rien — elle rendrait juste la progression incohérente, ce qui est pire.
 */

describe('échelle', () => {
  it('compte dix rangs, du Fer au Challenger, sans trou de valeur', () => {
    expect(RANKS).toHaveLength(10);
    expect(RANKS[0].id).toBe('fer');
    expect(RANKS[RANKS.length - 1].id).toBe('challenger');
    RANKS.forEach((rank, index) => expect(rank.value).toBe(index + 1));
  });

  it('retrouve un rang par son identifiant et par sa valeur', () => {
    expect(getRank('or').value).toBe(4);
    expect(rankByValue(4).id).toBe('or');
  });

  it('borne la recherche par valeur au lieu de renvoyer undefined', () => {
    expect(rankByValue(0).id).toBe('fer');
    expect(rankByValue(99).id).toBe('challenger');
  });
});

describe('répartition automatique des rangs', () => {
  // Ces trois cas viennent d'un retour utilisateur : la répartition linéaire
  // donnait Bronze/Émeraude/Challenger pour trois étapes, ce qui n'avait
  // aucun sens pour qui connaît l'échelle.
  it('donne Bronze, Argent, Or pour trois étapes', () => {
    expect(suggestRanks(3)).toEqual(['bronze', 'argent', 'or']);
  });

  it('ajoute Challenger en sommet dès quatre étapes', () => {
    expect(suggestRanks(4)).toEqual(['bronze', 'argent', 'or', 'challenger']);
  });

  it('place un seul palier en Or — ni tout en haut, ni tout en bas', () => {
    expect(suggestRanks(1)).toEqual(['or']);
  });

  it('ne renvoie rien pour zéro étape', () => {
    expect(suggestRanks(0)).toEqual([]);
    expect(suggestRanks(-3)).toEqual([]);
  });

  it('reste strictement croissant quel que soit le nombre d’étapes', () => {
    for (let count = 1; count <= 30; count++) {
      const values = suggestRanks(count).map((id) => getRank(id).value);
      expect(values).toHaveLength(count);
      for (let i = 1; i < values.length; i++) {
        // Au-delà de dix étapes, plusieurs partagent forcément un rang :
        // on exige que ça ne redescende jamais.
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    }
  });

  it('atteint Challenger dès que l’échelle le permet', () => {
    for (let count = 4; count <= 20; count++) {
      const last = suggestRanks(count).at(-1);
      expect(last).toBe('challenger');
    }
  });

  it('démarre en bas de l’échelle sur les longues séries', () => {
    expect(suggestRanks(10)[0]).toBe('fer');
    expect(suggestRanks(15)[0]).toBe('fer');
  });
});


/**
 * Le bug que ces tests empêchent de revenir : `reorderTiers` ne réécrivait que
 * les positions. Ajouter « Courir 15 km » à la fin puis le remonter d'un cran
 * donnait « bronze, argent, challenger, or » — une échelle qui redescend, et
 * un palier facile décoré du rang le plus prestigieux. C'est pourtant le seul
 * chemin que l'interface offre pour insérer une étape au milieu.
 */
describe('déplacer un palier dans l’échelle', () => {
  const echelle = (...ranks: string[]): LadderRung[] =>
    ranks.map((rank, i) => ({ id: `t${i}`, rank: rank as LadderRung['rank'], completedAt: null }));

  it('le palier déplacé prend le rang de sa nouvelle place', () => {
    const tiers = echelle('bronze', 'argent', 'or', 'challenger');
    const move = ladderMove(tiers, 't3', -1)!;
    expect(move.orderedIds).toEqual(['t0', 't1', 't3', 't2']);
    // t3 monte à la 3e place et y prend « or » ; t2 descend et prend challenger.
    expect(move.rankChanges).toEqual([
      { id: 't3', rank: 'or' },
      { id: 't2', rank: 'challenger' },
    ]);
  });

  it('la suite des rangs reste identique après le déplacement', () => {
    // La propriété qui compte vraiment : l'échelle ne bouge pas, seuls les
    // contenus changent de barreau.
    const tiers = echelle('bronze', 'argent', 'or', 'challenger');
    const move = ladderMove(tiers, 't3', -1)!;
    const apres = move.orderedIds.map((id) => {
      const change = move.rankChanges.find((c) => c.id === id);
      return change ? change.rank : tiers.find((t) => t.id === id)!.rank;
    });
    expect(apres).toEqual(['bronze', 'argent', 'or', 'challenger']);
  });

  it('deux barreaux de même rang n’ont rien à réécrire', () => {
    const tiers = echelle('or', 'or');
    expect(ladderMove(tiers, 't1', -1)!.rankChanges).toEqual([]);
  });

  it('refuse de sortir de l’échelle', () => {
    const tiers = echelle('bronze', 'argent');
    expect(ladderMove(tiers, 't0', -1)).toBeNull();
    expect(ladderMove(tiers, 't1', 1)).toBeNull();
  });

  it('refuse d’échanger avec un palier validé — son rang est un trophée daté', () => {
    const tiers = echelle('bronze', 'argent', 'or');
    tiers[0].completedAt = '2026-05-01T10:00:00.000Z';
    expect(ladderMove(tiers, 't1', -1)).toBeNull();
    expect(movableTier(tiers, 1, -1)).toBe(false);
    // Mais le reste de l'échelle bouge encore.
    expect(movableTier(tiers, 1, 1)).toBe(true);
    expect(ladderMove(tiers, 't1', 1)).not.toBeNull();
  });

  it('un palier validé ne se déplace pas non plus lui-même', () => {
    const tiers = echelle('bronze', 'argent');
    tiers[1].completedAt = '2026-05-01T10:00:00.000Z';
    expect(movableTier(tiers, 1, -1)).toBe(false);
  });
});

describe('insérer un palier au milieu de l’échelle', () => {
  const echelle = (...ranks: string[]): LadderRung[] =>
    ranks.map((rank, i) => ({ id: `t${i}`, rank: rank as LadderRung['rank'], completedAt: null }));

  it('le nouveau venu prend le rang de la place qu’il occupe', () => {
    // Le cas de Jules : glisser « Courir 15 km » entre 10 km et 21 km.
    const plan = ladderInsert(echelle('bronze', 'argent', 'or'), 2)!;
    expect(plan.rank).toBe('or');
    // …et le palier qu'il pousse monte d'un barreau.
    expect(plan.shifts).toEqual([{ id: 't2', rank: 'challenger' }]);
  });

  it('la suite des rangs de l’échelle est préservée, allongée d’un barreau', () => {
    const tiers = echelle('bronze', 'argent', 'or');
    const plan = ladderInsert(tiers, 1)!;
    const apres = ['nouveau', ...tiers.map((t) => t.id)];
    apres.splice(0, 1);
    const ordre = [tiers[0].id, 'nouveau', tiers[1].id, tiers[2].id];
    const rangs = ordre.map((id) => {
      if (id === 'nouveau') return plan.rank;
      const shift = plan.shifts.find((s) => s.id === id);
      return shift ? shift.rank : tiers.find((t) => t.id === id)!.rank;
    });
    expect(rangs).toEqual(['bronze', 'argent', 'or', 'challenger']);
  });

  it('insérer à la fin revient à ajouter', () => {
    const plan = ladderInsert(echelle('bronze', 'argent', 'or'), 3)!;
    expect(plan.rank).toBe('challenger');
    expect(plan.shifts).toEqual([]);
  });

  it('refuse d’insérer au-dessus d’un palier validé', () => {
    // Son rang est un trophée daté : le décaler le réécrirait.
    const tiers = echelle('bronze', 'argent', 'or');
    tiers[2].completedAt = '2026-05-01T10:00:00.000Z';
    expect(ladderInsert(tiers, 1)).toBeNull();
    expect(insertableAt(tiers, 1)).toBe(false);
    // Mais on peut toujours ajouter par-dessus, personne ne bouge.
    expect(insertableAt(tiers, 3)).toBe(true);
  });

  it('refuse une place qui n’existe pas', () => {
    expect(ladderInsert(echelle('bronze'), -1)).toBeNull();
    expect(ladderInsert(echelle('bronze'), 2)).toBeNull();
  });
});

describe('l’échelle ne descend jamais, quoi qu’on insère', () => {
  const echelle = (...ranks: string[]): LadderRung[] =>
    ranks.map((rank, i) => ({ id: `t${i}`, rank: rank as LadderRung['rank'], completedAt: null }));

  /** La suite des rangs telle qu'elle sera après l'insertion. */
  const apresInsertion = (tiers: LadderRung[], index: number) => {
    const plan = ladderInsert(tiers, index)!;
    const ordre = [...tiers.slice(0, index), { id: '·', rank: plan.rank, completedAt: null }, ...tiers.slice(index)];
    return ordre.map((t) => {
      const shift = plan.shifts.find((sh) => sh.id === t.id);
      return getRank((shift ? shift.rank : t.rank) as LadderRung['rank']).value;
    });
  };

  const croissante = (v: number[]) => v.every((n, i) => i === 0 || n >= v[i - 1]);

  it('sur une échelle standard, à toutes les places', () => {
    const tiers = echelle('bronze', 'argent', 'or', 'diamant', 'challenger');
    for (let i = 0; i <= tiers.length; i++) {
      const suite = apresInsertion(tiers, i);
      expect(croissante(suite), `insertion en ${i} → ${suite.join(' ')}`).toBe(true);
    }
  });

  it('sur une échelle retouchée à la main, à toutes les places', () => {
    // Ici la convention ne s'applique pas : les rangs choisis à la main sont
    // conservés, et le nouveau barreau se pose au-dessus du sommet.
    const tiers = echelle('or', 'maitre');
    for (let i = 0; i <= tiers.length; i++) {
      const suite = apresInsertion(tiers, i);
      expect(croissante(suite), `insertion en ${i} → ${suite.join(' ')}`).toBe(true);
    }
  });

  it('une échelle retouchée n’est pas réécrite par la convention', () => {
    // Le garde-fou : `suggestRanks` ne doit pas écraser un choix explicite.
    const tiers = echelle('or', 'maitre');
    const plan = ladderInsert(tiers, 2)!;
    expect(plan.shifts).toEqual([]); // personne ne bouge
    expect(getRank(plan.rank).value).toBeGreaterThan(getRank('maitre').value);
  });
});
