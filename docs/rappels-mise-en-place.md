# Mettre en service les rappels quotidiens

*Cinq étapes, une seule fois. Compte ~20 minutes. Tout tient dans le gratuit :
Supabase Edge Functions et pg_cron sont inclus dans le plan Free.*

Le code est déjà en place — il ne manque que les clés et le déclencheur.

---

## Comment ça marche, en une phrase

Le navigateur (iPhone compris) donne à l'app un **abonnement push**, stocké dans
Supabase ; toutes les 5 minutes, une tâche planifiée réveille une petite fonction qui regarde
qui doit être prévenu, écarte ceux qui ont déjà agi, et envoie la notification.

C'est le standard Web Push : **le même code sert iPhone, Android et ordinateur**. La seule
différence est qu'Apple exige que l'app soit installée sur l'écran d'accueil — l'app le dit
elle-même quand c'est le cas, avec la marche à suivre.

---

## 1. Le schéma de base

Dans **Supabase Studio → SQL Editor**, colle et exécute `supabase/migration-7-rappels.sql`.

Ça crée la table `push_subscriptions` et ajoute quatre colonnes de réglage au profil. Le
fichier est idempotent : le relancer ne casse rien.

## 2. Les clés VAPID

Ce sont les deux clés qui prouvent au service de push que l'envoi vient bien de chez toi.
Génère-les une fois, en local :

```bash
npx web-push generate-vapid-keys
```

Tu obtiens une clé **publique** et une clé **privée**.

> La clé privée ne doit jamais se trouver dans le code de l'app ni dans une variable
> `VITE_*` — tout ce qui commence par `VITE_` finit dans le bundle envoyé au navigateur.

## 3. Déployer la fonction d'envoi

```bash
# une seule fois
npm install -g supabase
supabase login
supabase link --project-ref <ref-de-ton-projet>

# les secrets, côté serveur uniquement
supabase secrets set VAPID_PUBLIC_KEY="<clé publique>"
supabase secrets set VAPID_PRIVATE_KEY="<clé privée>"
supabase secrets set VAPID_SUBJECT="mailto:ton@adresse.fr"

# la fonction — l'option compte, voir ci-dessous
supabase functions deploy send-reminders --no-verify-jwt
```

> **`--no-verify-jwt` n'est pas un relâchement de sécurité.** Avant d'envoyer sa vraie requête,
> le navigateur en envoie une préliminaire (`OPTIONS`) qui, par construction, ne porte aucun
> jeton. Avec la vérification automatique de Supabase, cette requête est rejetée et l'appel
> n'aboutit jamais — quelle que soit la validité de ta session. La fonction vérifie donc
> elle-même le jeton : mode test = jeton de l'utilisateur obligatoire, mode planifié = clé de
> service obligatoire. Le seul appel non authentifié accepté est `{"ping":true}`, qui ne
> renvoie que des booléens de configuration.

### Vérifier tout de suite que la fonction répond

```bash
curl -s -X POST 'https://<PROJET>.supabase.co/functions/v1/send-reminders' \
  -H 'Content-Type: application/json' \
  -H 'apikey: <CLÉ_PUBLISHABLE>' \
  -d '{"ping":true}'
```

Réponse attendue :

```json
{"ok":true,"version":"2026-08-06.2",
 "config":{"vapidPublic":true,"vapidPrivate":true,"vapidSubject":true,
           "serviceKey":true,"supabaseUrl":true},
 "vapidPublicPrefix":"BEl62iU"}
```

Tout ce qui n'est pas ça est déjà une réponse : `404` = fonction absente, un `false` dans
`config` = secret oublié, une erreur CORS = déploiement sans `--no-verify-jwt`.

## 4. La clé publique dans le build

Sur **Cloudflare → Settings → Build → Build Variables and Secrets**, ajoute :

```
VITE_VAPID_PUBLIC_KEY = <clé publique>
```

