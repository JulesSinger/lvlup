import { describe, expect, it } from 'vitest';
import { schedule } from './schedule';
import { guessTiming, textMinutes } from './stepGuess';

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

describe('la durée de toute une étape (16/10/2026)', () => {
  it('compte chaque durée, le haut d’une fourchette, « par face » deux fois, et la poêle qui chauffe', () => {
    expect(textMinutes('Laisser épaissir 3 min.')).toBe(3);
    expect(textMinutes('Faire fondre l’échalote 2 min, puis ajouter la crème. Laisser épaissir 3 min.')).toBe(5);
    expect(textMinutes('Faire revenir les lardons 5 à 8 min.')).toBe(8);
    expect(textMinutes('Saisir la côte 6 à 7 min par face.')).toBe(14);
    expect(textMinutes('Chauffer l’huile et le beurre dans une poêle à feu vif. Saisir la côte 6 à 7 min par face selon l’épaisseur.')).toBe(16);
    expect(textMinutes('Goûter, rectifier.')).toBeNull();
  });

  // Le plan qui a fait lancer la viande trop tard : la poêle durait 4 min, le riz 11 — la poêle doit partir AVANT le riz.
  it('la côte de porc : la poêle part avant le riz, et l’on égoutte le riz quand il est cuit', () => {
    const steps = guessTiming([
      { text: 'Sortir la côte du frigo 15 min avant, la sécher avec du papier absorbant et l’assaisonner de sel et poivre.' },
      { text: 'Chauffer l’huile et le beurre dans une poêle à feu vif. Saisir la côte 6 à 7 min par face selon l’épaisseur, puis la poser sur une assiette.' },
      { text: 'Baisser le feu, faire fondre l’échalote émincée dans la même poêle 2 min, puis ajouter la moutarde et la crème. Gratter les sucs et laisser épaissir 3 min.' },
      { text: 'Pendant ce temps, rincer le riz et le faire cuire dans une casserole d’eau salée (environ 11 min).' },
      { text: 'Égoutter le riz, napper la côte et le riz de sauce.' },
    ]);
    expect(steps.map((s) => s.minutes)).toEqual([15, 16, 5, 11, 3]);
    expect(steps[0].hands).toBe(false);
    const plan = schedule(steps);
    const [, pan, sauce, rice, drain] = plan.slots;
    expect(pan.start).toBeLessThan(rice.start + 1e-6);
    expect(drain.start).toBeGreaterThanOrEqual(rice.end);
    expect(drain.start).toBeGreaterThanOrEqual(sauce.end);
  });

  it('une étape sans départ dit attend que son poste soit libre', () => {
    const plan = schedule([
      { text: 'Cuire le riz.', id: 'riz', station: 'Casserole', minutes: 11, hands: false, start: { after: 'launch' } },
      { text: 'Faire la sauce.', id: 'sauce', station: 'Poêle', minutes: 5, hands: true, start: { after: 'launch' } },
      { text: 'Égoutter le riz.', id: 'egoutter', station: 'Casserole', minutes: 2, hands: true },
    ]);
    expect(plan.slots[2]).toMatchObject({ start: 11, after: { key: 'riz', kind: 'end', offset: 0 } });
  });
});
