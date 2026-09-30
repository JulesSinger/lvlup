import type { HautsFaitsSettings } from '../lib/types';

/**
 * La date de naissance se règle dans le panneau commun (la section du
 * module), pendant que l'écran reste ouvert derrière : ce signal, propre au
 * module, lui dit de relire ses réglages. Le socle n'en sait rien.
 */
type Listener = (settings: HautsFaitsSettings) => void;

const listeners = new Set<Listener>();

export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function settingsChanged(settings: HautsFaitsSettings) {
  for (const listener of listeners) listener(settings);
}
