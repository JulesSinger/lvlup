import { useEffect, useRef, useState } from 'react';
import type { AtlasModule } from '../lib/module';
import { demoHref } from '../lib/demo';
import { applyTheme } from '../lib/theme';
import { AuthScreen } from './AuthScreen';
import { StarField } from './StarField';
import AtlasMark from './AtlasMark';

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
 *
 * Remise à jour le 26/10/2026, demande de Jules (« il y a eu beaucoup de
 * changements ») : la page disait encore « rien ne se mélange » alors que les
 * modules se parlent, et ne montrait ni les démos, ni Claude, ni le hors
 * ligne. Elle reste sans domaine : les démos viennent de `AtlasModule.demo`,
 * les liens entre modules de `AtlasModule.landingLinks`, chacun dit par son
 * module ; seul ce que le socle fait pour tous (ci-dessous) est écrit ici.
 */

/** Ce que le socle apporte à tous les modules. */
const FEATURES: { icon: string; title: string; text: string }[] = [
  {
    icon: '✳️',
    title: 'Claude, branché sur Atlas',
    text: "Relie Claude par un connecteur : dicte une tâche, envoie la photo d'un ticket de caisse, fais programmer ta semaine d'entraînement ou demande le bilan du mois.",
  },
  {
    icon: '📴',
    title: 'Même sans réseau',
    text: 'Une coche, un repas, une tâche notés hors ligne partent dès que la connexion revient. Rien de ce que tu saisis ne se perd.',
  },
  {
    icon: '📱',
    title: 'Dans ta poche',
    text: "S'installe sur l'écran d'accueil de l'iPhone comme une app, avec des rappels en notification : un rendez-vous, une tâche, une échéance.",
  },
  {
    icon: '🧭',
    title: 'À ta mesure',
    text: 'Choisis tes modules, range-les dans ton ordre, passe en mode « au travail » pour ne garder que le nécessaire. Clair ou sombre, comme ton appareil.',
  },
  {
    icon: '🔒',
    title: 'Tes données, à toi',
    text: 'Double authentification, chaque compte cloisonné, une sauvegarde complète en un fichier, et ton compte supprimé en un geste si tu pars.',
  },
  {
    icon: '🎁',
    title: 'Gratuit, pour de bon',
    text: "Ni abonnement, ni publicité, ni palier qui expire. C'est une règle d'Atlas : une fonction qui demanderait de payer n'est pas retenue.",
  },
];

