import { useContext } from 'react';
import { ModuleChromeContext } from './DemoChrome';

/**
 * Le nom du module, en haut de son écran — et la porte vers les autres.
 *
 * Toucher « 💶 Budget ▾ » ouvre la grille des modules (`ModuleSwitcher`) :
 * c'est le seul accès sur téléphone, où la barre d'icônes n'a pas la place
 * (décision de Jules, 30/09/2026). Chaque écran de module l'utilise à la
 * place de sa marque ; `conventions.test.ts` le vérifie. Depuis le
 * 15/10/2026, un « ? » à côté ouvre la démo du module, quand il en a une —
 * prêté par le socle (`ModuleChromeContext`), sans rien demander aux écrans.
 */
export function ModuleBrand({
  label,
  emoji,
  onSwitchModule,
  className = '',
}: {
  label: string;
  emoji: string;
  onSwitchModule: () => void;
  className?: string;
}) {
  const { onDemo } = useContext(ModuleChromeContext);
  const brand = (
    <button
      type="button"
      // Avec le « ? », la classe de l'écran passe au conteneur : une marque cachée l'est avec son « ? ».
      className={`brand atlas-module-brand ${onDemo ? '' : className}`.trim()}
      onClick={onSwitchModule}
      aria-haspopup="dialog"
      aria-label={`Changer de module — ${label}`}
      title="Changer de module"
    >
      <span className="brand-mark">{emoji}</span>
      <span className="brand-name">{label}</span>
      <span className="atlas-module-brand-chevron" aria-hidden="true">
        ▾
      </span>
    </button>
  );
  if (!onDemo) return brand;
  return (
    <span className={`atlas-module-brand-wrap ${className}`.trim()}>
      {brand}
      <button type="button" className="atlas-demo-help" onClick={onDemo} aria-label={`Voir la démo de ${label}`} title="Voir la démo">
        ?
      </button>
    </span>
  );
}
