import { describe, expect, it } from 'vitest';
import { schedule } from './schedule';
import { guessTiming } from './stepGuess';

const TEXT = [
  'Porter à ébullition une grande casserole d’eau salée.',
  'Pendant ce temps, émincer l’oignon.',
  'Faire revenir les lardons et l’oignon dans une poêle 7 minutes.',
  'Quand l’eau bout, cuire les pâtes 10 minutes.',
  'Battre les œufs avec la crème et le parmesan.',
  'Égoutter les pâtes et mélanger le tout hors du feu.',
].map((text) => ({ text }));

describe('guessTiming', () => {
  const guessed = guessTiming(TEXT);

  it('devine le poste de chaque étape', () => {
    expect(guessed.map((s) => s.station)).toEqual(['Casserole', 'Plan de travail', 'Poêle', 'Casserole', 'Plan de travail', 'Casserole']);
  });

  it('lit les durées, et devine celle de l’eau qui bout et des gestes', () => {
    expect(guessed.map((s) => s.minutes)).toEqual([8, 3, 7, 10, 3, 3]);
  });

  it('sépare ce qui cuit tout seul de ce qui occupe les mains', () => {
    expect(guessed.map((s) => s.hands)).toEqual([false, true, false, false, true, true]);
  });

  it('comprend « pendant ce temps » et « quand l’eau bout »', () => {
    const [eau, oignon, , pates] = guessed;
    expect(eau.start).toEqual({ after: 'launch' });
    expect(oignon.start).toEqual({ after: 'start', of: eau.id, offset: 0 });
    expect(pates.start).toEqual({ after: 'end', of: eau.id });
  });

  it('une étape attend que son poste soit libre : égoutter après les pâtes', () => {
    const plan = schedule(guessed);
    expect(guessed[5].start).toEqual({ after: 'end', of: guessed[3].id });
    expect(plan.slots[5].start).toBe(plan.slots[3].end);
    expect(plan.total).toBe(21);
  });

  it('en tire un plan où l’eau et l’oignon partent ensemble', () => {
    const plan = schedule(guessed);
    expect(plan.slots[0].start).toBe(0);
    expect(plan.slots[1].start).toBe(0);
    expect(plan.slots[3].start).toBe(8);
  });

  it('ne remplace jamais ce qui est déjà réglé', () => {
    const kept = guessTiming([{ text: 'Cuire 10 minutes.', id: 'a1', minutes: 12, station: 'Four', hands: true }]);
    expect(kept[0]).toMatchObject({ id: 'a1', minutes: 12, station: 'Four', hands: true });
  });

  it('une étape sans indice reste sans poste ni durée devinée, après celle d’avant', () => {
    const [, plain] = guessTiming([{ text: 'Cuire 5 minutes.' }, { text: 'Goûter, rectifier.' }]);
    expect(plain.station).toBeNull();
    expect(plain.start).toBeUndefined();
  });
});
