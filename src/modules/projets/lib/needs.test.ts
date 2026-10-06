import { describe, expect, it } from 'vitest';
import { askedQuestions, NEED_QUESTIONS, NEEDS_SECTIONS, needsProgress, normalizeNeeds, sameNeeds, setAnswer, toggleAsk, toggleChoice } from './needs';

const goals = NEED_QUESTIONS.find((q) => q.key === 'goals')!;

describe('le questionnaire de besoins', () => {
  it('chaque question a une clé unique, chaque choix multiple ses choix', () => {
    const keys = NEED_QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(NEEDS_SECTIONS.length).toBeGreaterThan(5);
    for (const q of NEED_QUESTIONS) if (q.kind === 'choices') expect(q.choices?.length).toBeGreaterThan(1);
  });

  it('se lit quoi que contienne la base', () => {
    expect(normalizeNeeds(null)).toEqual({ answers: {}, ask: [] });
    expect(normalizeNeeds({ answers: { a: 'x', b: 3, c: ['y', 4] }, ask: ['a', 'a', 2] })).toEqual({ answers: { a: 'x', c: ['y'] }, ask: ['a'] });
    expect(normalizeNeeds([])).toEqual({ answers: {}, ask: [] });
  });

  it('une réponse vidée disparaît, et ne compte plus', () => {
    let needs = setAnswer({}, 'activity', 'Fleuriste');
    expect(needsProgress(needs).answered).toBe(1);
    needs = setAnswer(needs, 'activity', '   ');
    expect(needs.answers).toEqual({});
    expect(needsProgress(needs)).toEqual({ answered: 0, total: NEED_QUESTIONS.length });
  });

  it('les choix se cochent et se décochent, rangés dans l’ordre du questionnaire', () => {
    let needs = toggleChoice({}, goals, 'Prendre des commandes');
    needs = toggleChoice(needs, goals, 'Être trouvé sur Google');
    expect(needs.answers.goals).toEqual(['Être trouvé sur Google', 'Prendre des commandes']);
    needs = toggleChoice(needs, goals, 'Prendre des commandes');
    needs = toggleChoice(needs, goals, 'Être trouvé sur Google');
    expect(needs.answers.goals).toBeUndefined();
  });

  it('une question à demander au client cesse de l’être une fois répondue', () => {
    let needs = toggleAsk({}, 'photos');
    needs = toggleAsk(needs, 'domain');
    expect(askedQuestions(needs).map((q) => q.key)).toEqual(['photos', 'domain']);
    needs = setAnswer(needs, 'photos', 'Lou, avant le 10');
    expect(askedQuestions(needs).map((q) => q.key)).toEqual(['domain']);
    needs = toggleAsk(needs, 'domain');
    expect(askedQuestions(needs)).toEqual([]);
  });

  it('compare deux états, sans tenir compte de l’ordre des marques', () => {
    expect(sameNeeds({ ask: ['a', 'b'], answers: { x: 'y' } }, { ask: ['b', 'a'], answers: { x: 'y' } })).toBe(true);
    expect(sameNeeds({}, { answers: { x: 'y' } })).toBe(false);
    expect(sameNeeds({}, { answers: {}, ask: [] })).toBe(true);
  });
});
