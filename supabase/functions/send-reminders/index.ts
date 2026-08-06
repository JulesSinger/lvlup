/**
 * Zénith — envoi des rappels quotidiens (Edge Function Supabase, Deno).
 *
 * Deux modes d'appel :
 *
 *  · CRON — `Authorization: Bearer <service_role_key>`, corps `{}`.
 *    Parcourt tous les profils dont le rappel est activé, garde ceux dont
 *    l'heure locale vient de passer, écarte ceux qui ont déjà agi
 *    aujourd'hui, et envoie une notification aux appareils restants.
 *
 *  · TEST — `Authorization: Bearer <jwt utilisateur>`, corps `{"test":true}`.
 *    Envoie immédiatement une notification à l'appelant, sans aucune des
 *    conditions ci-dessus. C'est le bouton « Tester » de l'app : il permet
 *    de vérifier toute la chaîne sans attendre 20 h.
 *
 * Variables d'environnement à définir (Supabase > Edge Functions > Secrets) :
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:toi@exemple.fr)
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies automatiquement.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:zenith@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/** Fenêtre de tir : le cron passe toutes les 5 min, on tolère un peu de retard. */
const WINDOW_MINUTES = 9;

interface ProfileRow {
  user_id: string;
  reminder_enabled: boolean;
  reminder_time: string;
  tz_offset: number;
  last_reminder_day: string | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Jour et minutes locales d'un utilisateur, à partir de son décalage UTC. */
function localNow(tzOffsetMinutes: number, now = new Date()) {
  const shifted = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    day: `${y}-${m}-${d}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * L'heure du rappel vient-elle de passer ? On accepte la fenêtre
 * [heure, heure + WINDOW_MINUTES] et on gère le passage de minuit.
 */
function isDue(nowMinutes: number, targetMinutes: number): boolean {
  const delta = (nowMinutes - targetMinutes + 1440) % 1440;
  return delta < WINDOW_MINUTES;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/** Envoie une notification, et nettoie l'abonnement s'il est mort. */
async function push(sub: SubscriptionRow, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600, urgency: 'normal' },
    );
    await admin
      .from('push_subscriptions')
      .update({ last_sent_at: new Date().toISOString(), failures: 0 })
      .eq('id', sub.id);
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // 404 / 410 : le navigateur a révoqué l'abonnement, il ne reviendra pas.
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
    } else {
      const { data } = await admin
        .from('push_subscriptions')
        .select('failures')
        .eq('id', sub.id)
        .maybeSingle();
      await admin
        .from('push_subscriptions')
        .update({ failures: (data?.failures ?? 0) + 1 })
        .eq('id', sub.id);
    }
    console.error('push failed', sub.endpoint.slice(0, 40), status, String(error));
    return false;
  }
}

/** A-t-il fait quelque chose aujourd'hui ? (réalisation ou palier validé) */
async function hasActivityToday(userId: string, day: string): Promise<boolean> {
  const { count } = await admin
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('day', day);
  if ((count ?? 0) > 0) return true;

  // Un palier validé compte aussi. `completed_at` est en UTC : on compare sur
  // une plage de 48 h autour du jour local, puis on affine côté JS serait
  // superflu — la marge d'un jour suffit à ne jamais harceler quelqu'un qui
  // vient de valider un palier.
  const { count: tierCount } = await admin
    .from('tiers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', `${day}T00:00:00Z`)
    .lte('completed_at', `${day}T23:59:59Z`);
  return (tierCount ?? 0) > 0;
}

/** Le streak est-il en jeu ? Sert à choisir le ton du message. */
async function streakLength(userId: string, day: string): Promise<number> {
  const { data } = await admin
    .from('checkins')
    .select('day')
    .eq('user_id', userId)
    .lt('day', day)
    .order('day', { ascending: false })
    .limit(120);
  if (!data || data.length === 0) return 0;

  const days = [...new Set(data.map((r) => r.day as string))];
  const yesterday = new Date(`${day}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  let cursor = yesterday.toISOString().slice(0, 10);
  let streak = 0;
  for (const d of days) {
    if (d !== cursor) break;
    streak += 1;
    const prev = new Date(`${cursor}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}

function messageFor(streak: number) {
  if (streak >= 7) {
    return {
      title: `🔥 ${streak} jours d'affilée`,
      body: "Une action avant minuit et la série continue.",
    };
  }
  if (streak > 0) {
    return {
      title: `🔥 Ta série de ${streak} jour${streak > 1 ? 's' : ''} t'attend`,
      body: 'Une seule action suffit à la prolonger.',
    };
  }
  return {
    title: 'Zénith',
    body: "Une action aujourd'hui, et la série démarre.",
  };
}

async function subscriptionsFor(userIds: string[]): Promise<SubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionRow[];
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const body = await request.json().catch(() => ({}));

  // ---------------------------------------------------------------- test
  if (body?.test === true) {
    if (!token || token === SERVICE_KEY) {
      return Response.json({ error: 'jwt utilisateur requis' }, { status: 401 });
    }
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData.user?.id;
    if (!userId) return Response.json({ error: 'session invalide' }, { status: 401 });

    const subs = await subscriptionsFor([userId]);
    if (subs.length === 0) {
      return Response.json({ error: 'aucun appareil abonné' }, { status: 404 });
    }
    let sent = 0;
    for (const sub of subs) {
      const ok = await push(sub, {
        title: '✅ Les rappels fonctionnent',
        body: "C'est exactement ce que tu recevras à l'heure choisie.",
        tag: 'zenith-test',
        url: '/',
      });
      if (ok) sent += 1;
    }
    return Response.json({ mode: 'test', devices: subs.length, sent });
  }

  // ---------------------------------------------------------------- cron
  if (token !== SERVICE_KEY) {
    return Response.json({ error: 'non autorisé' }, { status: 401 });
  }

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('user_id, reminder_enabled, reminder_time, tz_offset, last_reminder_day')
    .eq('reminder_enabled', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const due: { profile: ProfileRow; day: string }[] = [];
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    const { day, minutes } = localNow(profile.tz_offset ?? 0, now);
    if (profile.last_reminder_day === day) continue; // déjà prévenu aujourd'hui
    if (!isDue(minutes, parseTime(profile.reminder_time))) continue;
    due.push({ profile, day });
  }
  if (due.length === 0) return Response.json({ mode: 'cron', candidates: 0, sent: 0 });

  const subs = await subscriptionsFor(due.map((d) => d.profile.user_id));
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const sub of subs) {
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
  }

  let sent = 0;
  let skipped = 0;
  for (const { profile, day } of due) {
    const devices = byUser.get(profile.user_id) ?? [];
    if (devices.length === 0) continue;

    if (await hasActivityToday(profile.user_id, day)) {
      // Journée déjà entamée : on ne dit rien. Un rappel inutile est la
      // meilleure façon de faire couper les notifications.
      skipped += 1;
      await admin
        .from('profiles')
        .update({ last_reminder_day: day })
        .eq('user_id', profile.user_id);
      continue;
    }

    const streak = await streakLength(profile.user_id, day);
    const { title, body: text } = messageFor(streak);
    for (const device of devices) {
      const ok = await push(device, { title, body: text, tag: 'zenith-rappel', url: '/' });
      if (ok) sent += 1;
    }
    await admin
      .from('profiles')
      .update({ last_reminder_day: day })
      .eq('user_id', profile.user_id);
  }

  return Response.json({ mode: 'cron', candidates: due.length, sent, skipped });
});
