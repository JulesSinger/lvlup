import { createContext } from 'react';

/**
 * Ce que le socle prête aux écrans des modules sans passer par chacun
 * (15/10/2026) : le « ? » de la démo, à côté du nom du module (`ModuleBrand`).
 */
export const ModuleChromeContext = createContext<{ label?: string; onDemo?: () => void }>({});

/** En démo : ce qu'on regarde, et comment en sortir. */
export function DemoBar({ label, emoji, onReplay, onExit }: { label: string; emoji: string; onReplay: () => void; onExit: () => void }) {
  return (
    <div className="atlas-demo-bar" role="status">
      <span>
        {emoji} <b>Démo de {label}</b> — des exemples ; rien n’est enregistré dans ton compte.
      </span>
      <span className="atlas-demo-bar-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReplay}>
          Revoir la visite
        </button>
        <button type="button" className="btn btn-sm" onClick={onExit}>
          Quitter la démo
        </button>
      </span>
    </div>
  );
}

/** À la première ouverture d'un module : une démo est proposée, une fois. */
export function DemoOffer({ label, emoji, onAccept, onDismiss }: { label: string; emoji: string; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="atlas-demo-offer" role="status">
      <span>
        {emoji} Première fois dans {label} ? Une démo d’une minute, sur des exemples.
      </span>
      <span className="atlas-demo-bar-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Non merci
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onAccept}>
          Voir la démo
        </button>
      </span>
    </div>
  );
}
