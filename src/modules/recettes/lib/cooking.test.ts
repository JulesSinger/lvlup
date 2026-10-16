import { describe, expect, it } from 'vitest';
import { pause, remaining, resume, stepIngredients, stepWithAmounts, yieldText, type RunningTimer } from './cooking';

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

describe('les quantités dans le texte des étapes (16/10/2026)', () => {
  const ing = (text: string) => ({ text, section: null });
  const cote = ['1 côte de porc', '80 g de riz basmati', '1 c. à soupe d’huile d’olive', '10 g de beurre', '1/2 échalote', '1 c. à soupe de moutarde de Dijon', '4 c. à soupe de crème fraîche', '1/2 c. à café de sel', '1/4 c. à café de poivre'].map(ing);
  const render = (pieces: { text: string; amount?: string }[]) => pieces.map((p) => p.text + (p.amount ? ` (${p.amount})` : '')).join('');

  it('écrit la quantité juste après l’ingrédient nommé', () => {
    expect(render(stepWithAmounts('Chauffer l’huile et le beurre dans une poêle à feu vif.', cote, 1))).toBe('Chauffer l’huile (1 c. à soupe) et le beurre (10 g) dans une poêle à feu vif.');
  });

  it('après tout le nom, une fois par ingrédient, et ajustée au nombre de personnes', () => {
    expect(render(stepWithAmounts('Ajouter la moutarde et la crème fraîche, puis encore de la crème.', cote, 2))).toBe(
      'Ajouter la moutarde (2 c. à soupe) et la crème fraîche (8 c. à soupe), puis encore de la crème.',
    );
    expect(render(stepWithAmounts('Faire fondre l’échalote émincée.', cote, 1))).toBe('Faire fondre l’échalote (1/2) émincée.');
  });

  it('ne dit rien pour « 1 » sans unité, ni pour une étape qui ne nomme rien', () => {
    expect(render(stepWithAmounts('Saisir la côte.', cote, 1))).toBe('Saisir la côte.');
    expect(stepWithAmounts('Servir.', cote, 1)).toEqual([{ text: 'Servir.' }]);
  });
});

describe('ce que donne la recette, accordé', () => {
  it('au singulier pour une personne, sans toucher un mot qui finit en « ss »', () => {
    expect(yieldText(1, 'personnes')).toBe('1 personne');
    expect(yieldText(2, 'personnes')).toBe('2 personnes');
    expect(yieldText(1, 'parts')).toBe('1 part');
  });
});
