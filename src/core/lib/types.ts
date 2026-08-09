/** Types du socle, communs à tous les modules. */

export interface AppUser {
  id: string;
  email: string;
  /** true quand les données vivent seulement dans ce navigateur */
  isLocal: boolean;
}
