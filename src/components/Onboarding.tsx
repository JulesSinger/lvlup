import { useState } from 'react';
import { getRank, suggestRanks } from '../lib/ranks';
import { GOAL_TEMPLATES, type GoalTemplate } from '../lib/templates';
import type { GoalInput, TierInput } from '../lib/types';
import { RankBadge } from './RankBadge';

/**
 * Parcours de première connexion : trois écrans qui expliquent le principe,
 * puis un premier objectif pré-rempli et modifiable. On ne laisse jamais un
 * nouveau venu devant un écran vide.
 */

const STARTER_IDS = ['semi', 'lecture', 'ecrans'] as const;
const STARTER_LABELS: Record<string, string> = {
  semi: 'Sport',
  lecture: 'Lecture',
  ecrans: 'Écrans',
};

/** Les trois modèles d'accueil, puisés dans la bibliothèque commune. */
const STARTERS = STARTER_IDS.map((id) => {
  const t = GOAL_TEMPLATES.find((g) => g.id === id) as GoalTemplate;
  return { label: STARTER_LABELS[id], emoji: t.emoji, title: t.title, tiers: t.tiers };
});

const SLIDES = [
  {
    icon: '🪜',
    title: 'Un objectif, des paliers',
    body: "Découpe ce que tu veux accomplir en étapes, de la plus accessible à la plus ambitieuse. « Courir un marathon » commence par 10 km — pas par 42.",
  },
  {
    icon: '🛡️',
    title: 'Chaque palier vaut un rang',
    body: "Fer, Bronze, Argent… jusqu'à Challenger. Le rang d'un objectif est celui de ton plus haut palier validé, et il ne redescend jamais. La moyenne de tes objectifs donne ton rang de profil.",
  },
  {
    icon: '🔥',
    title: 'Un geste par jour',
    body: 'Le check-in quotidien entretient ton streak et rapporte des points. Un jour manqué est couvert par un gel ❄ — ici on récompense la constance, on ne punit pas les absences.',
  },
];

export function Onboarding({
  onFinish,
  onSkip,
}: {
  onFinish: (goal: GoalInput, tiers: TierInput[]) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [starter, setStarter] = useState(0);
  const [title, setTitle] = useState(STARTERS[0].title);

  const isLast = step === SLIDES.length;
  const current = STARTERS[starter];
  const ranks = suggestRanks(current.tiers.length);

  function pickStarter(index: number) {
    setStarter(index);
    setTitle(STARTERS[index].title);
  }

  function create() {
    const clean = title.trim() || current.title;
    onFinish(
      { title: clean, description: '', emoji: current.emoji },
      current.tiers.map((t, i) => ({ title: t, rank: ranks[i] })),
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        {!isLast ? (
          <>
            <div className="onboarding-icon" aria-hidden="true">
              {SLIDES[step].icon}
            </div>
            <h2 className="onboarding-title">{SLIDES[step].title}</h2>
            <p className="onboarding-body">{SLIDES[step].body}</p>
          </>
        ) : (
          <>
            <h2 className="onboarding-title">Ton premier objectif</h2>
            <p className="onboarding-body">
              Choisis un point de départ — tu pourras tout modifier ensuite, ou créer les tiens.
            </p>

            <div className="starter-tabs">
              {STARTERS.map((s, i) => (
                <button
                  key={s.label}
                  className={`starter-tab${i === starter ? ' active' : ''}`}
                  onClick={() => pickStarter(i)}
                >
                  <span aria-hidden="true">{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>

            <div className="field" style={{ textAlign: 'left', marginTop: 14 }}>
              <label htmlFor="starter-title">Intitulé</label>
              <input
                id="starter-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>

            <ul className="starter-preview">
              {current.tiers.map((t, i) => (
                <li key={t}>
                  <span className="starter-preview-title">{t}</span>
                  <RankBadge rank={getRank(ranks[i])} />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="onboarding-dots" aria-hidden="true">
          {[...SLIDES, null].map((_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="onboarding-actions">
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>
            Passer
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button className="btn btn-sm" onClick={() => setStep(step - 1)}>
                Retour
              </button>
            )}
            {isLast ? (
              <button className="btn btn-primary" onClick={create}>
                Créer et commencer
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                Suivant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