/** Un nombre écrit en toutes lettres jusqu'à vingt, en chiffres au-delà. */
const WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'];
function inWords(n: number): string {
  return WORDS[n] ?? String(n);
}

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

  // La présentation reste sombre quel que soit le thème choisi : le champ
  // d'étoiles et le halo n'ont de sens que sur un ciel de nuit. Le thème
  // choisi revient dès qu'on la quitte, formulaire de connexion compris.
  const presenting = auth === null;
  useEffect(() => {
    if (!presenting) return;
    document.documentElement.dataset.themeForced = 'dark';
    applyTheme(undefined, 'dark');
    return () => {
      delete document.documentElement.dataset.themeForced;
      applyTheme();
    };
  }, [presenting]);

  if (auth) return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} />;

  const signUp = () => setAuth('signup');
  const signIn = () => setAuth('signin');

  const byId = new Map(modules.map((m) => [m.id, m]));
  const withDemo = modules.filter((m) => m.demo);
  // Seuls les liens dont les deux bouts sont au registre : un module retiré
  // n'emporte pas une promesse qui ne tient plus.
  const links = modules.flatMap((from) =>
    (from.landingLinks ?? []).flatMap((link) => {
      const to = byId.get(link.to);
      return to && to.id !== from.id ? [{ from, to, text: link.text }] : [];
    }),
  );
  const count = inWords(modules.length);

  return (
    <div className="lp" ref={root}>
      <div className="lp-aurora" aria-hidden="true" />

      <header className="lp-nav">
        <div className="brand">
          <AtlasMark />
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
          Tes tâches, ton agenda, tes courses, ton budget, ton sport, tes recettes… {count}{' '}
          modules dans un seul endroit qui t'appartient. Chacun a sa logique ; ensemble, ils se
          répondent.
        </p>
        <div className="lp-cta-row" data-reveal>
          <button className="btn btn-primary lp-cta" onClick={signUp}>
            Commencer — c'est gratuit
          </button>
          <a className="lp-cta-ghost" href="#modules">
            {withDemo.length > 0 ? 'Essayer sans compte ↓' : 'Voir les modules ↓'}
          </a>
        </div>
        <ul className="lp-facts" data-reveal aria-label="En bref">
          <li>
            <b>{modules.length}</b> modules
          </li>
          {withDemo.length > 0 && (
            <li>
              <b>{withDemo.length}</b> démos sans compte
            </li>
          )}
          <li>hors ligne</li>
          <li>sur iPhone</li>
          <li>avec Claude</li>
        </ul>
      </section>

      {/* --------------------------------------------------------- modules */}
      <section className="lp-modules" id="modules">
        <div className="lp-modules-head" data-reveal>
          <span className="lp-kicker">
            {modules.length} module{modules.length > 1 ? 's' : ''} — prends ceux qui te servent
          </span>
          <h2 className="lp-h2">Un module par domaine de ta vie</h2>
          {withDemo.length > 0 && (
            <p className="lp-section-sub">
              Ceux marqués d'une démo s'essaient tout de suite, sur des exemples : rien n'est
              enregistré, aucun compte n'est demandé.
            </p>
          )}
        </div>

        <div className="lp-modules-grid">
          {modules.map((m, i) => (
            <article
              className="lp-module-card"
              key={m.id}
              data-reveal
              style={{ ['--d' as string]: `${(i % 3) * 0.08}s`, ['--accent' as string]: m.accent }}
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
              {m.demo && (
                <a className="lp-module-demo" href={demoHref(m.id)}>
                  Essayer la démo <span aria-hidden="true">→</span>
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ les liens entre modules */}
      {links.length > 0 && (
        <section className="lp-links">
          <div className="lp-modules-head" data-reveal>
            <span className="lp-kicker">Les modules se parlent</span>
            <h2 className="lp-h2">Ce que tu notes à un endroit sert ailleurs</h2>
          </div>
          <ul className="lp-links-list">
            {links.map(({ from, to, text }, i) => (
              <li
                className="lp-link"
                key={`${from.id}-${to.id}`}
                data-reveal
                style={{ ['--d' as string]: `${(i % 2) * 0.06}s` }}
              >
                <span className="lp-link-pair">
                  <span className="lp-link-end" style={{ ['--accent' as string]: from.accent }}>
                    <span aria-hidden="true">{from.emoji}</span> {from.label}
                  </span>
                  <span className="lp-link-arrow" aria-label="vers">
                    →
                  </span>
                  <span className="lp-link-end" style={{ ['--accent' as string]: to.accent }}>
                    <span aria-hidden="true">{to.emoji}</span> {to.label}
                  </span>
                </span>
                <span className="lp-link-text">{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ ce qui vaut pour tous */}
      <section className="lp-features">
        <div className="lp-modules-head" data-reveal>
          <span className="lp-kicker">Pour tous les modules</span>
          <h2 className="lp-h2">Ce qu'Atlas fait pour chacun</h2>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div className="lp-feature" key={f.title} data-reveal style={{ ['--d' as string]: `${(i % 3) * 0.08}s` }}>
              <span className="lp-feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-text">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- appel final */}
      <section className="lp-final" data-reveal>
        <h2 className="lp-final-title">Tout ce que tu suis, au même endroit.</h2>
        <p className="lp-final-sub">Commence par deux ou trois modules ; les autres t'attendent.</p>
        <button className="btn btn-primary lp-cta" onClick={signUp}>
          Créer mon compte
        </button>
      </section>
    </div>
  );
}
