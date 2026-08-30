# Atlas

Un hub personnel, un module par domaine de la vie.

| Module | Nom affiché | Domaine | État |
|---|---|---|---|
| `objectifs` | **Zénith** | suivi d'objectifs par paliers | en production |
| `budget` | **Astra** | dépenses, catégories, import bancaire, enveloppes d'épargne | en production |

**Pour travailler sur ce dépôt, lis d'abord [`CLAUDE.md`](CLAUDE.md)** : il porte les
conventions, les invariants à ne pas casser et le journal des décisions. Ce README décrit
l'application ; `CLAUDE.md` décrit comment y toucher, et fait foi en cas de contradiction.

---

## Zénith — le module objectifs

Suivi d'objectifs par paliers, où chaque palier vaut un rang à décrocher (Fer → Challenger).

Un objectif se découpe en autant de paliers que tu veux, chacun avec le rang que tu lui attribues.
Valider un palier le date automatiquement, fait monter le rang de l'objectif, et la moyenne de tous
tes objectifs donne ton **rang de profil**.

---

## Astra — le module budget

Suivi des dépenses par catégories, avec un camembert mensuel et des enveloppes d'épargne.

Les opérations s'ajoutent à la main ou par import du relevé CSV BoursoBank (dédoublonné
automatiquement, catégorisation amorcée puis affinée par des règles). L'onglet *Aperçu* montre
la répartition du mois par catégorie ; l'onglet *Épargne* permet de répartir ce qui est mis de
côté dans des enveloppes nommées (vacances, imprévus…), sans jamais toucher à un vrai compte
bancaire.

---

## Démarrer en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Sans configuration, l'app tourne en **mode local** : tes objectifs sont enregistrés dans le
navigateur (localStorage). Pas de compte, pas de serveur, utilisable tout de suite. Les boutons
*Exporter* / *Importer* produisent un fichier JSON de sauvegarde.

Autres commandes :

```bash
npm run build      # build de production dans dist/
npm run test       # tests unitaires (vitest)
npm run preview    # sert le build sur http://localhost:4173
npm run check      # vérifications de bout en bout (Playwright) sur le build
```

**`npm run check` ne démarre aucun serveur** : il attend que le build soit déjà servi. La
séquence complète est donc :

```bash
npm run build && npm run preview &      # sert dist/ sur :4173
npm run check

# et pour le parcours avec comptes, qui exige les deux serveurs à la fois :
npm run build:auth && npm run preview:auth &   # sert dist-auth/ sur :4174
npm run check:auth
```

Sans le serveur, l'échec ressemble à un bug de l'app — `net::ERR_CONNECTION_REFUSED` sur
`http://localhost:4173/` — alors qu'il ne manque qu'un `npm run preview`.

---

## Passer en multi-utilisateur — 100 % gratuit

Deux services suffisent, tous deux avec une offre gratuite permanente :

| Rôle | Service | Offre gratuite |
| --- | --- | --- |
| Base de données + comptes | **Supabase** | 500 Mo de base, 50 000 utilisateurs actifs/mois |
| Hébergement du site | **Cloudflare Pages** (ou Vercel / Netlify) | bande passante illimitée, sous-domaine `.pages.dev` |

Aucune carte bancaire n'est demandée. Seule limite notable côté Supabase : un projet gratuit
laissé totalement inactif pendant une semaine est mis en pause, et se relance en un clic depuis
le tableau de bord.

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project**.
2. Choisis une région proche (Frankfurt ou Paris) et note le mot de passe de la base.
3. Ouvre **SQL Editor** → **New query**, colle tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Ce script crée les tables `goals` et `tiers`, et surtout active le **Row Level Security** : chaque
compte ne peut lire et modifier que ses propres lignes. C'est la garantie côté serveur — elle tient
même si quelqu'un bricole le code de la page dans son navigateur.

### 2. Brancher l'application

Dans Supabase : **Settings → API**, récupère l'URL du projet et la clé `anon public`. Puis :

```bash
cp .env.example .env
```

et renseigne les deux valeurs :

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Relance `npm run dev` : l'app affiche maintenant un écran de connexion. La clé `anon` est publique
par conception, elle a vocation à être exposée dans le navigateur — c'est le RLS qui protège les
données, pas le secret de cette clé.

Par défaut Supabase envoie un e-mail de confirmation à l'inscription. Pour t'en passer pendant tes
tests : **Authentication → Providers → Email → Confirm email**, désactive.

### 3. Mettre en ligne

Avec Cloudflare (Workers & Pages) :

1. Pousse le projet sur GitHub.
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Connect to Git**.
3. Build command `npm run build`, output directory `dist`.
4. **Settings → Build → Build Variables and Secrets** : ajoute `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` et `NODE_VERSION=22`.
5. **Settings → Domains & Routes** : active `workers.dev` pour obtenir l'adresse publique.

Chaque `git push` redéploie automatiquement. Vercel et Netlify se configurent exactement pareil
(ils détectent Vite tout seuls).

#### Trois pièges vérifiés sur le terrain

