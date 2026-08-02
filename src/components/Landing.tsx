import { useState } from 'react';
import { RANKS } from '../lib/ranks';
import { AuthScreen } from './AuthScreen';

/**
 * Page d'accueil publique — ce que voit quelqu'un qui reçoit le lien.
 * Elle doit répondre en dix secondes à « c'est quoi, et pourquoi j'y vais ? »
 * avant de proposer la création de compte.
 */
export function Landing() {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) return <AuthScreen onBack={() => setShowAuth(false)} />;

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Zénith</span>
        </div>
        <button className="btn btn-sm" onClick={() => setShowAuth(true)}>
          Se connecter
        </button>
      </header>

      <section className="landing-hero">
        <h1 className="landing-title">
          Tes objectifs,
          <br />
          rang par rang.
        </h1>
        <p className="landing-sub">
          Découpe ce que tu veux accomplir en paliers, décroche un rang à chaque étape franchie,
          et regarde ton profil monter — de Fer à Challenger.
        </p>
        <button className="btn btn-primary landing-cta" onClick={() => setShowAuth(true)}>
          Commencer — c'est gratuit
        </button>

        <div className="landing-ladder" aria-hidden="true">
          {RANKS.map((rank) => (
            <span
              key={rank.id}
              className="landing-crest"
              style={{
                background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})`,
                color: rank.ink,
              }}
              title={rank.label}
            >
              {rank.label.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-steps">
        <article className="landing-step">
          <span className="landing-step-num">1</span>
          <h2>Découpe en paliers</h2>
          <p>
            « Courir un marathon » devient : 10 km, 15 km, un semi, 30 km, puis les 42. Autant de
            paliers que tu veux, et tu choisis le rang de chacun.
          </p>
        </article>
        <article className="landing-step">
          <span className="landing-step-num">2</span>
          <h2>Coche, célèbre, monte</h2>
          <p>
            Chaque palier validé se fête, rapporte des points et fait grimper le rang de
            l'objectif. La moyenne de tes objectifs donne ton rang de profil.
          </p>
        </article>
        <article className="landing-step">
          <span className="landing-step-num">3</span>
          <h2>Reviens chaque jour</h2>
          <p>
            Un check-in quotidien en un geste entretient ton streak. Un jour manqué ? Un gel ❄ te
            couvre. Ici rien ne se perd, et ton rang ne redescend jamais.
          </p>
        </article>
      </section>

      <section className="landing-final">
        <h2>Les grands objectifs se gagnent un palier à la fois.</h2>
        <button className="btn btn-primary landing-cta" onClick={() => setShowAuth(true)}>
          Créer mon compte
        </button>
        <p className="landing-note">
          Gratuit, sans publicité. Tes objectifs ne sont visibles que par toi.
        </p>
      </section>
    </div>
  );
}
