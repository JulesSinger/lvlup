import { useEffect, useRef, useState } from 'react';
import { getRank } from '../lib/ranks';
import { GOAL_TEMPLATES } from '../lib/templates';
import { AuthScreen } from './AuthScreen';

/**
 * Page d'accueil publique — ce que voit quelqu'un qui reçoit le lien.
 *
 * Elle doit répondre en dix secondes à « c'est quoi, et pourquoi j'y vais ? ».
 * Trois partis pris :
 *  · montrer l'échelle plutôt que la décrire — quatre rangs en grand, pas dix
 *    alignés en miniature ;
 *  · montrer le produit — un aperçu fidèle de l'écran d'accueil, construit en
 *    HTML plutôt qu'en capture, donc toujours à jour et net sur tout écran ;
 *  · assumer ce qui différencie Zénith des traqueurs d'habitudes : ici rien ne
 *    se perd et rien ne punit.
 */

/** Les quatre rangs montrés en grand : l'échelle se comprend sans la lister.
 *  On finit sur Challenger — le sommet doit être visible, pas sous-entendu. */
const SHOWCASE = ['bronze', 'argent', 'or', 'challenger'] as const;

/** L'exemple concret : un vrai modèle de la bibliothèque, pas une invention. */
const EXAMPLE = GOAL_TEMPLATES.find((t) => t.id === 'semi')!;

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

