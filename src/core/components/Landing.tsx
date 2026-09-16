import { useEffect, useRef, useState } from 'react';
import type { AtlasModule } from '../lib/module';
import { AuthScreen } from './AuthScreen';
import { StarField } from './StarField';

/**
 * Page d'accueil publique — ce que voit quelqu'un qui reçoit le lien.
 *
 * Longtemps portée par le seul module objectifs (voir le journal de
 * CLAUDE.md, 2026-09-16) : elle vivait dans `modules/objectifs/`, pitchait
 * Zénith seul, et `App.tsx` gardait une exception documentée pour l'importer
 * quand même. Remontée ici une fois d'autres modules devenus visibles —
 * elle ne connaît plus aucun domaine. `modules` lui arrive en prop depuis
 * `App.tsx` (même motif que `ModulePicker`), et elle ne lit de chacun que ce
 * qu'il déclare de lui-même (`label`, `description`, `emoji`, `accent`,
 * `LandingPreview`). Ajouter un module ne touche jamais ce fichier : sa
 * carte apparaît toute seule.
 *
 * `StarField` derrière le héros : l'« effet wow » demandé par Jules (voir le
 * journal de CLAUDE.md, 2026-09-16), choisi après comparaison avec une
 * sphère armillaire en 3D CSS — champ d'étoiles, pas de librairie.
 */

/** Révèle les sections au défilement, sauf si l'utilisateur préfère l'immobilité. */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll('[data-reveal]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((t) => t.classList.add('shown'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('shown');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return root;
}

export function Landing({ modules }: { modules: readonly AtlasModule[] }) {
  /** `null` = on est encore sur la présentation. Sinon, le formulaire demandé. */
  const [auth, setAuth] = useState<'signin' | 'signup' | null>(null);
  const root = useReveal();

  if (auth) return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} />;

  const signUp = () => setAuth('signup');
  const signIn = () => setAuth('signin');

  return (
    <div className="lp" ref={root}>
      <div className="lp-aurora" aria-hidden="true" />

      <header className="lp-nav">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Atlas</span>
        </div>
        {/* Deux libellés : le long sur ordinateur, le court sur téléphone. Un
            seul jeu de mots ne peut pas tenir sur 320 px sans se replier. */}
        <div className="lp-nav-actions">
          <button className="btn btn-sm" onClick={signIn} aria-label="Se connecter">
            <span className="lp-wide">Se connecter</span>
            <span className="lp-narrow">Connexion</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={signUp}
            aria-label="Créer mon compte"
          >
            <span className="lp-wide">Créer mon compte</span>
            <span className="lp-narrow">Commencer</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ héros */}
      <section className="lp-hero">
        <StarField />
        <h1 className="lp-title" data-reveal>
          Un ciel, <span className="lp-title-accent">plusieurs constellations.</span>
        </h1>
        <p className="lp-sub" data-reveal>
          Atlas rassemble ce que tu suis au quotidien dans un seul endroit qui t'appartient.
          Chaque domaine a son module, sa logique, son rythme. Rien ne se mélange, rien ne se
          perd.
        </p>
        <div className="lp-cta-row" data-reveal>
          <button className="btn btn-primary lp-cta" onClick={signUp}>
            Commencer — c'est gratuit
          </button>
          <a className="lp-cta-ghost" href="#modules">
            Voir les modules ↓
          </a>
        </div>
      </section>

      {/* --------------------------------------------------------- modules */}
      <section className="lp-modules" id="modules">
        <div className="lp-modules-head" data-reveal>
          <span className="lp-kicker">
            {modules.length} module{modules.length > 1 ? 's' : ''} aujourd'hui, d'autres en
            préparation
          </span>
          <h2 className="lp-h2">Un module par domaine, jamais mélangés</h2>
        </div>

        <div className="lp-modules-grid">
          {modules.map((m, i) => (
            <article
              className="lp-module-card"
              key={m.id}
              data-reveal
              style={{ ['--d' as string]: `${i * 0.08}s`, ['--accent' as string]: m.accent }}
            >
              <span className="lp-module-glyph" aria-hidden="true">
                {m.emoji}
              </span>
              <span className="lp-module-name">{m.label}</span>
              <p className="lp-module-desc">{m.description}</p>
              {m.LandingPreview && (
                <div className="lp-module-preview">
                  <m.LandingPreview />
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- appel final */}
      <section className="lp-final" data-reveal>
        <h2 className="lp-final-title">
          Plusieurs façons de progresser. Un seul endroit pour les tenir.
        </h2>
        <button className="btn btn-primary lp-cta" onClick={signUp}>
          Créer mon compte
        </button>
      </section>
    </div>
  );
}
