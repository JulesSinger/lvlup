import { describe, expect, it } from 'vitest';
import { pause, remaining, resume, stepIngredients, type RunningTimer } from './cooking';

const ings = ['1 paquet de lasagnes', '3 oignons jaunes', "2 gousses d'ail", '1 branche de céleri', '600 g de boeuf haché', '15 cl d’eau', 'sel', 'Pour la béchamel :', '1 l de lait'].map((text) => ({ text, section: null }));

describe('les ingrédients d’une étape', () => {
  it('par leur mot principal, sans accents ni pluriel', () => {
    const t = (step: string) => stepIngredients(step, ings).map((i) => i.text);
    expect(t("Faire revenir l'ail haché et les oignons émincés.")).toEqual(['3 oignons jaunes', "2 gousses d'ail"]);
    expect(t('Ajouter le celeri, puis le bœuf, et laisser cuire.')).toEqual(['1 branche de céleri', '600 g de boeuf haché']);
    expect(t('Verser le lait petit à petit.')).toEqual(['1 l de lait']);
    // « eau », « sel » : trop vagues pour qu'on les devine.
    expect(t("Saler et ajouter l'eau.")).toEqual([]);
    expect(t('Monter les lasagnes.')).toEqual(['1 paquet de lasagnes']);
  });
});

describe('les minuteurs', () => {
  const timer: RunningTimer = { id: 1, label: '25 minutes', endsAt: 1_500_000, pausedLeft: null };

  it('comptent contre l’horloge', () => {
    expect(remaining(timer, 0)).toBe(1500);
    expect(remaining(timer, 1_499_001)).toBe(1);
    expect(remaining(timer, 2_000_000)).toBe(0);
  });

  it('se mettent en pause et repartent', () => {
    const paused = pause(timer, 500_000);
    expect(remaining(paused, 900_000)).toBe(1000);
    const again = resume(paused, 900_000);
    expect(remaining(again, 900_000)).toBe(1000);
    expect(again.endsAt).toBe(1_900_000);
    expect(pause(paused, 1)).toBe(paused);
    expect(resume(timer, 1)).toBe(timer);
  });
});
