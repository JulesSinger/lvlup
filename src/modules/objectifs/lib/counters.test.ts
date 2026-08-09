import { describe, expect, it } from 'vitest';
import { feedingCheckins, formatAmount, isCountable, tierProgress, todayContribution } from './counters';
import type { Action, Checkin, Tier, TierKind } from './types';

/**
 * Ces fonctions décident du moment où une cérémonie se déclenche. Se tromper
 * ici, c'est soit voler une victoire, soit l'offrir trop tôt — et une
 * cérémonie non méritée dévalorise toutes les suivantes.
 */

let n = 0;

function tier(patch: Partial<Tier> & { kind: TierKind }): Tier {
  n += 1;
  return {
    id: `t${n}`,
    goalId: 'g1',
    title: 'Palier',
    rank: 'bronze',
    position: 0,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    target: null,
    unit: '',
    direction: 'hausse',
    mode: 'absolu',
    sources: [],
    ...patch,
  };
}

function action(patch: Partial<Action> = {}): Action {
  n += 1;
  return {
    id: patch.id ?? `a${n}`,
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

function checkin(day: string, patch: Partial<Checkin> = {}): Checkin {
  n += 1;
  return {
    id: `c${n}`,
    goalId: 'g1',
    actionId: 'a1',
    pp: 15,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
    title: null,
    ...patch,
  };
}

/** Suite de jours consécutifs se terminant à `end`. */
function run(end: string, count: number): string[] {
  const [y, m, d] = end.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(y, m - 1, d - (count - 1 - i), 12);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
  });
}

describe('isCountable', () => {
  it('un jalon ne se compte pas', () => {
    expect(isCountable(tier({ kind: 'jalon' }))).toBe(false);
  });

  it('une nature comptable sans cible ne se compte pas non plus', () => {
    expect(isCountable(tier({ kind: 'compte', target: null }))).toBe(false);
    expect(isCountable(tier({ kind: 'compte', target: 30 }))).toBe(true);
  });

  it('tierProgress renvoie null pour un jalon', () => {
    expect(tierProgress(tier({ kind: 'jalon' }), [], [])).toBeNull();
  });
});

describe('quelles réalisations alimentent un palier', () => {
  it('sans source déclarée, toutes les actions de l’objectif comptent', () => {
    const t = tier({ kind: 'compte', target: 3 });
    const list = [checkin('2026-05-01', { actionId: 'a1' }), checkin('2026-05-02', { actionId: 'a9' })];
    expect(feedingCheckins(t, list)).toHaveLength(2);
  });

  it('avec des sources, seules celles-là comptent', () => {
    const t = tier({ kind: 'compte', target: 3, sources: ['a1'] });
    const list = [checkin('2026-05-01', { actionId: 'a1' }), checkin('2026-05-02', { actionId: 'a9' })];
    expect(feedingCheckins(t, list)).toHaveLength(1);
  });

  it('ignore les réalisations d’un autre objectif', () => {
    const t = tier({ kind: 'compte', target: 3 });
    expect(feedingCheckins(t, [checkin('2026-05-01', { goalId: 'g2' })])).toHaveLength(0);
  });

  // Efforts et relevés sont deux mondes. Les mélanger ferait exploser un cumul
  // « 100 km » de 78 kilomètres le jour où on ajoute une balance à l'objectif.
  it('un relevé n’alimente jamais un palier d’effort', () => {
    const balance = action({ id: 'a1', unit: 'kg', isMeasure: true });
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    const list = [checkin('2026-05-01', { actionId: 'a1', value: 78 })];
    expect(feedingCheckins(t, list, [balance])).toHaveLength(0);
  });

  it('un effort n’alimente jamais une mesure', () => {
    const course = action({ id: 'a1', unit: 'km', defaultValue: 8 });
    const t = tier({ kind: 'mesure', target: -5, unit: 'kg', direction: 'baisse', mode: 'delta' });
    const list = [checkin('2026-05-01', { actionId: 'a1', value: 8 })];
    expect(feedingCheckins(t, list, [course])).toHaveLength(0);
  });

  it('une source explicite l’emporte : c’est le choix de l’utilisateur', () => {
    const balance = action({ id: 'a1', unit: 'kg', isMeasure: true });
    const t = tier({ kind: 'compte', target: 30, unit: 'jours', sources: ['a1'] });
    expect(feedingCheckins(t, [checkin('2026-05-01', { actionId: 'a1' })], [balance])).toHaveLength(
      1,
    );
  });

  it('une action inconnue passe : l’historique ne se réécrit pas', () => {
    // Action supprimée, ou check-in antérieur aux actions : `actionId` est nul
    // ou introuvable, et ses PP d'origine restent acquis.
    const t = tier({ kind: 'compte', target: 3 });
    expect(feedingCheckins(t, [checkin('2026-05-01', { actionId: null })], [])).toHaveLength(1);
  });

  /**
   * La garde la plus importante des gestes ponctuels. Sans elle, « 30 jours
   * sans écran » se validerait en notant trente fois « j'y ai pensé » : le
   * palier ne mesurerait plus rien, et le rang qu'il donne non plus.
   */
  it('un geste ponctuel n’alimente aucun palier, quelle que soit sa nature', () => {
    const ponctuel = checkin('2026-05-01', { actionId: null, title: 'tuto budget', pp: 10 });
    for (const kind of ['compte', 'cumul', 'serie', 'performance', 'mesure'] as TierKind[]) {
      const t = tier({ kind, target: 3, unit: 'jours' });
      expect(feedingCheckins(t, [ponctuel], []), kind).toHaveLength(0);
    }
  });

  it('même désigné comme source, un geste ponctuel ne compte pas', () => {
    // Il n'a pas d'action : il ne peut appartenir à aucune liste de sources.
    // Le test verrouille le fait que l'exclusion passe *avant* les sources.
    const t = tier({ kind: 'compte', target: 3, sources: ['a1'] });
    const ponctuel = checkin('2026-05-01', { actionId: null, title: 'un pas de côté' });
    expect(feedingCheckins(t, [ponctuel], [])).toHaveLength(0);
  });
});

