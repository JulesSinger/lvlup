/**
 * Zénith — envoi des rappels quotidiens (Edge Function Supabase, Deno).
 *
 * Trois modes d'appel :
 *
 *  · PING — corps `{"ping":true}`. Ne touche à rien, répond ce qui est
 *    configuré. C'est le premier appel à faire quand quelque chose cloche :
 *    il distingue « fonction pas déployée » de « fonction déployée mais mal
 *    réglée », ce qu'un message d'erreur générique ne saura jamais dire.
 *
 *  · TEST — corps `{"test":true}` avec le jeton de l'utilisateur. Envoie
 *    immédiatement une notification à ses appareils, sans condition. C'est le
 *    bouton « Tester » de l'app.
 *
 *  · CRON — corps `{}` avec la clé de service. Parcourt les profils dont
 *    l'heure locale vient de passer, écarte ceux qui ont déjà agi, envoie aux
 *    autres.
 *
 * Secrets à définir (Supabase > Edge Functions > Secrets) :
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:toi@exemple.fr)
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies automatiquement.
 *
 * À déployer avec --no-verify-jwt : la vérification est faite ici, ce qui
 * permet à la requête préliminaire CORS (OPTIONS, sans jeton) de passer.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendWebPush } from './webpush.ts';

const VERSION = '2026-08-06.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';

/**
 * En-têtes CORS.
 *
 * Sans eux, l'appel depuis le navigateur échoue avant même d'arriver ici : le
 * navigateur envoie d'abord un OPTIONS (parce que la requête porte un en-tête
 * Authorization), et si cette requête préliminaire n'est pas acceptée, le POST
 * n'est jamais émis. C'est exactement ce qui faisait échouer le bouton
 * « Tester » quelle que soit la qualité du reste.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

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

/** L'heure du rappel vient-elle de passer ? (gère le passage de minuit) */
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
    const status = await sendWebPush({
      subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload: JSON.stringify(payload),
      vapid: { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE, subject: VAPID_SUBJECT },
      ttl: 3600,
    });

    if (status === 404 || status === 410) {
      // Le navigateur a révoqué l'abonnement : il ne reviendra jamais.
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
      return { ok: false, detail: `abonnement expiré (${status})` };
    }
    if (status >= 400) {
      await admin
        .from('push_subscriptions')
        .update({ failures: 1 })
        .eq('id', sub.id);
      return { ok: false, detail: `le service de push a répondu ${status}` };
    }

    await admin
      .from('push_subscriptions')
      .update({ last_sent_at: new Date().toISOString(), failures: 0 })
      .eq('id', sub.id);
    return { ok: true, detail: `envoyé (${status})` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('push failed', sub.endpoint.slice(0, 48), detail);
    return { ok: false, detail };
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

  const { count: tierCount } = await admin
    .from('tiers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', `${day}T00:00:00Z`)
    .lte('completed_at', `${day}T23:59:59Z`);
  return (tierCount ?? 0) > 0;
}

/** Longueur de la série en cours, pour choisir le ton du message. */
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
      body: 'Une action avant minuit et la série continue.',
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
  // La requête préliminaire du navigateur : elle doit réussir sans jeton.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'POST attendu', version: VERSION }, 405);
  }

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // ---------------------------------------------------------------- ping
  // Volontairement ouvert et sans secret : il ne renvoie que des booléens,
  // jamais une valeur de clé.
  if (body?.ping === true) {
    return json({
      ok: true,
      version: VERSION,
      config: {
        vapidPublic: VAPID_PUBLIC.length > 0,
        vapidPrivate: VAPID_PRIVATE.length > 0,
        vapidSubject: VAPID_SUBJECT.length > 0,
        serviceKey: SERVICE_KEY.length > 0,
        supabaseUrl: SUPABASE_URL.length > 0,
      },
      // Les 8 premiers caractères suffisent à vérifier que la clé publique du
      // serveur est bien celle qui est dans le build de l'app.
      vapidPublicPrefix: VAPID_PUBLIC.slice(0, 8),
    });
  }

  const missing = [
    !VAPID_PUBLIC && 'VAPID_PUBLIC_KEY',
    !VAPID_PRIVATE && 'VAPID_PRIVATE_KEY',
    !VAPID_SUBJECT && 'VAPID_SUBJECT',
  ].filter(Boolean);
  if (missing.length > 0) {
    return json(
      { error: `Secrets manquants : ${missing.join(', ')}`, version: VERSION },
      500,
    );
  }

  try {
    // ---------------------------------------------------------------- test
    if (body?.test === true) {
      if (!token) return json({ error: 'Aucun jeton reçu.' }, 401);
      if (token === SERVICE_KEY) {
        return json({ error: 'Le mode test attend le jeton d’un utilisateur.' }, 401);
      }
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      const userId = userData?.user?.id;
      if (!userId) {
        return json({ error: `Session invalide : ${userError?.message ?? 'jeton refusé'}` }, 401);
      }

      const subs = await subscriptionsFor([userId]);
      if (subs.length === 0) {
        return json(
          { error: "Aucun appareil abonné pour ce compte. Active d'abord l'interrupteur." },
          404,
        );
      }

      const results = [];
      for (const sub of subs) {
        results.push(
          await push(sub, {
            title: '✅ Les rappels fonctionnent',
            body: "C'est exactement ce que tu recevras à l'heure choisie.",
            tag: 'zenith-test',
            url: '/',
          }),
        );
      }
      const sent = results.filter((r) => r.ok).length;
      if (sent === 0) {
        return json(
          {
            error: `Aucun envoi n'a abouti : ${results.map((r) => r.detail).join(' · ')}`,
            devices: subs.length,
            sent: 0,
            version: VERSION,
          },
          502,
        );
      }
      return json({ mode: 'test', devices: subs.length, sent, version: VERSION });
    }

    // ---------------------------------------------------------------- cron
    if (token !== SERVICE_KEY) {
      return json({ error: 'Clé de service attendue pour le mode planifié.' }, 401);
    }

    const { data: profiles, error } = await admin
      .from('profiles')
      .select('user_id, reminder_enabled, reminder_time, tz_offset, last_reminder_day')
      .eq('reminder_enabled', true);
    if (error) return json({ error: error.message }, 500);

    const now = new Date();
    const due: { profile: ProfileRow; day: string }[] = [];
    for (const profile of (profiles ?? []) as ProfileRow[]) {
      const { day, minutes } = localNow(profile.tz_offset ?? 0, now);
      if (profile.last_reminder_day === day) continue; // déjà prévenu aujourd'hui
      if (!isDue(minutes, parseTime(profile.reminder_time))) continue;
      due.push({ profile, day });
    }
    if (due.length === 0) {
      return json({ mode: 'cron', candidates: 0, sent: 0, version: VERSION });
    }

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
        const result = await push(device, {
          title,
          body: text,
          tag: 'zenith-rappel',
          url: '/',
        });
        if (result.ok) sent += 1;
      }
      await admin
        .from('profiles')
        .update({ last_reminder_day: day })
        .eq('user_id', profile.user_id);
    }

    return json({ mode: 'cron', candidates: due.length, sent, skipped, version: VERSION });
  } catch (error) {
    // Une erreur non prévue doit remonter lisible plutôt que se transformer en
    // « échec » anonyme côté app.
    const detail = error instanceof Error ? error.message : String(error);
    console.error('send-reminders', detail);
    return json({ error: detail, version: VERSION }, 500);
  }
});
