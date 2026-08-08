import { describe, expect, it } from 'vitest';
import { GOAL_TEMPLATES, TEMPLATE_CATEGORIES, type GoalTemplate } from './templates';
import { tierProgress } from './counters';
import { suggestRanks } from './ranks';
import { JALON } from './types';

/**
 * La bibliothèque est du contenu, pas du code — c'est justement pour ça
 * qu'elle a besoin de garde-fous. Une étape mal qualifiée ne plante rien :
 * elle valide un palier trop tôt, ou reste muette pour toujours. Les deux se
 * découvrent des semaines plus tard, en usage réel.
 */

const allTiers = GOAL_TEMPLATES.flatMap((t) => t.tiers.map((tier) => ({ tier, template: t })));

describe('cohérence de la bibliothèque', () => {
  it('propose au moins trois modèles par catégorie', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const count = GOAL_TEMPLATES.filter((t) => t.category === category).length;
      expect(count, `catégorie ${category}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('n’a ni identifiant ni titre en double', () => {
    const ids = GOAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const titles = GOAL_TEMPLATES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('donne à chaque modèle des étapes et des actions', () => {
    for (const t of GOAL_TEMPLATES) {
      expect(t.tiers.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.actions.length, t.id).toBeGreaterThanOrEqual(1);
      expect(suggestRanks(t.tiers.length)).toHaveLength(t.tiers.length);
    }
  });
});

/**
 * Le garde-fou le plus important du fichier : un modèle peut être
 * irréprochable côté paliers et rester **inatteignable** parce qu'aucune de
 * ses actions ne porte la quantité que ces paliers comptent. Rien ne plante,
 * la barre reste simplement à zéro pour toujours.
 */
describe('les actions nourrissent bien les paliers', () => {
  it('tout palier en kilomètres, euros ou mots a une action qui en porte', () => {
    for (const t of GOAL_TEMPLATES) {
      const needed = new Set(
        t.tiers
          .filter((tier) => tier.kind === 'cumul' || tier.kind === 'performance')
          .map((tier) => tier.unit as string),
      );
      for (const unit of needed) {
        const source = t.actions.find(
          (a) => a.unit === unit && typeof a.defaultValue === 'number' && a.defaultValue > 0,
        );
        expect(source, `${t.id} : aucune action ne porte des « ${unit} »`).toBeTruthy();
      }
    }
  });

  it('tout palier de mesure a un relevé pour l’alimenter', () => {
    for (const t of GOAL_TEMPLATES) {
      const measures = t.tiers.filter((tier) => tier.kind === 'mesure');
      if (measures.length === 0) continue;
      for (const tier of measures) {
        const source = t.actions.find((a) => a.isMeasure && a.unit === tier.unit);
        expect(source, `${t.id} : aucun relevé en « ${tier.unit} »`).toBeTruthy();
      }
    }
  });

  it('un relevé ne rapporte jamais plus qu’un petit geste', () => {
    // Sinon on farmerait des PP sur une balance.
    for (const t of GOAL_TEMPLATES) {
      for (const a of t.actions.filter((x) => x.isMeasure)) {
        expect(a.pp, `${t.id} / ${a.title}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('une action quantifiée annonce toujours une valeur habituelle', () => {
    // Une unité sans valeur habituelle, c'est un clavier à chaque coche.
    for (const t of GOAL_TEMPLATES) {
      for (const a of t.actions.filter((x) => x.unit && !x.isMeasure)) {
        expect(a.defaultValue, `${t.id} / ${a.title}`).toBeGreaterThan(0);
      }
    }
  });

  it('trois séries de dix ne font jamais trente pompes', () => {
    // Le doute de Jules, vérifié sur le vrai modèle : cocher « Ma meilleure
    // série » trois jours de suite doit laisser le palier « 30 pompes
    // d'affilée » à 10, pas le faire monter à 30.
    const pompes = GOAL_TEMPLATES.find((t) => t.id === 'pompes');
    expect(pompes).toBeTruthy();
    const actions = (pompes as GoalTemplate).actions.map((a, i) => ({
      id: `a${i}`,
      goalId: 'g',
      title: a.title,
      pp: a.pp,
      position: i,
      archived: false,
      createdAt: '2026-01-01',
      unit: a.unit ?? '',
      defaultValue: a.defaultValue ?? null,
      isMeasure: a.isMeasure ?? false,
    }));
    const last = (pompes as GoalTemplate).tiers[(pompes as GoalTemplate).tiers.length - 1];
    const tier = {
      id: 't',
      goalId: 'g',
      rank: 'or' as const,
      position: 0,
      completedAt: null,
      createdAt: '2026-01-01',
      ...JALON,
      ...last,
    };
    const checkins = ['2026-08-06', '2026-08-07', '2026-08-08'].map((day) => ({
      id: day,
      goalId: 'g',
      actionId: 'a0',
      pp: 10,
      day,
      note: '',
      createdAt: `${day}T09:00:00.000Z`,
      value: null,
      title: null,
    }));
    const p = tierProgress(tier, actions, checkins, '2026-08-08');
    expect(p?.current).toBe(10);
    expect(p?.reached).toBe(false);
  });

  it('un palier qui compte des jours n’est jamais nourri par un relevé seul', () => {
    // « 30 jours sans écran » ne doit pas avancer parce qu'on s'est pesé.
    for (const t of GOAL_TEMPLATES) {
      const countsDays = t.tiers.some((tier) => tier.kind === 'compte' || tier.kind === 'serie');
      if (!countsDays) continue;
      expect(t.actions.some((a) => !a.isMeasure), t.id).toBe(true);
    }
  });
});

describe('qualification des étapes', () => {
  it('donne une cible strictement positive à toute étape comptable', () => {
    for (const { tier, template } of allTiers) {
      if (!tier.kind || tier.kind === 'jalon') continue;
      const label = `${template.id} — ${tier.title}`;
      expect(typeof tier.target, label).toBe('number');
      if (tier.kind === 'mesure') {
        // Une mesure en delta peut viser vers le bas (« perdre 5 kg » = −5).
        expect(tier.target, label).not.toBe(0);
      } else {
        expect(tier.target, label).toBeGreaterThan(0);
      }
      expect(tier.unit, label).toBeTruthy();
    }
  });

  it('fait toujours monter la cible d’une étape à la suivante', () => {
    // Une échelle qui redescend voudrait dire qu'un palier plus prestigieux
    // est plus facile que le précédent.
    for (const template of GOAL_TEMPLATES) {
      const suite = template.tiers.filter((t) => t.kind && t.kind !== 'jalon');
      for (let i = 1; i < suite.length; i++) {
        if (suite[i].kind !== suite[i - 1].kind) continue;
        const label = `${template.id} — ${suite[i - 1].title} → ${suite[i].title}`;
        const a = Math.abs(suite[i - 1].target as number);
        const b = Math.abs(suite[i].target as number);
        expect(b, label).toBeGreaterThanOrEqual(a);
      }
    }
  });

  it('réserve la série aux paliers dont la consécutivité est le sens même', () => {
    // Le cumul est le défaut : un jour manqué qui efface quarante jours
    // d'efforts est le mode d'échec le mieux documenté du domaine. Seuls le
    // tabac et l'alcool y échappent, parce que là c'est la réalité mesurée.
    const series = allTiers.filter(({ tier }) => tier.kind === 'serie');
    expect(series.length).toBeGreaterThan(0);
    for (const { template } of series) {
      expect(['tabac', 'alcool'], `${template.id} ne devrait pas utiliser serie()`).toContain(
        template.id,
      );
    }
  });

  it('ne laisse plus aucun intitulé promettre une série qu’on ne compte pas', () => {
    for (const { tier } of allTiers) {
      if (tier.kind === 'serie') continue;
      expect(tier.title.toLowerCase(), tier.title).not.toContain('de suite');
      expect(tier.title.toLowerCase(), tier.title).not.toContain("d'affilée jours");
    }
  });

  it('ne transforme jamais une performance en cumul', () => {
    // Le piège central : deux sorties de 5 km ne font pas un 10 km. Toute
    // étape qui décrit une seule séance doit être une performance.
    const uneSeule = /d'une traite|sans pause|sans m'arrêter|d'affilée|une randonnée/i;
    for (const { tier, template } of allTiers) {
      if (!uneSeule.test(tier.title)) continue;
      expect(tier.kind, `${template.id} — ${tier.title}`).toBe('performance');
    }
  });

  it('compte les jours plutôt que de les sommer', () => {
    // « 30 jours » additionné en quantités renverrait zéro : les coches n'ont
    // pas de valeur numérique.
    for (const { tier, template } of allTiers) {
      if (!/^\d+ (jours|nuits)\b/i.test(tier.title)) continue;
      expect(['compte', 'serie'], `${template.id} — ${tier.title}`).toContain(tier.kind);
    }
  });

  it('mesure ce qui se mesure plutôt que de le compter', () => {
    for (const { tier, template } of allTiers) {
      if (!/^perdre \d/i.test(tier.title)) continue;
      const label = `${template.id} — ${tier.title}`;
      expect(tier.kind, label).toBe('mesure');
      expect(tier.direction, label).toBe('baisse');
      expect(tier.target, label).toBeLessThan(0);
    }
  });
});

describe('l’objectif de poids, cas d’école', () => {
  const poids = GOAL_TEMPLATES.find((t) => t.id === 'poids')!;

  it('suit une grandeur et non une accumulation d’actions', () => {
    expect(poids.tiers.every((t) => t.kind === 'mesure')).toBe(true);
    expect(poids.tiers.map((t) => t.target)).toEqual([-2, -5, -8, -12]);
  });

  it('garde une action de relevé pour alimenter la courbe', () => {
    expect(poids.actions.some((a) => /pesée/i.test(a.title))).toBe(true);
  });
});