describe('compte', () => {
  it('compte les jours distincts', () => {
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    const list = run('2026-05-20', 18).map((d) => checkin(d));
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(18);
    expect(p.percent).toBeCloseTo(0.6);
    expect(p.reached).toBe(false);
  });

  it('ne compte qu’une fois plusieurs actions le même jour', () => {
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    const list = [
      checkin('2026-05-20', { actionId: 'a1' }),
      checkin('2026-05-20', { actionId: 'a2' }),
    ];
    expect(tierProgress(t, [], list, '2026-05-20')!.current).toBe(1);
  });

  it('des jours dispersés comptent autant que des jours d’affilée', () => {
    // C'est tout l'intérêt du compte : un jour manqué ne retire rien.
    const t = tier({ kind: 'compte', target: 3, unit: 'jours' });
    const list = ['2026-01-04', '2026-03-11', '2026-05-20'].map((d) => checkin(d));
    expect(tierProgress(t, [], list, '2026-05-20')!.reached).toBe(true);
  });

  it('compte une unité qui n’est pas « jours » sans jamais sommer', () => {
    // Le piège de la première version : deviner le mode de comptage à partir
    // du nom de l'unité. « nuits » ou « séances » tombaient du mauvais côté
    // et renvoyaient zéro.
    const t = tier({ kind: 'compte', target: 30, unit: 'nuits' });
    const list = run('2026-05-20', 7).map((d) => checkin(d, { value: 7 }));
    expect(tierProgress(t, [], list, '2026-05-20')!.current).toBe(7);
  });

  it('ignore les réalisations postérieures à aujourd’hui', () => {
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    const list = [checkin('2026-05-20'), checkin('2026-06-01')];
    expect(tierProgress(t, [], list, '2026-05-20')!.current).toBe(1);
  });
});

