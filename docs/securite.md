# La sécurité d'Atlas

> Demande de Jules (14/10/2026) : « mieux sécuriser le site en vue d'un potentiel partage à
> d'autres utilisateurs ». Audit fait le même jour sur la base en ligne (lecture seule), les
> fonctions, le site et les dépendances ; corrections dans la foulée. Ce document dit ce qui
> protège quoi, ce qui a été corrigé, et ce qui reste à régler dans Supabase.

## 1. Ce qui protège déjà, vérifié

- **Chaque compte ne voit que ses données** : Row Level Security activée sur les 58 tables, et
  chaque politique bornée par `auth.uid()` (aucune exception, vérifié dans `pg_policies`). C'est
  ce qui protège, pas le secret de la clé `anon` — publique par conception.
- **Les fichiers** (photos des hauts faits, images des projets, photos des recettes) : trois
  buckets **privés**, JPEG seulement, 5 Mo au plus, chaque compte limité à son dossier
  (`storage.foldername(name)[1] = auth.uid()`).
- **Les secrets restent au serveur** : les jetons OAuth de Strava sont dans une table sans aucun
  droit pour le navigateur ; les clés du raccourci iPhone et du connecteur de Claude ne sont
  rangées que par leur empreinte SHA-256 ; la clé de service n'apparaît nulle part dans le dépôt,
  ni dans son historique (vérifié) ; `.env` n'est pas suivi.
