/** Types du socle, communs à tous les modules. */

export interface AppUser {
  id: string;
  email: string;
  /** true quand les données vivent seulement dans ce navigateur */
  isLocal: boolean;
  /**
   * Mot de passe donné, code de la double authentification pas encore :
   * l'app demande le code avant de montrer quoi que ce soit (docs/securite.md §7).
   */
  needsSecondFactor?: boolean;
}
