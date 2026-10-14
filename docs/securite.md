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

## 6. Ce qui resterait à faire pour un vrai partage

- **Supprimer son compte** soi-même (RGPD) : une fonction avec la clé de service, qui efface
  d'abord les fichiers du compte dans les trois buckets (ils ne partent pas en cascade), puis
  l'utilisateur (ses lignes partent en cascade). L'export existe déjà (sauvegarde JSON).
- **Double authentification** (TOTP, gratuite dans Supabase) pour le compte de Jules.
- La protection contre les mots de passe divulgués de Supabase est réservée au forfait payant :
  écartée (règle n° 1).
