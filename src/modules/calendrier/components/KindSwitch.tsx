export interface Kind {
  /** `event` pour un événement du calendrier, sinon le nom technique du module qui crée */
  id: string;
  label: string;
}

interface Props {
  kinds: readonly Kind[];
  current: string;
  onChange: (id: string) => void;
}

/**
 * « Événement / Tâche », en haut de la fenêtre de création (06/10/2026) :
 * sur un même créneau, créer un événement du calendrier ou une chose d'un
 * autre module — la fenêtre de ce module prend alors le relais, avec le jour,
 * l'heure et la durée du créneau.
 */
export function KindSwitch({ kinds, current, onChange }: Props) {
  return (
    <div className="calendrier-kinds" role="radiogroup" aria-label="Créer">
      {kinds.map((k) => (
        <button
          key={k.id}
          type="button"
          role="radio"
          aria-checked={k.id === current}
          className={`calendrier-kind${k.id === current ? ' on' : ''}`}
          onClick={() => k.id !== current && onChange(k.id)}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
