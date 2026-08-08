import { describe, expect, it } from 'vitest';
import { tierColumnsFull } from './supabaseStore';
import { JALON } from '../lib/types';

/**
 * Une insertion en lot n'accepte pas des lignes de formes différentes.
 *
 * PostgREST prend l'union des clés de toutes les lignes envoyées et met
 * **null** dans celles qui manquent — la valeur par défaut de la colonne ne
 * s'applique pas. Un objectif mêlant des paliers comptables et des jalons
 * (« Épargner 500 € » puis « 3 mois de dépenses de côté ») envoyait donc
 * `kind` pour les uns et rien pour l'autre, et Postgres refusait le lot :
 *     null value in column "kind" of relation "tiers" violates not-null
 *
 * Le piège est qu'un objectif homogène passait sans rien dire — tout en
 * jalons, aucune ligne ne portait la clé et la colonne gardait son défaut.
 * L'erreur ne se voyait donc que sur certains objectifs, et jamais en
 * développement puisque le mode local n'a pas de base.
 */
describe('colonnes d’un palier envoyées en lot', () => {
  const KEYS = ['kind', 'target', 'unit', 'direction', 'mode', 'sources'];

  it('un jalon porte toutes les colonnes, avec leurs défauts', () => {
    expect(tierColumnsFull({ title: 'Offre signée', rank: 'or' })).toEqual({ ...JALON });
  });

  it('un palier comptable aussi, avec ses valeurs', () => {
    expect(
      tierColumnsFull({ title: '30 jours réussis', rank: 'or', kind: 'compte', target: 30, unit: 'jours' }),
    ).toEqual({ ...JALON, kind: 'compte', target: 30, unit: 'jours' });
  });

  it('toutes les formes de palier produisent EXACTEMENT les mêmes clés', () => {
    // L'invariant qui compte : c'est l'hétérogénéité des clés, pas leur
    // absence, qui faisait échouer l'insertion.
    const shapes: Parameters<typeof tierColumnsFull>[0][] = [
      {},
      { kind: 'jalon' },
      { kind: 'compte', target: 7, unit: 'jours' },
      { kind: 'cumul', target: 100, unit: 'km' },
      { kind: 'mesure', target: -5, unit: 'kg', direction: 'baisse', mode: 'delta' },
      { kind: 'performance', target: 10, unit: 'km', sources: ['a1'] },
    ];
    for (const shape of shapes) {
      expect(Object.keys(tierColumnsFull(shape)).sort(), JSON.stringify(shape)).toEqual(
        [...KEYS].sort(),
      );
    }
  });

  it('ne renvoie jamais null sur une colonne NOT NULL', () => {
    // `target` est la seule colonne qui accepte null en base.
    for (const key of ['kind', 'unit', 'direction', 'mode', 'sources']) {
      expect(tierColumnsFull({})[key], key).not.toBeNull();
      expect(tierColumnsFull({})[key], key).not.toBeUndefined();
    }
  });
});