Puis redéploie. Attention, c'est bien une variable de **build** : Vite les fige à la
compilation, une variable d'exécution n'aurait aucun effet (on s'est déjà fait avoir).

Pour le développement local, ajoute la même ligne à ton `.env`.

## 5. Le déclencheur

Retour dans le **SQL Editor**. D'abord les extensions :

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;
```

Puis la planification — remplace les deux valeurs entre chevrons :

```sql
select cron.schedule(
  'zenith-rappels',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJET>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb
  );
  $$
);
```

La `service_role` reste côté base : elle ne transite jamais par le navigateur.

---

## Vérifier que ça marche

1. Sur ton iPhone, ouvre Zénith **depuis l'icône de l'écran d'accueil** (Safari → Partager →
   Sur l'écran d'accueil). Sans ça, iOS n'affichera jamais rien.
2. Ouvre **⚙ Réglages → Rappel quotidien**, bascule l'interrupteur, accepte l'autorisation.
3. Touche **Envoyer une notification de test**. Elle doit arriver en quelques secondes.

Si le test passe, la chaîne complète fonctionne : il ne reste que le déclencheur horaire à
attendre.

## Si quelque chose cloche

Depuis la version `2026-08-06.2`, le bouton de test **interroge la fonction quand il
échoue** et affiche la vraie cause au lieu d'un « ça n'a pas marché ». Le tableau ci-dessous
reste utile pour les cas qu'il ne peut pas voir.

| Symptôme | Cause la plus probable |
|---|---|
| « La fonction n'a pas répondu… déployée avec --no-verify-jwt » | Soit elle n'est pas déployée, soit elle l'a été sans l'option : la requête préliminaire du navigateur est rejetée avant d'atteindre le code. Le `curl` de ping tranche en trois secondes. |
| « il lui manque VAPID_… » | Le secret n'a pas été posé, ou il l'a été **après** le déploiement : `supabase functions deploy send-reminders --no-verify-jwt` à relancer pour que la fonction les relise. |
| « La clé publique du build ne correspond pas à celle du serveur » | `VITE_VAPID_PUBLIC_KEY` et `VAPID_PUBLIC_KEY` viennent de deux paires différentes. Réaligne, redéploie, puis **désactive et réactive** l'interrupteur pour réabonner l'appareil. |
| Le bloc affiche « Une étape avant, sur iPhone » | L'app tourne dans Safari, pas depuis l'icône de l'écran d'accueil. |
| « Clé de notification absente du build » | `VITE_VAPID_PUBLIC_KEY` n'est pas dans les variables de **build** Cloudflare, ou le déploiement date d'avant son ajout. |
| « Aucun appareil abonné » | L'interrupteur n'a jamais été activé sur cet appareil, ou l'abonnement a été retiré. |
| L'interrupteur ne réagit pas | L'autorisation a été refusée une fois : il faut la réautoriser dans les réglages du navigateur. |
| Rien à l'heure dite, mais le test marche | Le cron n'est pas planifié. Vérifie : `select * from cron.job;` puis `select * from cron.job_run_details order by start_time desc limit 20;` |
| Le rappel arrive à la mauvaise heure | Le fuseau est réécrit à chaque ouverture de l'app : ouvre-la une fois depuis l'appareil concerné. |

### Lire les journaux de la fonction

`supabase functions logs send-reminders` — ou, dans Studio, **Edge Functions → send-reminders
→ Logs**. Un envoi refusé y laisse le code HTTP du service de push et, souvent, la raison en
clair (clé VAPID qui ne correspond pas, abonnement expiré).

## Ce que le rappel ne fera pas

- **Il ne sonnera pas les jours où tu as déjà agi.** Une seule action suffit à faire taire
  le rappel du soir.
- **Il n'insistera pas.** Un envoi par jour au maximum, garanti par `last_reminder_day`.
- **Il ne culpabilisera pas.** Le texte change selon la série en cours, jamais pour
  reprocher une absence.
