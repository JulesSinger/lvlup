/**
 * La couleur d'un projet, pour le reconnaître d'un coup d'œil dans les listes
 * mêlées (cette semaine, retards). Tirée de son numéro : stable, sans rien à
 * stocker. Des variables de la palette, donc juste en clair comme en sombre.
 */
const PALETTE = ['--pink', '--coral', '--sky', '--teal', '--violet', '--lime', '--orange', '--lavender', '--green', '--yellow'];

export function projectColor(number: number): string {
  return `var(${PALETTE[(Math.max(1, number) - 1) % PALETTE.length]})`;
}
