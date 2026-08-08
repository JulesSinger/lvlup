import { beforeEach, describe, expect, it } from 'vitest';
import {
  CATCHUP_DAYS,
  catchupDays,
  catchupLabel,
  catchupSummary,
  ignoreDay,
  isIgnored,
  shiftDay,
} from './catchup';
import { JALON, type Action, type Checkin, type Goal } from './types';

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

function goal(createdAt = '2026-01-01T12:00:00.000Z'): Goal {
  return {
    id: 'g1',
    title: 'Objectif',
    description: '',
    emoji: '🎯',
    position: 0,
    archived: false,
    createdAt,
    tiers: [
      {
        id: 't1',
        goalId: 'g1',
        title: 'Palier',
        rank: 'bronze',
        position: 0,
        completedAt: null,
        createdAt,
        ...JALON,
      },
    ],
  };
}

const action: Action = {
  id: 'a1',
  goalId: 'g1',
  title: 'Action',
  pp: 15,
  position: 0,
  archived: false,
  createdAt: '2026-01-01T12:00:00.000Z',
  unit: '',
  defaultValue: null,
  isMeasure: false,
};

function checkin(day: string): Checkin {
  return {
    id: `c-${day}`,
    goalId: 'g1',
    actionId: 'a1',
    pp: 15,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
  };
}

beforeEach(() => memory.clear());

describe('shiftDay', () => {
  it('recule d’un jour, y compris en changeant de mois', () => {
    expect(shiftDay('2026-05-20', -1)).toBe('2026-05-19');
    expect(shiftDay('2026-05-01', -1)).toBe('2026-04-30');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('franchit un changement d’heure sans se décaler', () => {
    // Nuit du 28 au 29 mars 2026 en Europe.
    expect(shiftDay('2026-03-29', -1)).toBe('2026-03-28');
    expect(shiftDay('2026-10-25', -1)).toBe('2026-10-24');
  });
});

describe('catchupDays', () => {
  const days = (...args: Parameters<typeof catchupDays>) =>
    catchupDays(...args).map((d) => d.day);

  it('propose les deux jours précédents', () => {
    expect(days([goal()], [action], [], '2026-05-20')).toEqual(['2026-05-19', '2026-05-18']);
  });

  it('ne propose jamais aujourd’hui', () => {
    const list = days([goal()], [action], [], '2026-05-20');
    expect(list).not.toContain('2026-05-20');
    expect(list).toHaveLength(CATCHUP_DAYS);
  });

  it('garde un jour déjà entamé, pour pouvoir le corriger', () => {
    // La première version l'écartait : impossible d'ajouter une action oubliée
    // sur une journée commencée, ni de décocher une erreur.
    const list = catchupDays([goal()], [action], [checkin('2026-05-19')], '2026-05-20');
    expect(list.map((d) => d.day)).toEqual(['2026-05-19', '2026-05-18']);
    expect(list[0].done).toBe(1);
  });

  it('ne pose la question que sur un jour resté vide', () => {
    const list = catchupDays([goal()], [action], [checkin('2026-05-19')], '2026-05-20');
    expect(list[0].asks).toBe(false); // entamé : l'app se tait
    expect(list[1].asks).toBe(true); // vide : elle demande
  });

  it('ne remonte pas avant la création du premier objectif', () => {
    const jeune = goal('2026-05-19T09:00:00.000Z');
    expect(days([jeune], [action], [], '2026-05-20')).toEqual(['2026-05-19']);
  });

  it('ne propose rien sans objectif ni action', () => {
    expect(days([], [], [], '2026-05-20')).toEqual([]);
    expect(days([goal()], [], [], '2026-05-20')).toEqual([]);
  });

  it('ignore les objectifs archivés', () => {
    expect(days([{ ...goal(), archived: true }], [action], [], '2026-05-20')).toEqual([]);
  });

  it('cesse de demander pour un jour explicitement écarté, sans le retirer', () => {
    ignoreDay('2026-05-19', '2026-05-20');
    expect(isIgnored('2026-05-19')).toBe(true);
    const list = catchupDays([goal()], [action], [], '2026-05-20');
    // Le jour reste modifiable — on a dit « rien fait », pas « ne me laisse
    // plus y toucher ».
    expect(list.map((d) => d.day)).toContain('2026-05-19');
    expect(list.find((d) => d.day === '2026-05-19')?.asks).toBe(false);
  });

  it('purge les jours écartés devenus hors fenêtre', () => {
    ignoreDay('2026-01-02', '2026-01-03');
    ignoreDay('2026-05-19', '2026-05-20');
    expect(isIgnored('2026-01-02')).toBe(false);
    expect(isIgnored('2026-05-19')).toBe(true);
  });
});

describe('catchupSummary', () => {
  it('résume l’état du jour en un mot', () => {
    expect(catchupSummary({ day: 'x', done: 0, total: 3, asks: true })).toBe('rien de coché');
    expect(catchupSummary({ day: 'x', done: 1, total: 3, asks: false })).toBe('1 action');
    expect(catchupSummary({ day: 'x', done: 3, total: 3, asks: false })).toBe('3 actions');
  });
});

describe('catchupLabel', () => {
  it('nomme le jour plutôt que d’afficher une date', () => {
    expect(catchupLabel('2026-05-19', '2026-05-20')).toMatch(/^Hier · /);
    expect(catchupLabel('2026-05-18', '2026-05-20')).toMatch(/^Avant-hier · /);
  });
});