describe('cumul', () => {
  it('additionne les quantités', () => {
    const t = tier({ kind: 'cumul', target: 100, unit: 'km' });
    const list = [
      checkin('2026-05-18', { value: 8 }),
      checkin('2026-05-19', { value: 12.5 }),
      checkin('2026-05-20', { value: 5 }),
    ];
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(25.5);
    expect(p.reached).toBe(false);
  });

  it('retombe sur la valeur habituelle de l’action quand rien n’est saisi', () => {
    // C'est ce qui permet de cocher sans clavier tout en nourrissant un cumul.
    const t = tier({ kind: 'cumul', target: 100, unit: 'km' });
    const a = action({ id: 'a1', unit: 'km', defaultValue: 8 });
    const list = run('2026-05-20', 3).map((d) => checkin(d));
    expect(tierProgress(t, [a], list, '2026-05-20')!.current).toBe(24);
  });

  it('additionne plusieurs quantités le même jour', () => {
    // Deux sorties le même jour font bien deux fois la distance — c'est là
    // que le cumul se sépare franchement du compte.
    const t = tier({ kind: 'cumul', target: 100, unit: 'km' });
    const list = [
      checkin('2026-05-20', { actionId: 'a1', value: 8 }),
      checkin('2026-05-20', { actionId: 'a2', value: 5 }),
    ];
    expect(tierProgress(t, [], list, '2026-05-20')!.current).toBe(13);
  });
});

describe('série', () => {
  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    const t = tier({ kind: 'serie', target: 30, unit: 'jours' });
    const list = run('2026-05-20', 12).map((d) => checkin(d));
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(12);
    expect(p.best).toBe(12);
  });

  it('ne casse pas la série tant que la journée n’est pas finie', () => {
    // Rien fait aujourd'hui, mais hier oui : on est encore dans les temps.
    const t = tier({ kind: 'serie', target: 30, unit: 'jours' });
    const list = run('2026-05-19', 12).map((d) => checkin(d));
    expect(tierProgress(t, [], list, '2026-05-20')!.current).toBe(12);
  });

  it('retombe à zéro après un vrai trou, mais garde le record', () => {
    const t = tier({ kind: 'serie', target: 30, unit: 'jours' });
    const list = [...run('2026-04-30', 11), ...run('2026-05-20', 3)].map((d) => checkin(d));
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(3);
    expect(p.best).toBe(11);
  });

  it('reste acquis si la cible a été touchée puis la série cassée', () => {
    // Règle de la maison : ce qui est gagné est gagné.
    const t = tier({ kind: 'serie', target: 7, unit: 'jours' });
    const list = [...run('2026-04-30', 9), ...run('2026-05-20', 2)].map((d) => checkin(d));
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(2);
    expect(p.reached).toBe(true);
  });

  it('une coche rétroactive répare la série', () => {
    // Le rattrapage d'un oubli : on recolle les deux morceaux.
    const t = tier({ kind: 'serie', target: 10, unit: 'jours' });
    const avant = [...run('2026-05-18', 4), ...run('2026-05-20', 1)];
    expect(tierProgress(t, [], avant.map((d) => checkin(d)), '2026-05-20')!.current).toBe(1);

    const apres = [...avant, '2026-05-19'];
    expect(tierProgress(t, [], apres.map((d) => checkin(d)), '2026-05-20')!.current).toBe(6);
  });
});

describe('performance', () => {
  it('retient la meilleure séance, jamais la somme', () => {
    // Le piège central : deux sorties de 5 km ne font pas un 10 km.
    const t = tier({ kind: 'performance', target: 10, unit: 'km' });
    const list = [checkin('2026-05-18', { value: 5 }), checkin('2026-05-19', { value: 5 })];
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(5);
    expect(p.reached).toBe(false);
  });

  it('valide dès qu’une seule séance atteint le seuil', () => {
    const t = tier({ kind: 'performance', target: 10, unit: 'km' });
    const list = [checkin('2026-05-18', { value: 5 }), checkin('2026-05-19', { value: 10.2 })];
    expect(tierProgress(t, [], list, '2026-05-20')!.reached).toBe(true);
  });

  it('sait viser vers le bas (un chrono)', () => {
    const t = tier({ kind: 'performance', target: 25, unit: 'min', direction: 'baisse' });
    const list = [checkin('2026-05-18', { value: 28 }), checkin('2026-05-19', { value: 24.5 })];
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.current).toBe(24.5);
    expect(p.reached).toBe(true);
  });
});

