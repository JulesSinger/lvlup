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

# la fonction
supabase functions deploy send-reminders
```

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

| Symptôme | Cause la plus probable |
|---|---|
| Le bloc affiche « Une étape avant, sur iPhone » | L'app tourne dans Safari, pas depuis l'icône. |
| « Clé de notification absente du build » | `VITE_VAPID_PUBLIC_KEY` n'est pas dans les variables de **build**, ou le déploiement date d'avant. |
| Le test échoue avec « fonction non déployée » | `supabase functions deploy send-reminders` n'est pas passé, ou le projet lié n'est pas le bon. |
| L'interrupteur ne réagit pas | L'autorisation a été refusée une fois : il faut la réautoriser dans les réglages du navigateur. |
| Rien à l'heure dite, mais le test marche | Le cron n'est pas planifié. Vérifie : `select * from cron.job;` puis `select * from cron.job_run_details order by start_time desc limit 20;` |
| Le rappel arrive à la mauvaise heure | Le fuseau est réécrit à chaque ouverture de l'app : ouvre-la une fois depuis l'appareil concerné. |

## Ce que le rappel ne fera pas

- **Il ne sonnera pas les jours où tu as déjà agi.** Une seule action suffit à faire taire
  le rappel du soir.
- **Il n'insistera pas.** Un envoi par jour au maximum, garanti par `last_reminder_day`.
- **Il ne culpabilisera pas.** Le texte change selon la série en cours, jamais pour
  reprocher une absence.
