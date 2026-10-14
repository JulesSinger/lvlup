import { describe, expect, it } from 'vitest';
import { cleanStep, isTimed, launchTime, mergeStepTiming, minutesLabel, schedule, startLabel } from './schedule';
import type { Step } from './types';

/** L'exemple de Jules : les pâtes aux lardons (docs/maquette-recettes-timeline.html). */
const PATES: Step[] = [
  { id: 'eau', text: "Faire bouillir 2 L d'eau salée.", station: 'Casserole', minutes: 8, hands: false, start: { after: 'launch' } },
  { id: 'oignon', text: "Émincer l'oignon.", station: 'Plan de travail', minutes: 3, hands: true, start: { after: 'launch' } },
  { id: 'lardons', text: 'Faire revenir les lardons et l’oignon.', station: 'Poêle', minutes: 7, hands: false, start: { after: 'end', of: 'oignon' } },
  { id: 'pates', text: 'Quand l’eau bout, cuire les pâtes 10 minutes.', station: 'Casserole', minutes: 10, hands: false, start: { after: 'end', of: 'eau' } },
  { id: 'oeufs', text: 'Battre les œufs, la crème et le parmesan.', station: 'Plan de travail', minutes: 3, hands: true, start: { after: 'end', of: 'lardons' } },
  { id: 'egoutter', text: 'Égoutter.', station: 'Casserole', minutes: 1, hands: true, start: { after: 'end', of: 'pates' } },
  { id: 'melanger', text: 'Tout mélanger hors du feu.', station: 'Poêle', minutes: 2, hands: true, start: { after: 'end', of: 'egoutter' } },
];
const at = (s: ReturnType<typeof schedule>, key: string) => s.slots.find((x) => x.key === key)!;

describe('schedule (le plan)', () => {
  const plan = schedule(PATES);

  it('calcule les heures de chaque étape et la durée totale', () => {
    expect(PATES.map((p) => [at(plan, p.id!).start, at(plan, p.id!).end])).toEqual([
      [0, 8], [0, 3], [3, 10], [8, 18], [10, 13], [18, 19], [19, 21],
    ]);
    expect(plan.total).toBe(21);
  });

  it('marque le chemin qui fixe la durée totale', () => {
    expect(plan.slots.filter((s) => s.critical).map((s) => s.key)).toEqual(['eau', 'pates', 'egoutter', 'melanger']);
  });

  it('ne voit aucun chevauchement de gestes dans l’exemple, et en voit un s’il y en a', () => {
    expect(plan.conflicts).toEqual([]);
    const clash = PATES.map((s) => (s.id === 'oeufs' ? { ...s, start: { after: 'launch' as const } } : s));
    expect(schedule(clash).conflicts).toEqual([{ a: 'oignon', b: 'oeufs', from: 0, to: 3 }]);
  });

  it('sans déclencheur, une étape vient après celle d’avant ; sans durée, elle compte une minute', () => {
    const s = schedule([{ text: 'A', minutes: 5 }, { text: 'B' }, { text: 'C', minutes: 2 }]);
    expect(s.slots.map((x) => [x.start, x.end])).toEqual([[0, 5], [5, 6], [6, 8]]);
    expect(s.slots[1].minutesKnown).toBe(false);
  });

  it('« N minutes après le début de » une autre étape', () => {
    const s = schedule([
      { id: 'a', text: 'Eau', minutes: 8 },
      { id: 'b', text: 'Lardons', minutes: 6, start: { after: 'start', of: 'a', offset: 3 } },
    ]);
    expect([at(s, 'b').start, at(s, 'b').end]).toEqual([3, 9]);
    expect(s.total).toBe(9);
  });

  it('une boucle dans les renvois ne bloque rien : elle est signalée', () => {
    const s = schedule([
      { id: 'a', text: 'A', minutes: 2, start: { after: 'end', of: 'b' } },
      { id: 'b', text: 'B', minutes: 2, start: { after: 'end', of: 'a' } },
    ]);
    expect(s.loops.length).toBeGreaterThan(0);
    expect(Number.isFinite(s.total)).toBe(true);
  });

  it('un renvoi vers une étape inconnue revient à « après l’étape d’avant »', () => {
    const s = schedule([{ text: 'A', minutes: 2 }, { text: 'B', minutes: 1, start: { after: 'end', of: 'zzz' } }]);
    expect(s.slots[1].start).toBe(2);
  });
});

