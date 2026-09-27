/**
 * Aperçu de Polaris sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une journée d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const TASKS = [
  { title: 'Appeler le garage', detail: '9 h', done: true, urgent: false },
  { title: 'Déclarer les impôts', detail: 'avant le 30', done: false, urgent: true },
  { title: 'Arroser les plantes', detail: 'tous les 5 jours', done: false, urgent: false },
];

export function PolarisLandingPreview() {
  return (
    <div className="taches-landing-preview">
      <div className="taches-landing-day">Aujourd’hui</div>
      {TASKS.map((t) => (
        <div key={t.title} className={`taches-landing-task${t.done ? ' done' : ''}`}>
          <span className="taches-landing-check" aria-hidden="true">
            {t.done ? '✓' : ''}
          </span>
          <span className="taches-landing-title">{t.title}</span>
          <span className={`taches-landing-detail${t.urgent ? ' urgent' : ''}`}>{t.detail}</span>
        </div>
      ))}
    </div>
  );
}
