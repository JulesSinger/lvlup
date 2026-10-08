/**
 * Atlas — une recette depuis un lien (Edge Function Supabase, Deno ;
 * docs/etude-recettes.md §3.1, §16).
 *
 * Le navigateur ne peut pas lire la page d'un site de recettes (aucun
 * n'autorise une autre adresse à le faire) : cette fonction va la chercher,
 * en extrait la recette (schema.org, `extract.ts`) et rapporte la photo. Elle
 * n'écrit RIEN : elle rend un brouillon, que Jules relit dans la fenêtre de la
 * recette avant d'enregistrer.
 *
 * Appel : POST `{ "url": "https://…" }` avec le jeton de session de
 * l'utilisateur (`supabase.functions.invoke` le met). Sans jeton valide : 401
 * — la fonction ne sert de relais à personne. `{ "ping": true }` sans jeton
 * dit la version.
 *
 * Réponse : `{ draft, image }`, `image` = `{ base64, type }` ou null ; ou
 * `{ error }` avec une phrase à montrer telle quelle.
 *
 * À déployer avec --no-verify-jwt : la requête préliminaire du navigateur
 * (OPTIONS) n'a pas de jeton ; la vérification est faite ici.
 *   supabase functions deploy recettes-import --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractRecipe } from './extract.ts';
import { MAX_IMAGE_BYTES, MAX_PAGE_BYTES, MAX_REDIRECTS, TIMEOUT_MS, checkUrl, isPrivateIp, toBase64 } from './safety.ts';

const VERSION = '2026-10-08.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Le nom de domaine ne doit pas mener à une adresse privée (quand le système sait le résoudre). */
async function resolvesPublicly(host: string): Promise<boolean> {
  for (const type of ['A', 'AAAA'] as const) {
    try {
      const ips = await Deno.resolveDns(host, type);
      if (ips.some(isPrivateIp)) return false;
    } catch {
      // Pas d'enregistrement de ce type, ou résolution indisponible : la vérification littérale reste.
    }
  }
  return true;
}

/**
 * Va chercher une adresse en suivant au plus trois redirections, chacune
 * revérifiée, et lit au plus `max` octets.
 */
async function fetchLimited(raw: string, max: number, accept: string): Promise<{ bytes: Uint8Array; type: string; url: string } | { error: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = checkUrl(current);
    if ('error' in checked) return checked;
    if (!(await resolvesPublicly(checked.url.hostname))) return { error: 'Cette adresse n’est pas publique.' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(checked.url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; Atlas-Recettes/1.0; usage personnel)' },
      });
    } catch {
      clearTimeout(timer);
      return { error: 'Le site ne répond pas (ou trop lentement).' };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      current = new URL(res.headers.get('location')!, checked.url).toString();
      continue;
    }
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      return { error: `Le site a répondu ${res.status}.` };
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > max) {
      clearTimeout(timer);
      return { error: 'La page est trop lourde.' };
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) {
          await reader.cancel();
          return { error: 'La page est trop lourde.' };
        }
        chunks.push(value);
      }
    } finally {
      clearTimeout(timer);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    return { bytes, type: res.headers.get('content-type') ?? '', url: checked.url.toString() };
  }
  return { error: 'Trop de redirections.' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'POST attendu', version: VERSION }, 405);

  const body = (await request.json().catch(() => ({}))) as { url?: unknown; ping?: unknown };
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token && body.ping === true) return json({ ok: true, version: VERSION });

  // Un compte connecté, et lui seul : sinon la fonction servirait de relais à n'importe qui.
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: 'Connecte-toi pour importer une recette depuis un lien.' }, 401);

  if (typeof body.url !== 'string' || body.url.length > 2000) return json({ error: 'Colle l’adresse de la recette.' }, 400);
  const page = await fetchLimited(body.url, MAX_PAGE_BYTES, 'text/html,application/xhtml+xml');
  if ('error' in page) return json({ error: page.error }, 422);
  if (!/html|xml/i.test(page.type)) return json({ error: 'Cette adresse n’est pas une page web.' }, 422);

  const html = new TextDecoder().decode(page.bytes);
  const draft = extractRecipe(html, page.url);
  if (!draft) {
    return json({ error: 'Cette page ne décrit pas sa recette de façon lisible : copie le texte de la recette et colle-le.' }, 422);
  }

  // La photo : rapportée pour être réduite et rangée chez nous. Un échec n'empêche pas la recette.
  let image: { base64: string; type: string } | null = null;
  if (draft.imageUrl) {
    const got = await fetchLimited(draft.imageUrl, MAX_IMAGE_BYTES, 'image/*');
    if (!('error' in got) && got.type.startsWith('image/')) image = { base64: toBase64(got.bytes), type: got.type.split(';')[0] };
  }
  return json({ draft, image, version: VERSION });
});