describe('schedule (en cuisine, le plan suit les retards)', () => {
  it('à l’heure, rien ne bouge', () => {
    const live = schedule(PATES, { now: 5, started: { eau: 0, oignon: 0, lardons: 3 }, done: { oignon: 3 } });
    expect(live.total).toBe(21);
    expect(at(live, 'eau').state).toBe('running');
    expect(at(live, 'oignon').state).toBe('done');
    expect(at(live, 'pates').state).toBe('pending');
  });

  it('les lardons lancés 2 min en retard décalent ce qui en dépend, pas le reste', () => {
    const live = schedule(PATES, { now: 6, started: { eau: 0, oignon: 0, lardons: 5 }, done: { oignon: 5 } });
    expect([at(live, 'lardons').start, at(live, 'oeufs').start]).toEqual([5, 12]);
    expect(at(live, 'pates').start).toBe(8);
    expect(live.total).toBe(21);
  });

  it('une étape pas commencée à temps part de maintenant, et l’heure du repas recule', () => {
    const live = schedule(PATES, { now: 11, started: { eau: 0, oignon: 0, lardons: 3 }, done: { oignon: 3 } });
    expect(at(live, 'pates').start).toBe(11);
    expect(live.total).toBe(24);
  });

  it('un geste dure tant qu’on ne l’a pas dit fini ; ce qui cuit tout seul se finit seul', () => {
    const live = schedule(PATES, { now: 4, started: { eau: 0, oignon: 0 }, done: {} });
    expect(at(live, 'oignon').end).toBe(4);
    expect(at(live, 'oignon').state).toBe('running');
    const later = schedule(PATES, { now: 9, started: { eau: 0, oignon: 0, lardons: 3 }, done: { oignon: 3 } });
    expect(at(later, 'eau').state).toBe('done');
  });
});

describe('cleanStep', () => {
  it('garde les champs bien formés, retire les autres', () => {
    expect(cleanStep({ text: 'Cuire', id: 'ab12', station: ' Four ', minutes: 25, hands: false, start: { after: 'end', of: 'x1' } })).toEqual({
      text: 'Cuire', id: 'ab12', station: 'Four', minutes: 25, hands: false, start: { after: 'end', of: 'x1' },
    });
    expect(cleanStep({ text: 'Cuire', id: '<script>', minutes: -3, hands: 'oui', start: { after: 'start', of: 'a' } })).toEqual({ text: 'Cuire' });
    expect(cleanStep({ minutes: 3 })).toBeNull();
  });
});

describe('isTimed', () => {
  it('une recette sans poste ni durée n’a pas de plan', () => {
    expect(isTimed([{ text: 'A' }, { text: 'B', hands: true }])).toBe(false);
    expect(isTimed([{ text: 'A' }, { text: 'B', minutes: 3 }])).toBe(true);
  });
});

describe('mergeStepTiming', () => {
  it('une étape au même texte garde ses réglages, même déplacée', () => {
    const merged = mergeStepTiming(PATES, [{ text: "Émincer l'oignon." }, { text: "Faire bouillir 2 L d'eau salée." }]);
    expect(merged[0]).toMatchObject({ id: 'oignon', minutes: 3 });
    expect(merged[1]).toMatchObject({ id: 'eau', minutes: 8 });
  });

  it('une étape retouchée garde les réglages de celle à la même place', () => {
    const merged = mergeStepTiming(PATES.slice(0, 2), [{ text: "Faire bouillir 3 L d'eau salée." }, { text: "Émincer l'oignon." }]);
    expect(merged[0]).toMatchObject({ text: "Faire bouillir 3 L d'eau salée.", id: 'eau', minutes: 8 });
  });

  it('un renvoi vers une étape supprimée est retiré', () => {
    const merged = mergeStepTiming(PATES.slice(0, 4), [{ text: "Émincer l'oignon." }, { text: 'Faire revenir les lardons et l’oignon.' }]);
    expect(merged[1].start).toEqual({ after: 'end', of: 'oignon' });
    const without = mergeStepTiming(PATES.slice(0, 4), [{ text: 'Quand l’eau bout, cuire les pâtes 10 minutes.' }]);
    expect(without[0].start).toBeUndefined();
  });

  it('une étape nouvelle n’a pas de réglage', () => {
    expect(mergeStepTiming(PATES.slice(0, 1), [{ text: "Faire bouillir 2 L d'eau salée." }, { text: 'Servir.' }])[1]).toEqual({ text: 'Servir.' });
  });
});

describe('les libellés', () => {
  it('dit les minutes et les heures', () => {
    expect([minutesLabel(0), minutesLabel(7.5), minutesLabel(90), minutesLabel(120)]).toEqual(['0 min', '7 min 30', '1 h 30', '2 h']);
  });

  it('dit ce qui déclenche une étape', () => {
    const plan = schedule([...PATES, { id: 'x', text: 'X', minutes: 1, start: { after: 'start', of: 'eau', offset: 3 } }]);
    expect(plan.slots.map((s) => startLabel(s, plan.slots))).toEqual([
      'au lancement', 'au lancement', 'après l’étape d’avant', 'à la fin de l’étape 1',
      'à la fin de l’étape 3', 'à la fin de l’étape 4', 'après l’étape d’avant', '3 min après le début de l’étape 1',
    ]);
  });

  it('l’heure de lancer pour être à table à l’heure', () => {
    expect(launchTime(new Date(2026, 9, 14, 20, 0), 21).getMinutes()).toBe(39);
  });
});