**Variables de *build*, pas d'exécution.** Cloudflare propose deux jeux de variables. Vite lit les
siennes au moment de la compilation pour les inscrire en dur dans le JavaScript produit : elles
doivent être dans *Settings → Build*, pas dans *Settings → Variables and Secrets*. Placées au
mauvais endroit, le build réussit sans erreur et le site déployé retombe silencieusement en mode
local — le symptôme est le bandeau jaune « Mode local » au lieu de l'écran de connexion.

**`NODE_VERSION=22`.** Vite 8 s'appuie sur Rolldown, qui exige Node ≥ 20.19. La version par défaut
de l'image de build Cloudflare peut être plus ancienne ; l'échec se manifeste par
`SyntaxError: ... does not provide an export named 'styleText'`. Un fichier `.nvmrc` contenant `22`
fait le même travail. Même contrainte en local : `nvm install 22`.

**Ajouter une variable ne suffit pas.** Comme les valeurs sont figées à la compilation, toute
modification n'a d'effet qu'au déploiement suivant. Pour en déclencher un sans changer le code :
`git commit --allow-empty -m "redéploiement" && git push`. Recharge ensuite avec Cmd+Shift+R, le
navigateur pouvant resservir l'ancien bundle.

### 4. Déclarer l'adresse du site dans Supabase

Une fois l'URL de production connue, retourne dans Supabase : **Authentication → URL
Configuration**.

- **Site URL** : `https://ton-site.workers.dev`
- **Redirect URLs** : `https://ton-site.workers.dev/**` (garde aussi `http://localhost:5173/**`)

Sans cette étape, les liens de confirmation envoyés par e-mail pointent vers `localhost` et
n'aboutissent nulle part chez tes utilisateurs. Cette liste fait aussi office de liste blanche :
Supabase refuse toute redirection vers une adresse non déclarée, ce qui empêche le détournement
d'un lien de confirmation.

Une fois en ligne, tes amis créent leur compte depuis l'écran d'accueil et disposent de leur propre
espace, sans que tu aies quoi que ce soit à faire.

---

## Architecture

```
src/
  App.tsx              Coquille du hub : authentification, choix du module, réglages,
                       export/import. Ne connaît aucun domaine
  styles.css           Uniquement des @import, dans un ordre qui fait la cascade
  modules/index.ts     Le registre : la liste des modules actifs
  core/                Le socle, commun à tous les modules
    components/        AuthScreen, PasswordRecovery, ReminderSettings, SettingsPanel,
                       ModulePicker (écran d'accueil du hub)
    data/              coreStore (comptes, réglages, notifications) + ses deux
                       implémentations, la sauvegarde, le client Supabase partagé
    lib/               module.ts (ce qu'un module déclare), push, sound, types
    styles/            Le style commun
  modules/objectifs/   Le module Zénith
  modules/budget/      Le module Astra
    module.ts          Sa déclaration : id technique, nom affiché, accès aux données
    components/  data/  lib/  styles/  e2e/
e2e/
  run.mjs               Lanceur : navigateur, découvre les suites de module
  core.mjs              Suite du socle : PWA, service worker, écran d'authentification
supabase/schema.sql     Tables de base + policies Row Level Security
supabase/migration-*.sql, AAAA-MM-JJ-*.sql   Migrations, dans l'ordre chronologique
```

Le point important est la **séparation socle / module**. Chaque module apporte son contrat de
stockage et ses deux implémentations — locale et Supabase — et ne touche à aucun fichier du
socle. Aucun composant ne connaît Supabase ni `localStorage` : c'est ce qui permet de démarrer
seul en local et de basculer en multi-utilisateur en renseignant deux variables.

Le détail du découpage, et la marche à suivre pour ajouter un module, sont dans
[`CLAUDE.md`](CLAUDE.md) et [`docs/architecture-modules.md`](docs/architecture-modules.md).

### Règles de calcul

- **Rang d'un objectif** = rang du palier validé le plus élevé. Volontairement le plus élevé et non
  le dernier validé chronologiquement : cocher un petit palier après un gros ne doit jamais faire
  baisser ton rang.
- **Rang de profil** = moyenne des rangs de tous les objectifs actifs ayant au moins un palier. Un
  objectif créé mais jamais travaillé compte 0 et tire la moyenne vers le bas — sinon il suffirait
  d'empiler des objectifs vides pour gonfler son rang.
- **Rangs suggérés à la création** : répartis de Bronze au dernier palier en Challenger, quel que
  soit le nombre de paliers. Ce ne sont que des suggestions, chaque rang reste modifiable.

---

## Utilisation

- **Créer** : bouton *+ Objectif*. Les paliers laissés vides sont ignorés, tu peux en ajouter ou en
  retirer autant que tu veux.
- **Valider un palier** : la case à cocher à gauche. La date est enregistrée et apparaît dans
  l'onglet *Historique*. Recocher annule la validation.
- **Modifier un palier** : double-clic sur son titre (ou le crayon) pour le renommer, clic sur son
  badge pour changer son rang, flèches pour le déplacer dans l'échelle.
- **Modifier / supprimer un objectif** : crayon et corbeille en haut à droite de la carte. La
  suppression emporte les paliers et demande confirmation.
- **Sauvegarde** : *Exporter* télécharge un JSON, *Importer* le recharge.
