const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 12 mars », ou « 12 mars 2025 » hors de l'année en cours. */
export function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const label = `${d} ${MONTHS[m - 1]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${y}`;
}

/** « lun. 12 oct. » : un jour du menu. */
export function weekdayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Le nom d'un site d'après son lien, sans « www. » ; vide si le lien ne se lit pas. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
