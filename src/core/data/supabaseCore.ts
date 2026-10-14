import type { SupabaseClient } from '@supabase/supabase-js';
import { needsSecondFactor, readTotpCode } from '../lib/mfa';
import type { AppUser } from '../lib/types';
import {
  DEFAULT_SETTINGS,
  type CoreStore,
  type McpToken,
  type PushDevice,
  type PushDeviceInput,
  type PushDiagnostic,
  type ReminderInput,
  type SecondFactor,
  type SecondFactorEnrollment,
  type Settings,
} from './coreStore';
import { fetchAll, getClient, isolatedClient, requireUserId, unwrap } from './supabaseClient';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/**
 * Socle sur Supabase : comptes, réglages et abonnements aux notifications.
 * Le Row Level Security de `supabase/schema.sql` garantit côté serveur que
 * chaque compte ne voit que ses propres lignes.
 */
export class SupabaseCore implements CoreStore {
  readonly isRemote = true;
  private client: SupabaseClient;

  private url: string;
  private anonKey: string;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
    this.url = url;
    this.anonKey = anonKey;
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }


  async getUser(): Promise<AppUser | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '', isLocal: false };
  }


  onUserChange(callback: (user: AppUser | null) => void) {
    // On s'appuie uniquement sur onAuthStateChange : l'événement INITIAL_SESSION
    // arrive une fois la session restaurée (et le jeton rafraîchi si besoin).
    // L'ancien appel parallèle à getUser() créait une course : sur un appareil
    // au jeton expiré, sa réponse « null » pouvait arriver APRÈS la session
    // restaurée et l'écraser — d'où des écrans vides au réveil de l'app.
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? '', isLocal: false, needsSecondFactor: needsSecondFactor(session) }
          : null,
      );
    });
    return () => data.subscription.unsubscribe();
  }


  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    // Sans session renvoyée, Supabase attend une confirmation par e-mail.
    return { needsConfirmation: !data.session };
  }


  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }


  async signOut() {
    await this.client.auth.signOut();
  }


  async resetPassword(email: string) {
    // Supabase renvoie l'utilisateur sur l'app avec un jeton de récupération ;
    // `onPasswordRecovery` prend alors le relais côté interface.
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw new Error(error.message);
  }


  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }


  onPasswordRecovery(callback: () => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') callback();
    });
    return () => data.subscription.unsubscribe();
  }


  async getSettings(): Promise<Settings> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('profiles')
      // `*` plutôt qu'une liste : avant la migration du 13/10/2026, `module_order`
      // n'existe pas, et la nommer ferait échouer la lecture de tous les réglages.
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_SETTINGS };
    return {
      dailyGoal: data.daily_goal ?? DEFAULT_SETTINGS.dailyGoal,
      reminderEnabled: data.reminder_enabled ?? DEFAULT_SETTINGS.reminderEnabled,
      reminderTime: data.reminder_time ?? DEFAULT_SETTINGS.reminderTime,
      tzOffset: data.tz_offset ?? DEFAULT_SETTINGS.tzOffset,
      moduleOrder: Array.isArray(data.module_order) ? data.module_order : DEFAULT_SETTINGS.moduleOrder,
    };
  }


  async updateSettings(patch: Partial<Settings>) {
    const userId = await this.requireUserId();
    const row: Record<string, unknown> = { user_id: userId };
    if (patch.dailyGoal !== undefined) row.daily_goal = patch.dailyGoal;
    if (patch.reminderEnabled !== undefined) row.reminder_enabled = patch.reminderEnabled;
    if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
    if (patch.tzOffset !== undefined) row.tz_offset = patch.tzOffset;
    if (patch.moduleOrder !== undefined) row.module_order = patch.moduleOrder;
    const { error } = await this.client
      .from('profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
  }


  async listPushDevices(): Promise<PushDevice[]> {
    const rows = unwrap(
      await this.client
        .from('push_subscriptions')
        .select('id, endpoint, label, created_at')
        .order('created_at', { ascending: true }),
    ) as { id: string; endpoint: string; label: string; created_at: string }[];
    return rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      label: r.label || 'Appareil',
      createdAt: r.created_at,
    }));
  }


  async savePushDevice(input: PushDeviceInput) {
    const userId = await this.requireUserId();
    // `endpoint` est unique : ré-abonner le même appareil met à jour ses clés
    // au lieu de créer un doublon qui recevrait la notification deux fois.
    const { error } = await this.client.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        label: input.label,
        failures: 0,
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw new Error(error.message);
  }


  async removePushDevice(endpoint: string) {
    const { error } = await this.client
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    if (error) throw new Error(error.message);
  }


  async sendTestPush(): Promise<{ sent: number; devices: number }> {
    const data = await this.callReminders({ test: true });
    return { sent: Number(data.sent ?? 0), devices: Number(data.devices ?? 0) };
  }


  async scheduleReminders(module: string, reminders: readonly ReminderInput[]) {
    const userId = await this.requireUserId();
    // Les rappels pas encore envoyés du module sont remplacés ; ceux déjà
    // partis restent, et la clé unique (user, module, ref, instant) empêche
    // de les reposer : redéclarer un rappel envoyé ne le renvoie pas.
    check((await this.client.from('reminders').delete().eq('module', module).is('sent_at', null)).error);
    if (reminders.length === 0) return;
    check(
      (
        await this.client.from('reminders').upsert(
          reminders.map((r) => ({
            user_id: userId,
            module,
            ref: r.ref,
            fire_at: r.fireAt,
            title: r.title,
            body: r.body,
            url: r.url ?? '/',
          })),
          { onConflict: 'user_id,module,ref,fire_at', ignoreDuplicates: true },
        )
      ).error,
    );
  }


  async pingPushFunction(): Promise<PushDiagnostic> {
    const data = await this.callReminders({ ping: true });
    const config = (data.config ?? {}) as Record<string, boolean>;
    return {
      reachable: true,
      version: String(data.version ?? '?'),
      vapidPublic: Boolean(config.vapidPublic),
      vapidPrivate: Boolean(config.vapidPrivate),
      vapidSubject: Boolean(config.vapidSubject),
      serverKeyPrefix: String(data.vapidPublicPrefix ?? ''),
    };
  }


  /**
   * Appelle l'Edge Function en remontant la VRAIE raison d'un échec.
   *
   * `functions.invoke` se contente d'un message générique ; le détail est dans
   * la réponse HTTP, qu'il faut aller relire. Sans ça, « l'envoi a échoué »
   * recouvre aussi bien une fonction absente qu'un secret oublié — et on
   * cherche à l'aveugle.
   */
  private async callReminders(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.functions.invoke('send-reminders', { body });
    if (!error) return (data ?? {}) as Record<string, unknown>;

    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `La fonction a répondu ${response.status}.`);
    }
    // Pas de réponse du tout : la requête n'a pas abouti. C'est soit une
    // fonction non déployée, soit un refus avant même d'atteindre le code
    // (vérification du jeton sur la requête préliminaire CORS).
    throw new Error(
      "La fonction « send-reminders » n'a pas répondu. Vérifie qu'elle est déployée, " +
        'et déployée avec l’option --no-verify-jwt.',
    );
  }

  async listMcpTokens(): Promise<McpToken[]> {
    const rows = await fetchAll<McpTokenRow>((first, last) =>
      this.client.from('mcp_tokens').select('id, label, created_at, last_used_at').order('created_at').order('id').range(first, last),
    );
    return rows.map(toMcpToken);
  }

  async createMcpToken(tokenHash: string, label: string): Promise<McpToken> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('mcp_tokens')
        .insert({ user_id: userId, token_hash: tokenHash, label })
        .select('id, label, created_at, last_used_at')
        .single(),
    ) as McpTokenRow;
    return toMcpToken(row);
  }

  async deleteMcpToken(id: string) {
    unwrap(await this.client.from('mcp_tokens').delete().eq('id', id));
  }

  // --- Double authentification (docs/securite.md §7) ---------------------------

  async listSecondFactors(): Promise<SecondFactor[]> {
    const { data, error } = await this.client.auth.mfa.listFactors();
    check(error);
    return (data?.totp ?? []).map((f) => ({ id: f.id, label: f.friendly_name ?? 'App d’authentification', createdAt: f.created_at }));
  }

  async enrollSecondFactor(): Promise<SecondFactorEnrollment> {
    // Un ajout abandonné laisse un facteur non vérifié : on le retire, sinon
    // Supabase refuse d'en créer un autre du même nom.
    const { data: listed } = await this.client.auth.mfa.listFactors();
    for (const f of listed?.all ?? []) {
      if (f.status !== 'verified') await this.client.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await this.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Atlas ${new Date().toISOString().slice(0, 10)}` });
    check(error);
    if (!data) throw new Error('Supabase n’a rien rendu.');
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  async confirmSecondFactor(factorId: string, code: string) {
    const digits = readTotpCode(code);
    if (!digits) throw new Error('Le code a six chiffres.');
    const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId, code: digits });
    if (error) throw new Error('Code refusé : vérifie l’heure du téléphone, et prends le code affiché maintenant.');
  }

  async verifySecondFactor(code: string) {
    const digits = readTotpCode(code);
    if (!digits) throw new Error('Le code a six chiffres.');
    const factors = await this.listSecondFactors();
    if (factors.length === 0) throw new Error('Aucune app d’authentification sur ce compte.');
    // Plusieurs apps reliées (un téléphone et une tablette) : le code vaut pour l'une d'elles.
    for (const f of factors) {
      const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId: f.id, code: digits });
      if (!error) return;
    }
    throw new Error('Code refusé : prends le code affiché maintenant dans ton app d’authentification.');
  }

  async removeSecondFactor(factorId: string) {
    const { error } = await this.client.auth.mfa.unenroll({ factorId });
    check(error);
    // Le jeton garde l'ancien niveau tant qu'il n'est pas renouvelé.
    await this.client.auth.refreshSession();
  }

  // --- Supprimer son compte (docs/securite.md §8) --------------------------------

  async deleteAccount(password: string, code: string | null) {
    const { data: current } = await this.client.auth.getUser();
    const email = current.user?.email;
    if (!email) throw new Error('Aucun compte connecté.');
    // Le mot de passe (et le code) redonnés dans une session à part : la
    // fonction exige une preuve de moins de dix minutes, et la session ouverte
    // n'est pas touchée tant que rien n'est effacé.
    const proof = isolatedClient(this.url, this.anonKey);
    const { data: signed, error: signInError } = await proof.auth.signInWithPassword({ email, password });
    if (signInError || !signed.session) throw new Error('Mot de passe incorrect.');
    const { data: listed } = await proof.auth.mfa.listFactors();
    const factors = listed?.totp ?? [];
    if (factors.length > 0) {
      const digits = code ? readTotpCode(code) : null;
      if (!digits) throw new Error('Donne aussi le code de ton app d’authentification.');
      let verified = false;
      for (const f of factors) {
        const { error } = await proof.auth.mfa.challengeAndVerify({ factorId: f.id, code: digits });
        if (!error) {
          verified = true;
          break;
        }
      }
      if (!verified) throw new Error('Code refusé : prends le code affiché maintenant.');
    }
    const { error } = await proof.functions.invoke('account-delete', { body: { confirm: true } });
    if (error) {
      const response = (error as { context?: Response }).context;
      const payload = response && typeof response.json === 'function' ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      throw new Error(payload?.error ?? 'La suppression n’a pas abouti : réessaie.');
    }
    // Le compte n'existe plus : on ferme la session de l'appareil, sans prévenir le serveur.
    await this.client.auth.signOut({ scope: 'local' });
  }

}

interface McpTokenRow {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

const toMcpToken = (r: McpTokenRow): McpToken => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at });
