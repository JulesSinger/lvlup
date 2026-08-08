import { beforeEach, describe, expect, it } from 'vitest';
import {
  PENDING_PREFIX,
  applyPending,
  clearPending,
  isNetworkError,
  listPending,
  queueAdd,
  queueDelete,
  removeOp,
} from './outbox';
import type { Checkin } from '../lib/types';

/**
 * La file d'attente existe pour une seule raison : ne jamais perdre une action
 * cochée hors réseau. Ces tests vérifient qu'elle tient cette promesse, y
 * compris dans les enchaînements tordus (cocher, décocher, recocher).
 */

// Le module s'appuie sur localStorage ; en environnement Node on en fournit
// une version minimale plutôt que de tirer tout un DOM.
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

function serverCheckin(id: string, actionId: string, day: string, pp = 15): Checkin {
  return {
    id,
    goalId: 'g1',
    actionId,
    pp,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
  };
}

beforeEach(() => {
  memory.clear();
  clearPending();
});

describe('mise en file', () => {
  it('range une coche et renvoie un identifiant provisoire reconnaissable', () => {
    const id = queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    expect(id.startsWith(PENDING_PREFIX)).toBe(true);
    expect(listPending()).toHaveLength(1);
  });

  it('ne met pas deux fois la même coche du même jour', () => {
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    expect(listPending()).toHaveLength(1);
  });

  it('cocher puis décocher hors ligne annule les deux opérations', () => {
    const id = queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    queueDelete(id);
    expect(listPending()).toHaveLength(0);
  });

  it('décocher une coche déjà sur le serveur programme une suppression', () => {
    queueDelete('vrai-id');
    const ops = listPending();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'delete', checkinId: 'vrai-id' });
  });

  it('ne programme pas deux fois la même suppression', () => {
    queueDelete('vrai-id');
    queueDelete('vrai-id');
    expect(listPending()).toHaveLength(1);
  });

  it('survit à un rechargement de page', () => {
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    // Simule un nouveau départ : seul le localStorage subsiste.
    expect(listPending()).toHaveLength(1);
    expect(memory.has('zenith.outbox.v1')).toBe(true);
  });
});

describe('applyPending', () => {
  it('ajoute les coches en attente aux données du serveur', () => {
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    const result = applyPending([]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ actionId: 'a1', day: '2026-05-20', pp: 15 });
  });

  it('retire les coches dont la suppression attend d’être envoyée', () => {
    queueDelete('c1');
    const result = applyPending([serverCheckin('c1', 'a1', '2026-05-20')]);
    expect(result).toHaveLength(0);
  });

  it('ne double pas une coche que le serveur a finalement enregistrée', () => {
    // Cas réel : l'envoi a abouti, mais l'opération est encore en file parce
    // que la réponse s'est perdue. Le rafraîchissement ne doit pas afficher
    // deux fois la même action.
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    const result = applyPending([serverCheckin('c1', 'a1', '2026-05-20')]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('laisse les données intactes quand la file est vide', () => {
    const server = [serverCheckin('c1', 'a1', '2026-05-20')];
    expect(applyPending(server)).toBe(server);
  });

  it('retire une opération traitée sans toucher aux autres', () => {
    queueAdd({ goalId: 'g1', actionId: 'a1', day: '2026-05-20', pp: 15 });
    queueAdd({ goalId: 'g1', actionId: 'a2', day: '2026-05-20', pp: 5 });
    removeOp(listPending()[0].id);
    expect(listPending()).toHaveLength(1);
    expect(listPending()[0]).toMatchObject({ actionId: 'a2' });
  });
});

describe('isNetworkError', () => {
  it('reconnaît une requête qui n’a pas pu partir', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
    // Safari a son propre message.
    expect(isNetworkError(new Error('Load failed'))).toBe(true);
  });

  it('ne confond pas un refus du serveur avec une coupure', () => {
    // Celui-ci ne réussira jamais en le rejouant : il doit remonter.
    expect(isNetworkError(new Error('new row violates row-level security policy'))).toBe(false);
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false);
  });
});