export function Landing() {
  const [showAuth, setShowAuth] = useState(false);
  const root = useReveal();

  if (showAuth) return <AuthScreen onBack={() => setShowAuth(false)} />;

  const start = () => setShowAuth(true);

  return (
    <div className="lp" ref={root}>
      <div className="lp-aurora" aria-hidden="true" />

      <header className="lp-nav">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Zénith</span>
        </div>
        {/* Deux libellés : le long sur ordinateur, le court sur téléphone. Un
            seul jeu de mots ne peut pas tenir sur 320 px sans se replier. */}
        <div className="lp-nav-actions">
          <button className="btn btn-sm" onClick={start} aria-label="Se connecter">
            <span className="lp-wide">Se connecter</span>
            <span className="lp-narrow">Connexion</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={start}
            aria-label="Créer mon compte"
          >
            <span className="lp-wide">Créer mon compte</span>
            <span className="lp-narrow">Commencer</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ héros */}
      <section className="lp-hero">
        <span className="lp-eyebrow" data-reveal>
          Gratuit · sans publicité · tes objectifs restent privés
        </span>
        <h1 className="lp-title" data-reveal>
          Tes objectifs,
          <br />
          <span className="lp-title-accent">rang par rang.</span>
        </h1>
        <p className="lp-sub" data-reveal>
          Découpe ce que tu veux accomplir en étapes atteignables. Chaque étape franchie te fait
          monter d'un rang — et ton rang ne redescend jamais.
        </p>
        <div className="lp-cta-row" data-reveal>
          <button className="btn btn-primary lp-cta" onClick={start}>
            Commencer — c'est gratuit
          </button>
          <a className="lp-cta-ghost" href="#comment">
            Voir comment ça marche ↓
          </a>
        </div>

        {/* l'échelle, en grand : la montée se voit, elle ne se lit pas */}
        <div className="lp-ladder-wrap" data-reveal>
          <div className="lp-ladder" aria-label="Bronze, puis Argent, puis Or, jusqu'à Challenger">
            {SHOWCASE.map((id, i) => {
              const rank = getRank(id);
              return (
                <div className="lp-rank" key={id} style={{ ['--d' as string]: `${i * 0.13}s` }}>
                  <span
                    className="lp-crest"
                    style={{
                      background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})`,
                      color: rank.ink,
                      boxShadow: `0 10px 30px ${rank.color}44, 0 0 40px ${rank.color}33`,
                    }}
                    aria-hidden="true"
                  >
                    {rank.label.charAt(0).toUpperCase()}
                  </span>
                  <span className="lp-rank-name" style={{ color: rank.color2 }}>
                    {rank.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="lp-ladder-more">
            Dix rangs en tout — Fer, Platine, Émeraude, Diamant, Maître… jusqu'au sommet.
          </p>
        </div>
      </section>

      {/* -------------------------------------------- l'exemple + l'aperçu */}
      <section className="lp-showcase" id="comment">
        <div className="lp-example" data-reveal>
          <span className="lp-kicker">Un objectif devient une ascension</span>
          <h2 className="lp-h2">
            {EXAMPLE.emoji} {EXAMPLE.title}
          </h2>
          <p className="lp-p">
            Le sommet fait peur. La première marche, non. Zénith découpe l'objectif en étapes
            mesurables — on sait toujours si c'est fait, et ce qui vient après.
          </p>
          <ol className="lp-steps">
            {EXAMPLE.tiers.map((t, i) => {
              const rank = getRank(['bronze', 'argent', 'or', 'challenger'][i] as 'bronze');
              return (
                <li key={t} style={{ ['--d' as string]: `${i * 0.09}s` }}>
                  <span
                    className="lp-step-crest"
                    style={{
                      background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="lp-step-title">{t}</span>
                  <span className="lp-step-rank" style={{ color: rank.color2 }}>
                    {rank.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* aperçu fidèle de l'écran d'accueil, en HTML */}
        <div className="lp-preview" data-reveal aria-hidden="true">
          <div className="lp-preview-glow" />
          <div className="lp-app">
            <div className="lp-app-top">
              <span className="lp-app-dot" />
              <span className="lp-app-dot" />
              <span className="lp-app-dot" />
            </div>
            <div className="lp-app-body">
              <div className="lp-app-hero">
                <svg viewBox="0 0 196 196" className="lp-ring">
                  <circle cx="98" cy="98" r="84" fill="none" stroke="#262e40" strokeWidth="14" />
                  <circle
                    cx="98"
                    cy="98"
                    r="84"
                    fill="none"
                    stroke="url(#lpGrad)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="527.8"
                    strokeDashoffset="132"
                  />
                  <defs>
                    <linearGradient id="lpGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#b9812a" />
                      <stop offset="1" stopColor="#f2c14e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="lp-ring-center">
                  <b>30</b>
                  <span>/ 40 PP</span>
                </div>
                <div className="lp-app-side">
                  <div className="lp-app-h">Plus que 10 PP</div>
                  <div className="lp-app-flame">
                    <span className="lp-fire">🔥</span>
                    <b>12</b>
                    <i>jours d'affilée</i>
                  </div>
                </div>
              </div>
              <div className="lp-app-label">Aujourd'hui</div>
              <div className="lp-app-chips">
                <span className="lp-chip done">Sortie course ✓</span>
                <span className="lp-chip done">Lire 20 pages ✓</span>
                <span className="lp-chip">Méditer 10 min +15</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- les 3 piliers */}
      <section className="lp-pillars">
        {[
          {
            icon: '🪜',
            title: 'Des étapes, pas un mur',
            text: "Autant d'étapes que tu veux, de la plus accessible à la plus ambitieuse. Les rangs se répartissent tout seuls.",
          },
          {
            icon: '🔥',
            title: 'Un geste par jour',
            text: 'Coche ce que tu as fait, la journée se boucle, le streak avance. Un jour manqué ? Un gel ❄ te couvre.',
          },
          {
            icon: '🏔️',
            title: 'Une carrière, pas une to-do',
            text: 'Ton rang de profil résume tout ce que tu construis. Dans six mois, tu reliras ton ascension.',
          },
        ].map((p, i) => (
          <article className="lp-pillar" key={p.title} data-reveal style={{ ['--d' as string]: `${i * 0.08}s` }}>
            <span className="lp-pillar-icon" aria-hidden="true">
              {p.icon}
            </span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </article>
        ))}
      </section>

      {/* ------------------------------------------------ la promesse */}
      <section className="lp-promise" data-reveal>
        <h2 className="lp-h2">Ce que Zénith ne fera jamais</h2>
        <p className="lp-p lp-p-center">
          La plupart des applications d'habitudes punissent : cases vides, séries brisées, points
          retirés. C'est ce qui fait abandonner. Ici, jamais.
        </p>
        <ul className="lp-nevers">
          <li>
            <b>Ton rang ne redescend jamais.</b> Ce qui est acquis est acquis.
          </li>
          <li>
            <b>Aucun point n'est retiré.</b> Un mauvais jour ne coûte rien.
          </li>
          <li>
            <b>Pas de calendrier accusateur.</b> Tu ne dois de comptes à personne.
          </li>
          <li>
            <b>Un jour manqué est couvert.</b> Les gels existent pour ça.
          </li>
        </ul>
      </section>

      {/* --------------------------------------------------- appel final */}
      <section className="lp-final" data-reveal>
        <h2 className="lp-final-title">Les grands objectifs se gagnent une étape à la fois.</h2>
        <button className="btn btn-primary lp-cta" onClick={start}>
          Créer mon compte
        </button>
        <p className="lp-note">
          Gratuit, sans publicité. Personne d'autre que toi ne voit tes objectifs.
        </p>
      </section>
    </div>
  );
}