describe('mesure', () => {
  const balance = action({ id: 'a1', unit: 'kg', isMeasure: true });
  const peser = (day: string, kg: number) => checkin(day, { actionId: 'a1', value: kg });

  it('mesure la distance parcourue depuis le premier relevé', () => {
    const t = tier({ kind: 'mesure', target: -5, unit: 'kg', direction: 'baisse', mode: 'delta' });
    const list = [peser('2026-05-01', 80), peser('2026-05-10', 79), peser('2026-05-20', 78.1)];
    const p = tierProgress(t, [balance], list, '2026-05-20')!;
    expect(p.baseline).toBe(80);
    expect(p.latest).toBe(78.1);
    expect(p.current).toBeCloseTo(-1.9);
    expect(p.percent).toBeCloseTo(0.38);
    expect(p.reached).toBe(false);
  });

  it('valide quand la cible est touchée', () => {
    const t = tier({ kind: 'mesure', target: -2, unit: 'kg', direction: 'baisse', mode: 'delta' });
    const list = [peser('2026-05-01', 80), peser('2026-05-20', 77.6)];
    expect(tierProgress(t, [balance], list, '2026-05-20')!.reached).toBe(true);
  });

  it('reste acquis même si la mesure repart dans l’autre sens', () => {
    // Le point sur lequel Zénith est plus sain que toutes les apps de poids.
    const t = tier({ kind: 'mesure', target: -2, unit: 'kg', direction: 'baisse', mode: 'delta' });
    const list = [peser('2026-05-01', 80), peser('2026-06-01', 77.6), peser('2026-07-01', 79.5)];
    const p = tierProgress(t, [balance], list, '2026-07-01')!;
    expect(p.latest).toBe(79.5);
    expect(p.reached).toBe(true);
  });

  it('accepte une cible absolue', () => {
    const t = tier({ kind: 'mesure', target: 75, unit: 'kg', direction: 'baisse', mode: 'absolu' });
    const list = [peser('2026-05-01', 80), peser('2026-05-20', 74.8)];
    expect(tierProgress(t, [balance], list, '2026-05-20')!.reached).toBe(true);
  });

  it('sait monter (une épargne)', () => {
    const t = tier({ kind: 'mesure', target: 3000, unit: '€', direction: 'hausse', mode: 'absolu' });
    const list = [
      checkin('2026-01-01', { value: 400 }),
      checkin('2026-05-20', { value: 1800 }),
    ];
    const p = tierProgress(t, [], list, '2026-05-20')!;
    expect(p.percent).toBeCloseTo(1400 / 2600);
    expect(p.reached).toBe(false);
  });

  it('ne compte que les relevés chiffrés', () => {
    const t = tier({ kind: 'mesure', target: -5, unit: 'kg', direction: 'baisse', mode: 'delta' });
    expect(tierProgress(t, [balance], [checkin('2026-05-01')], '2026-05-20')!.latest).toBeNull();
  });

  it('ne descend jamais sous zéro quand on s’éloigne de la cible', () => {
    const t = tier({ kind: 'mesure', target: -5, unit: 'kg', direction: 'baisse', mode: 'delta' });
    const list = [peser('2026-05-01', 80), peser('2026-05-20', 82)];
    expect(tierProgress(t, [balance], list, '2026-05-20')!.percent).toBe(0);
  });
});

describe('ce que la coche du jour ajouterait', () => {
  it('vaut un jour sur un compte en jours', () => {
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    expect(todayContribution(t, [], [], '2026-05-20')).toBe(1);
  });

  it('vaut zéro si le palier est déjà nourri aujourd’hui', () => {
    const t = tier({ kind: 'compte', target: 30, unit: 'jours' });
    expect(todayContribution(t, [], [checkin('2026-05-20')], '2026-05-20')).toBe(0);
  });

  it('vaut la valeur habituelle sur un cumul en kilomètres', () => {
    const t = tier({ kind: 'cumul', target: 100, unit: 'km' });
    const a = action({ id: 'a1', unit: 'km', defaultValue: 8 });
    expect(todayContribution(t, [a], [], '2026-05-20')).toBe(8);
  });

  it('ne promet rien sur une mesure ou une performance', () => {
    expect(todayContribution(tier({ kind: 'mesure', target: -5 }), [], [])).toBe(0);
    expect(todayContribution(tier({ kind: 'performance', target: 10 }), [], [])).toBe(0);
  });
});

describe('formatAmount', () => {
  it('n’affiche pas de décimale inutile', () => {
    expect(formatAmount(8)).toBe('8');
    expect(formatAmount(8.0)).toBe('8');
    expect(formatAmount(78.14, 'kg')).toBe('78,1 kg');
    expect(formatAmount(25.5, 'km')).toBe('25,5 km');
  });
});
