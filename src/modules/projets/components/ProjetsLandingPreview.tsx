/**
 * Aperçu de Projets sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — des projets d'exemple, jamais ceux d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const PROJECTS = [
  { client: 'Fleurs de Lou', doing: 'Recette · Mise en ligne', progress: 70 },
  { client: 'Le Camion Gourmand', doing: 'Maquette · Développement', progress: 35 },
  { client: 'Mèche Rebelle', doing: 'Découverte', progress: 12 },
];

export function ProjetsLandingPreview() {
  return (
    <div className="projets-landing-preview">
      {PROJECTS.map((p) => (
        <div key={p.client} className="projets-landing-project">
          <span className="projets-landing-client">{p.client}</span>
          <span className="projets-landing-doing">{p.doing}</span>
          <span className="projets-landing-bar" aria-hidden="true">
            <span style={{ width: `${p.progress}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
