/**
 * Le nom du module, en haut de son écran — et la porte vers les autres.
 *
 * Toucher « 💶 Budget ▾ » ouvre la grille des modules (`ModuleSwitcher`) :
 * c'est le seul accès sur téléphone, où la barre d'icônes n'a pas la place
 * (décision de Jules, 30/09/2026). Chaque écran de module l'utilise à la
 * place de sa marque ; `conventions.test.ts` le vérifie.
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
  return (
    <button
      type="button"
      className={`brand atlas-module-brand ${className}`.trim()}
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
}
