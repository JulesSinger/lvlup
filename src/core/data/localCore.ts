import type { AppUser } from '../lib/types';
import { DEFAULT_SETTINGS, type CoreStore, type PushDiagnostic, type Settings } from './coreStore';
import { readRaw, writeRaw } from './localSnapshot';

const LOCAL_USER: AppUser = { id: 'local', email: 'Mode local', isLocal: true };

/**
 * Socle en mode local : pas de compte, pas de serveur. Un utilisateur unique
 * et fictif, et des notifications inertes — elles supposent un serveur.
 */
export class LocalCore implements CoreStore {
  readonly isRemote = false;


  async getUser() {
    return LOCAL_USER;
  }


  onUserChange(callback: (user: AppUser | null) => void) {
    callback(LOCAL_USER);
    return () => {};
  }


  async signUp() {
    return { needsConfirmation: false };
  }

  async signIn() {}

  async signOut() {}


  // Sans compte, il n'y a pas de mot de passe à réinitialiser ni de serveur
  // pour envoyer des notifications : ces méthodes existent pour respecter le
  // contrat et disent clairement pourquoi elles ne font rien.
  async resetPassword() {
    throw new Error("Le mode local n'a pas de compte : rien à réinitialiser.");
  }

  async updatePassword() {
    throw new Error("Le mode local n'a pas de mot de passe.");
  }

  onPasswordRecovery() {
    return () => {};
  }


  async getSettings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...((readRaw().settings as Partial<Settings>) ?? {}) };
  }


  async updateSettings(patch: Partial<Settings>) {
    const snapshot = readRaw();
    snapshot.settings = { ...DEFAULT_SETTINGS,
      ...((snapshot.settings as Partial<Settings>) ?? {}), ...patch };
    writeRaw(snapshot);
  }


  async listPushDevices() {
    return [];
  }

  async savePushDevice() {
    throw new Error('Les rappels demandent un compte : connecte-toi pour les activer.');
  }

  async removePushDevice() {}

  async sendTestPush(): Promise<{ sent: number; devices: number }> {
    throw new Error('Les rappels demandent un compte.');
  }

  async pingPushFunction(): Promise<PushDiagnostic> {
    throw new Error('Les rappels demandent un compte.');
  }
}
