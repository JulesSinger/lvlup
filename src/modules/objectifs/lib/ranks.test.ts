import { describe, expect, it } from 'vitest';
import { RANKS, getRank, rankByValue, suggestRanks } from './ranks';

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
