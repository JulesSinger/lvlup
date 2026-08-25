import { describe, expect, it } from 'vitest';
import { RANKS, getRank, ladderMove, movableTier, rankByValue, suggestRanks } from './ranks';
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
