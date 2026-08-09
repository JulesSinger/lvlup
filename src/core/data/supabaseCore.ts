import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from '../lib/types';
import {
  DEFAULT_SETTINGS,
  type CoreStore,
  type PushDevice,
  type PushDeviceInput,
  type PushDiagnostic,
  type Settings,
} from './coreStore';
import { getClient, requireUserId, unwrap } from './supabaseClient';

/**
 * Socle sur Supabase : comptes, réglages et abonnements aux notifications.
 * Le Row Level Security de `supabase/schema.sql` garantit côté serveur que
 * chaque compte ne voit que ses propres lignes.
 */
export class SupabaseCore implements CoreStore {
  readonly isRemote = true;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
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
          ? { id: session.user.id, email: session.user.email ?? '', isLocal: false }
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
      .select('daily_goal, reminder_enabled, reminder_time, tz_offset')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_SETTINGS };
    return {
      dailyGoal: data.daily_goal ?? DEFAULT_SETTINGS.dailyGoal,
      reminderEnabled: data.reminder_enabled ?? DEFAULT_SETTINGS.reminderEnabled,
      reminderTime: data.reminder_time ?? DEFAULT_SETTINGS.reminderTime,
      tzOffset: data.tz_offset ?? DEFAULT_SETTINGS.tzOffset,
    };
  }


  async updateSettings(patch: Partial<Settings>) {
    const userId = await this.requireUserId();
    const row: Record<string, unknown> = { user_id: userId };
    if (patch.dailyGoal !== undefined) row.daily_goal = patch.dailyGoal;
    if (patch.reminderEnabled !== undefined) row.reminder_enabled = patch.reminderEnabled;
    if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
    if (patch.tzOffset !== undefined) row.tz_offset = patch.tzOffset;
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
}