- **Les fonctions** vérifient toutes l'appelant : `recettes-import` et `sport-strava` le jeton de
  session (`auth.getUser`), `sport-import` et `atlas-mcp` leur clé personnelle, `send-reminders`
  la clé de service. `courses_close_trip_for` n'est exécutable qu'avec la clé de service.
  `recettes-import` ne lit que des adresses publiques (pas d'IP privée, redirections revérifiées).
- **Les dépendances** : `npm audit` ne trouve aucune vulnérabilité (14/10/2026).

## 2. Les en-têtes de sécurité (`public/_headers`)

Cloudflare Pages les sert avec chaque page :

| En-tête | Ce qu'il empêche |
|---|---|
| `Content-Security-Policy` | qu'un texte piégé (une carte, une recette, une note) exécute du code, ou envoie des données ailleurs que vers Supabase et Open Food Facts |
| `frame-ancestors 'none'`, `X-Frame-Options: DENY` | qu'un autre site affiche Atlas dans un cadre invisible pour faire cliquer à l'aveugle |
| `Strict-Transport-Security` | qu'une connexion parte en clair (http) |
| `X-Content-Type-Options: nosniff` | qu'un fichier soit interprété comme un autre type |
| `Referrer-Policy` | que l'adresse complète d'une page parte vers un autre site |
| `Permissions-Policy` | l'accès au micro, à la position, aux paiements ; la caméra pour le seul scanner |

Le script du thème, écrit dans `index.html`, est autorisé par son empreinte ;
`src/core/lib/securityHeaders.test.ts` la recalcule à chaque test. **`vite preview` ne sert pas
`_headers`** : la politique a été éprouvée en servant les deux builds avec ces en-têtes et toutes
les suites de bout en bout (**1246/1246, aucune violation**), puis en injectant exprès un script,
une image et un envoi vers un site tiers — tous trois bloqués et signalés.

Si une fonctionnalité future charge quelque chose d'ailleurs (une police, une API), il faudra
l'ajouter à la politique : sinon le navigateur la bloque en ligne, sans erreur à l'écran.

## 3. Un appareil, plusieurs comptes (`core/data/deviceOwner.ts`)

Défaut trouvé : rien n'était effacé à la déconnexion. Sur un appareil partagé, le compte suivant
voyait la copie hors ligne du carnet de recettes du précédent, et — surtout — **les écritures
faites hors ligne par l'un partaient dans le compte de l'autre** : la file d'attente envoie au
compte connecté.

Désormais l'appareil retient son dernier compte (`atlas.owner.v1`). Quand un autre compte se
connecte, chaque file d'attente non vide est **mise de côté à son nom** (`<clé>.parked.<compte>`),
ni envoyée ni perdue, et revient quand il se reconnecte. Les files se reconnaissent à leur clé
(`<module>.outbox.v<n>`, imposée par `createOutbox`) : même celle d'un module pas encore chargé.
À la déconnexion, les photos en cache et ce que chaque module déclare (`AtlasModule.forgetDevice`
— la copie hors ligne de Recettes) sont oubliés ; le panneau de réglages dit combien
d'écritures attendent encore avant de se déconnecter.

## 4. Le HTML des cartes (`flashcards/lib/sanitize.ts`)

Défaut trouvé : le recto et le verso d'une carte s'affichent en HTML, et une carte importée en
masse est du texte brut — `<img src=x onerror=…>` collé dans un import s'exécutait. Une liste
blanche filtre désormais tout HTML avant affichage : les balises de l'éditeur, sans attribut, et
le bloc de dessin ; le reste s'affiche comme du texte. (La CSP l'aurait aussi bloqué : deux
protections plutôt qu'une.)

## 5. À régler dans Supabase (Jules, tableau de bord)

**Le point le plus important.** Aujourd'hui (vérifié sur `/auth/v1/settings`) :
`disable_signup: false` et `mailer_autoconfirm: true` — **n'importe qui trouvant l'adresse du site
peut se créer un compte, sans même confirmer son e-mail**, et consommer le quota gratuit (base,
fichiers, fonctions) ou se servir de `recettes-import` pour aller chercher des pages.

Pour quelques proches, recommandé : **inscriptions fermées, comptes sur invitation**.

1. *Authentication → Sign In / Providers → Email* : décocher **Allow new users to sign up** ;
   cocher **Confirm email**.
2. *Authentication → Users → Invite user* : un e-mail par proche ; il choisit son mot de passe
   via le lien (le parcours « mot de passe oublié » d'Atlas sert à ça).
3. *Authentication → Policies* (ou *Providers → Email*) : **longueur minimale 8**, lettres et
   chiffres.
4. *Authentication → URL Configuration* : **Site URL** = l'adresse du site ; **Redirect URLs** =
   cette adresse seulement, sans joker — sinon un lien de réinitialisation pourrait renvoyer
   ailleurs.

Le bouton « Créer un compte » de l'écran de connexion resterait affiché mais échouerait : à
masquer si les inscriptions sont fermées pour de bon.

**Les e-mails** (vérifié le 14/10/2026, sources de tiers) : l'envoi intégré à Supabase ne livre
qu'aux membres de l'équipe du projet, et deux à trois e-mails par heure. Une invitation à un proche
n'arriverait pas. Deux façons gratuites :

- **Créer le compte soi-même** : *Authentication → Users → Add user → Create new user*, avec
  « Auto Confirm User » ; donner le mot de passe de vive voix, la personne le change dans
  Réglages → Compte. Aucun e-mail.
- **Un serveur d'envoi** (*Authentication → Emails → SMTP Settings*) : Brevo (300 e-mails par jour
  gratuits) ou Resend (gratuit avec un nom de domaine). Nécessaire aussi pour « mot de passe
  oublié » d'un proche.

**Combien de comptes** : le forfait gratuit compte 50 000 utilisateurs actifs par mois ; la vraie
limite est ailleurs — 500 Mo de base, 1 Go de fichiers (les photos), 5 Go de sortie par mois, et
un projet mis en pause après une semaine sans aucune activité. Pour quelques proches, très loin.


## 7. La double authentification (14/10/2026)

Réglages → *Double authentification* : un QR code à scanner avec une app d'authentification
(TOTP : Authentificateur d'iCloud, Google Authenticator, 1Password, Bitwarden…), puis le premier
code. Ensuite, à chaque connexion, après le mot de passe, l'écran du code
(`SecondFactorScreen`) ; rien d'autre ne s'affiche avant.

**La base l'impose, pas seulement l'écran** : migration `2026-10-14-mfa-enforce.sql`, une
politique **restrictive** `<table>_mfa` sur chaque table de `public` et sur les fichiers, qui
refuse tout à un compte ayant une app vérifiée tant que sa session n'est pas au second niveau
(`aal2`). Sans elle, un mot de passe volé suffirait à interroger l'API directement. Un compte sans
double authentification n'est pas touché. **Une table créée ensuite doit recevoir sa politique** :
rejouer la migration (elle boucle sur toutes les tables). La clé du connecteur de Claude et celle
du raccourci iPhone restent des accès à part, créés depuis une session au second niveau.

L'état se lit dans la session sans appel réseau (`core/lib/mfa.ts` : niveau dans le jeton,
facteurs dans l'utilisateur). Téléphone perdu : garder la clé affichée à l'activation dans un
gestionnaire de mots de passe ; en dernier recours, retirer le facteur dans *Authentication →
Users*.

## 8. Supprimer son compte (14/10/2026)

Réglages → *Supprimer mon compte* : mot de passe, code si la double authentification est active,
et « SUPPRIMER » recopié. Le mot de passe est redonné dans une **session à part, en mémoire**
(`isolatedClient`) : la session ouverte ne redescend pas au premier niveau au milieu de
l'opération. La fonction `account-delete` exige une preuve d'identité de moins de dix minutes (lue
dans `amr`) et le second niveau pour un compte qui l'a, efface **d'abord les fichiers** des trois
espaces (ils ne partent pas en cascade), **puis le compte** — toutes les tables partent en cascade
(vérifié : chaque clé vers `auth.users` est `on delete cascade`). Une coupure entre les deux laisse
un compte sans fichiers, qu'on resupprime ; jamais des fichiers sans compte. L'écran propose
d'exporter une sauvegarde avant.

## 9. Ce qui resterait à faire pour un vrai partage

- ~~Supprimer son compte~~ et ~~double authentification~~ : faits le 14/10/2026 (§7, §8).
- Un serveur d'envoi d'e-mails si des proches doivent recevoir « mot de passe oublié » (§5).
- La protection contre les mots de passe divulgués de Supabase est réservée au forfait payant :
  écartée (règle n° 1).
