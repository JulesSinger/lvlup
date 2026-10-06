# Projets — étude du neuvième module (les projets clients)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-taches.md` et
`docs/etude-hauts-faits.md`. Objectif : voir ce que fait le marché, ce qu'un projet de site pour
un commerçant demande vraiment, du premier appel à la mise en ligne, et ce que le module échange
avec le reste d'Atlas. Les décisions qui reviennent encore à Jules sont regroupées en fin de
document (§11). Une maquette accompagne l'étude : `docs/maquette-projets.html`.*

Demande de Jules (01/10/2026) : « un module de gestion de projet : onboarding, besoins, suivi des
tâches, deadlines projets, listes de tâches, documents, images, design, avancement… Je vais
peut-être me lancer en auto-entrepreneur et développer des sites pour des commerçants du genre
food truck, coiffeur, fleuriste, mais il faut que je sois organisé si j'ai plusieurs projets et
pour être carré dans mon travail. »

**Quatre décisions prises d'emblée avec Jules (01/10/2026)**, avant la rédaction :

1. **Les tâches d'un projet vivent dans le projet**, rangées par phase. Celles qui ont une date
   apparaissent en calque dans Calendar. Le module Tâches reste la to-do personnelle.
2. **Outil personnel, aucun espace client** : le client ne voit rien, ne se connecte jamais.
3. **L'argent : un prix et le suivi de ce qui est encaissé** (acompte, solde), avec un envoi
   facultatif vers Budget. Ni devis ni factures générés ici.
4. **Les fichiers : des liens, plus quelques images** (logo, photos du commerce), réduites dans
   le navigateur, sur le stockage déjà posé par Hauts faits.

---

## 1. Ce que le module est, et ce qu'il n'est pas

Les autres modules d'Atlas servent la vie personnelle. Celui-ci sert un **métier** : il porte du
travail fait pour quelqu'un d'autre, avec un engagement (une date promise, un prix convenu) et
des informations qui viennent du client (ses horaires, sa carte, ses photos, ses accès).

Ce qui le rend différent d'une liste de tâches :

- **plusieurs projets en même temps**, chacun à une étape différente — d'où le besoin d'une vue
  qui dit d'un coup d'œil *où en est chacun et lequel est en danger* ;
- **un projet se ressemble d'un client à l'autre** : un site de fleuriste et un site de coiffeur
  passent par les mêmes étapes (récupérer les contenus, maquette, développement, recette, mise en
  ligne). Le gain principal est là : **ne jamais repartir de zéro**, partir d'un modèle et ne
  rien oublier (le nom de domaine, les mentions légales, la fiche Google) ;
- **beaucoup d'attente du client** : « j'attends les photos », « j'attends sa validation de la
  maquette ». Un projet bloqué par le client n'est pas un projet en retard par sa faute — la
  distinction doit se voir ;
- **de l'argent attendu** : un acompte à la signature, un solde à la livraison. Oublier de
  relancer un solde est une erreur de débutant classique.

**Ce que le module n'est pas** :

- **pas un CRM** de prospection (pas de suivi de campagnes, pas de pipeline commercial
  sophistiqué) : un prospect est juste le premier statut d'un projet ;
- **pas un logiciel de facturation** : les devis et factures d'un micro-entrepreneur ont des
  mentions obligatoires et une numérotation continue, et la **facturation électronique**
  devient obligatoire pour les micro-entreprises (réception dès septembre 2026, émission
  prévue en septembre 2027 — calendrier à revérifier au moment de s'installer). C'est le
  métier d'un outil dédié (Indy, Abby, Freebe, Henrri, ou la plateforme publique), pas d'Atlas ;
- **pas un espace client** : règle n°2 de `CLAUDE.md`, et décision 2 ci-dessus ;
- **pas un coffre-fort** : on **ne stocke jamais un mot de passe** client ici (§3.7).

**Les frontières avec les autres modules** :

| Module | Ce qu'il garde | Ce que Projets garde |
|---|---|---|
| Tâches | la to-do perso (« appeler la banque ») | les tâches d'un projet client, dans leur phase |
| Calendar | les rendez-vous (« RDV fleuriste 14 h ») | les échéances et tâches datées, en **calque** |
| Budget | la vérité bancaire, toutes les entrées et sorties | ce qui est convenu et attendu de chaque client |
| Objectifs | « signer 3 clients cette année », s'il le veut | rien de cela |

Un rendez-vous client reste un **événement de Calendar** : le module n'a pas son propre agenda.

---

## 2. Le marché, et ce qu'on en retient

| Produit | Ce qu'il fait bien | Ce qu'on en garde |
|---|---|---|
| **Trello**, tableaux kanban | les cartes qui avancent de colonne en colonne | le **pipeline des projets** en colonnes |
| **Asana, ClickUp** | projets, sections, tâches, échéances, modèles de projet | **phases** + **modèle de projet** dupliqué à la création |
| **Basecamp** | un projet = un lieu unique (tâches, documents, messages) ; la « hill chart » qui distingue *je cherche encore* de *j'exécute* | la **fiche projet** qui rassemble tout ; l'avancement par phase plutôt qu'un seul pourcentage |
| **Notion** (modèles « freelance OS ») | clients, projets, factures liés entre eux | la relation **client → projets** |
| **Dubsado, HoneyBook, Moxie, Bonsai, Plutio** (outils de freelance) | le **questionnaire d'onboarding**, le parcours type (prospect → devis → contrat → acompte → livraison), les rappels de paiement | le **questionnaire de besoins**, le **statut**, l'**échéancier** de paiements |
| **Indy, Abby, Freebe** (micro-entrepreneurs français) | devis, factures, livre des recettes, déclarations URSSAF | **rien d'écrit ici** : on s'arrête au suivi de l'encaissé (§1) ; le **livre des recettes** peut toutefois se déduire des paiements notés (§3.8) |
| **Agences web** (listes de mise en ligne) | une *checklist* de lancement : HTTPS, mentions légales, favicon, fiche Google Business, sauvegarde | la phase **« Mise en ligne »** du modèle, déjà remplie |

Ce que le marché fait aussi, et qu'on **laisse de côté** : portail client, signature électronique
de contrats, chat avec le client, facturation, suivi du temps imposé, diagrammes de Gantt (pour
des projets de quelques semaines menés seul, une liste de phases datées suffit).

---

## 3. Les briques d'un projet

### 3.1 Le client

Un **client** est un commerce : nom (« Fleurs de Lou »), activité (fleuriste, coiffeur, food
truck… — liste fixe avec « autre », §11), contact (prénom, téléphone, e-mail), adresse, réseaux
(Instagram, Facebook, fiche Google), et une note libre.

**Un client peut avoir plusieurs projets** : le site, puis une refonte deux ans plus tard, ou un
contrat de maintenance. Séparer client et projet évite de retaper ses coordonnées et permet de
voir « tout ce que j'ai fait pour lui ».

### 3.2 Le projet et son statut

Un projet a un **titre** (« Site vitrine »), un **client**, un **statut**, une **date de début**,
une **échéance** (la mise en ligne promise), un **prix** et une **note**.

Le statut, en pipeline (proposé, §11) :

| Statut | Sens |
|---|---|
| **Piste** | premier contact, rien de signé |
| **Devis envoyé** | j'attends sa réponse |
| **Signé** | accord, acompte attendu ou reçu, pas encore commencé |
| **En cours** | je travaille dessus |
| **En recette** | le client relit et valide |
| **En ligne** | livré ; reste éventuellement le solde |
| **Maintenance** | suivi régulier après la livraison (facultatif) |
| **Terminé** / **Perdu** | archivés, hors du tableau de bord |

Un indicateur à part, **« En attente du client »** (avec ce qu'on attend : « photos », « retour
maquette »), peut se poser sur un projet de n'importe quel statut actif. C'est lui qui distingue
un projet bloqué d'un projet en retard (§1).

### 3.3 Les phases et les tâches

Un projet se découpe en **phases** ordonnées, chacune avec ses **tâches**. Le modèle proposé pour
un site vitrine de commerçant :

1. **Découverte** — premier rendez-vous, questionnaire de besoins rempli, devis envoyé, acompte
   reçu.
2. **Contenus** — logo, photos, textes (présentation, horaires, carte ou tarifs), accès aux
   réseaux et à la fiche Google.
3. **Maquette** — arborescence, maquette de l'accueil, validation du client.
4. **Développement** — pages, formulaire de contact, carte, responsive, référencement de base.
5. **Recette** — relecture par le client, corrections, tests téléphone.
6. **Mise en ligne** — nom de domaine, hébergement, HTTPS, mentions légales et politique de
   confidentialité, Search Console, fiche Google à jour, sauvegarde.
7. **Après** — formation du client, solde encaissé, demande d'avis, relance à trois mois.

**Le modèle est dupliqué à la création** du projet, puis chaque projet vit sa vie : ajouter,
retirer, renommer une phase ou une tâche ne touche ni le modèle ni les autres projets. Le modèle
lui-même est modifiable (on apprend d'un projet à l'autre) — dans la V1, un modèle écrit dans le
code ; un éditeur de modèles plus tard (§11).

Une **tâche** a un titre, une note, un **jour prévu** et une **échéance** facultatifs (comme
Tâches), une coche, et peut être marquée **« attend le client »**. Pas de priorité ni de
répétition dans la V1 : la phase donne déjà l'ordre, et une tâche de projet se fait une fois.
Une **phase** peut avoir sa propre échéance (« maquette validée le 15 »).

### 3.4 Les besoins : le questionnaire d'onboarding

Le premier rendez-vous avec un commerçant revient toujours aux mêmes questions. Les écrire une
fois, et les remplir pendant l'entretien, c'est ce qui rend « carré » :

- **L'activité** : ce qu'il vend, à qui, ce qui le distingue, ses concurrents qu'il aime bien ;
- **Le but du site** : être trouvé sur Google, montrer la carte, prendre des réservations ou des
  commandes, rassurer avant une visite ;
- **Les pages** : accueil, présentation, carte/prestations/tarifs, galerie, horaires et accès,
  contact, mentions légales — cochées ;
- **Les fonctions** : formulaire, réservation en ligne (outil tiers ?), commande, carte Google,
  lien Instagram, avis Google, emplacements du jour (food truck) ;
- **Les contenus** : qui fournit textes et photos, et quand ;
- **L'identité** : logo existant ou non, couleurs, ambiance, sites qu'il aime ;
- **Le technique** : nom de domaine (a-t-il déjà un ? chez qui ?), hébergement, adresse e-mail
  pro, qui gère le site après ;
- **Le cadre** : budget, date souhaitée, contraintes (ouverture d'une boutique, saison).

Chaque question a une réponse libre, et une case **« à demander au client »** qui la fait
remonter dans « En attente du client ». Les réponses forment le **cahier des charges** du
projet, lisible d'un bloc (et imprimable plus tard).

Rangées en **JSON** dans le projet (une clé par question), pas une table par question : le
questionnaire évoluera, et une question retirée ne doit pas effacer une ancienne réponse.

### 3.5 Le design

Une fiche courte, faite pour être relue en développant : **couleurs** (pastilles avec leur code
hexadécimal, copiables d'un toucher), **polices** (titre, texte), **ambiance** en trois mots,
**sites de référence** (liens), **logo** (image, §3.6), liens vers la **maquette** (Figma,
Canva, Penpot).

### 3.6 Documents, liens et images

- **Liens typés** : maquette (Figma, Canva, Penpot), dossier partagé (Drive, Dropbox), site en
  préproduction, site en ligne, hébergeur, registraire du domaine, devis et facture (le PDF reste
  dans l'outil de facturation, on y pointe), autre. Le type donne une icône et un ordre.
- **Images** : logo, photos du commerce, captures de la maquette validée — **peu, et réduites**
  dans le navigateur avant l'envoi, comme Hauts faits (§5 de son étude) : 2 048 px et une
  miniature, métadonnées retirées. Plafond proposé : 20 images par projet (§11).

Les gros fichiers du client (photos en pleine taille, PDF de carte, vidéos) restent dans son
dossier partagé, référencé par un lien. Le 1 Go gratuit de Supabase Storage est **partagé avec
les photos de Hauts faits** : ne garder ici que ce qu'on regarde souvent.

### 3.7 Les accès — jamais de mot de passe

Un projet web oblige à manier des accès : registraire, hébergeur, back-office, compte Google du
commerce. Le module garde **où** (l'adresse de connexion), **à quel compte** (l'identifiant) et
**qui en est propriétaire** (le client, idéalement), mais **jamais le mot de passe**. Raisons :

- Atlas n'est pas chiffré de bout en bout : un mot de passe en clair dans une table, c'est un
  mot de passe lisible par quiconque obtient la base ou une sauvegarde JSON ;
- la sauvegarde exportée (`backup.ts`) emporterait tous les accès de tous les clients dans un
  fichier qui traîne dans les Téléchargements ;
- un gestionnaire de mots de passe (Bitwarden, gratuit ; le trousseau d'Apple) fait ce travail
  bien mieux. La fiche peut dire « dans Bitwarden, entrée *Fleurs de Lou — OVH* ».

C'est une règle de l'écran (le champ n'existe pas) et une phrase dans la fiche, pas une
promesse qu'on espère tenir.

### 3.8 L'argent

- **Prix convenu** du projet (en centimes entiers, comme Budget).
- **Échéancier** : des paiements attendus, chacun avec un libellé (« Acompte 30 % », « Solde »),
  un montant, une date prévue, et une **date de réception** une fois encaissé. Un modèle
  d'échéancier propose 30 % à la signature, 70 % à la mise en ligne (§11).
- À l'écran : **encaissé / reste à encaisser**, et les paiements **en retard** (date prévue
  passée, non reçus) remontent dans le tableau de bord.
- **Envoi à Budget** (décision 3) : un paiement reçu peut créer une **entrée** dans Budget,
  catégorie « Revenus freelance » (trouvée par son nom, sinon « à classer »).
- **Le livre des recettes** : un micro-entrepreneur doit tenir un registre chronologique de ses
  encaissements (date, client, montant, mode de règlement, référence de la facture). Les
  paiements notés ici en contiennent tout, à condition d'ajouter le **mode de règlement** et la
  **référence de facture** : une vue « Recettes » par année, exportable en CSV, est presque
  gratuite à écrire. Elle **n'est pas une comptabilité certifiée**, et l'outil de facturation
  en tient sans doute déjà un — à proposer, pas à imposer (§11).
- Le **chiffre d'affaires de l'année** (somme encaissée), utile pour la déclaration URSSAF
  mensuelle ou trimestrielle et pour surveiller le plafond du régime — affiché, jamais calculé
  en impôt ou en cotisations (les taux changent, ce n'est pas le rôle d'Atlas).

### 3.9 Le journal du projet

Des **notes datées** : « Appel : elle veut ajouter la carte des mariages », « Maquette validée
par SMS », « Relancé pour le solde ». C'est la mémoire du projet, et ce qui protège en cas de
désaccord (« vous aviez validé le 12 »). Une ligne de texte et une date, rien de plus.

### 3.10 Le temps passé (facultatif, §11)

Noter le temps passé par projet (une durée par jour, pas de chronomètre) donne le **taux horaire
réel** : 900 € pour 30 h, c'est 30 €/h ; pour 60 h, 15 €/h. C'est l'information qui apprend à
chiffrer ses devis suivants. Coûte une petite table et un champ ; utile seulement si on s'astreint
à le noter.

---

## 4. Les vues

### 4.1 Le tableau de bord (l'écran d'ouverture)

Répond à la question du matin : **sur quoi je travaille, qu'est-ce qui brûle, qu'est-ce que
j'attends ?**

- **À faire cette semaine** : les tâches prévues ou à échéance dans les 7 jours, tous projets
  confondus, cochables directement, avec le projet en étiquette ;
- **En retard** : tâches et phases dépassées, projets dont l'échéance est passée ;
- **En attente du client** : ce qu'on attend, de qui, depuis combien de jours (pour savoir quand
  relancer) ;
- **Projets actifs** : une carte par projet — client, statut, avancement par phase (une barre
  segmentée), échéance et jours restants ;
- **Argent** : encaissé ce mois et cette année, reste à encaisser, paiements en retard.

### 4.2 Le pipeline

Les projets en **colonnes par statut** (Piste → Maintenance), comme Trello. Changer de statut
se fait depuis la fiche (un sélecteur) ; le glisser d'une colonne à l'autre peut venir plus tard,
le tableau de bord étant la vue de tous les jours. Sur téléphone, les colonnes deviennent des
sections empilées.

### 4.3 La fiche projet

En-tête : client, titre, statut, échéance, avancement. Puis des **onglets** :

| Onglet | Contenu |
|---|---|
| **Aperçu** | prochaines tâches, attente client, argent en une ligne, derniers mots du journal |
| **Tâches** | les phases dépliables, leurs tâches, ajout rapide dans une phase |
| **Besoins** | le questionnaire, remplissable pendant le rendez-vous |
| **Design** | couleurs, polices, logo, références, liens de maquette |
| **Documents** | liens typés, images, accès (sans mot de passe) |
| **Argent** | prix, échéancier, encaissé, reste |
| **Journal** | les notes datées |

### 4.4 Clients

La liste des clients, chacun avec ses coordonnées et ses projets. Toucher un numéro appelle,
toucher une adresse ouvre la carte (`tel:`, `mailto:`, lien vers un plan).

### 4.5 L'avancement — calculé, jamais saisi

L'avancement d'une phase est la **part de ses tâches cochées** ; celui du projet, la moyenne
des phases ou la part de toutes ses tâches (§11 tranche, proposé : toutes les tâches, plus
simple à comprendre). Il n'y a **aucun pourcentage à taper** : un chiffre saisi à la main ment
dès qu'on oublie de le mettre à jour. Une phase sans tâche ne compte pas.

Le projet est **en danger** si son échéance tombe dans moins de 7 jours et qu'il reste plus de
la moitié de ses tâches, ou si une phase dépasse sa date. Règle pure et testée, signalée sans
rouge criard (même philosophie que Budget : informer, pas culpabiliser).

---

## 5. Hors ligne

Ce module se travaille surtout **au bureau**, à l'ordinateur. Deux exceptions : noter les
besoins **chez le commerçant**, et cocher une tâche en déplacement. Proposé : **pas de file hors
ligne en V1**, mais des **identifiants choisis par l'application** dès l'étape 1 (comme Tâches et
Nutrition), pour brancher la file commune (`core/data/outbox.ts`) plus tard sans migration. En
attendant, une écriture sans réseau échoue avec un message et le formulaire reste rempli —
c'est la règle n°3 : ne rien perdre de ce qui a été saisi. Le questionnaire de besoins garde en
plus un **brouillon sur l'appareil** tant qu'il n'est pas enregistré (le rendez-vous peut avoir
lieu dans une boutique sans réseau).

---

## 6. Les liens avec les modules d'Atlas

| Module | Lien | Sens | Valeur | Socle à toucher ? |
|---|---|---|---|---|
| **Calendar** | échéances de projet, de phase, tâches datées, paiements attendus, en **calque** | lecture | **forte** | non — `calendarSources` existe |
| **Calendar** | cocher et déplacer une tâche de projet depuis le calendrier | écriture | forte | non — `toggleMark` / `moveMark` existent depuis Tâches |
| **Calendar** | toucher la marque → « Ouvrir dans Projets » | navigation | moyenne | non — `onOpenModule(…, 'task:<id>')` existe |
| **Budget** | un paiement reçu devient une **entrée** | écriture | forte | **oui** : `ExpenseService` ne sait créer que des dépenses (le montant est rendu négatif dans `budget/data/expenseService.ts`). À étendre (ci-dessous) |
| **Rappels** | échéance à J-2, paiement attendu le jour même, relance « en attente du client depuis 7 jours » | — | moyenne | non — `scheduleReminders('projets', …)` existe |
| **Tâches** | rien : la to-do perso reste séparée (décision 1) | — | — | — |
| **Hauts faits** | « premier client », graver à la main | — | faible | — |

**Étendre le service de Budget.** Deux formes possibles, au choix lors de l'étape 5 :

- un champ `direction: 'expense' | 'income'` sur `ExpenseRequest` (défaut : dépense), Budget
  applique le signe en conséquence — le plus petit changement, Courses inchangé ;
- un service frère `incomes`, de même forme.

Le premier est recommandé : le service garde un seul nom, et une référence stable
`projets:paiement:<numéro>` rend l'envoi rejouable sans doublon, comme Courses
(`comete:course:<numéro>`). Comme pour Courses, une **référence numérotée** plutôt qu'un uuid,
qu'une restauration ne change pas.

---

## 7. Le modèle de données

Nom technique proposé : `projets`. Toutes les tables portent `user_id`, le RLS complet (quatre
politiques nommées), un index sur `user_id`, et des **identifiants choisis par l'application**.

| Table | Colonnes principales |
|---|---|
| `projets_clients` | `name`, `trade` (CHECK, liste `as const`), `contact_name`, `phone`, `email`, `address`, `links jsonb` (réseaux), `note`, `archived`, `created_at` |
| `projets_projects` | `client_id` (`on delete restrict` : on archive un client, on ne supprime pas son historique), `number` (unique par compte, pour les références stables), `title`, `status` (CHECK), `waiting_for` (texte, null = n'attend rien), `waiting_since`, `start_day`, `due_day`, `price_cents`, `needs jsonb` (le questionnaire), `design jsonb`, `note`, `created_at` |
| `projets_phases` | `project_id` (`on delete cascade`), `title`, `position`, `due_day` |
| `projets_tasks` | `project_id`, `phase_id` (`on delete cascade`), `title`, `note`, `planned_day`, `due_day`, `waiting_client`, `position`, `completed_at` |
| `projets_links` | `project_id`, `kind` (CHECK), `label`, `url`, `login` (identifiant, **jamais de mot de passe**), `position` |
| `projets_payments` | `project_id`, `number`, `label`, `amount_cents` (> 0), `expected_day`, `received_day`, `method` (CHECK : virement, espèces, chèque, carte, autre), `invoice_ref` |
| `projets_notes` | `project_id`, `day`, `text`, `created_at` |
| `projets_images` | `project_id`, `kind` (logo, photo, maquette), `path`, `thumb_path`, `width`, `height`, `position` — fichiers dans un bucket privé `projets`, dossier par compte, **même motif** que `supabase/2026-09-30-hautsfaits-photos.sql` |
| `projets_time` *(si §11 le retient)* | `project_id`, `day`, `minutes` |

Choix à justifier dans le code :

- **Le questionnaire et le design en JSON** (§3.4) : leur forme changera plus souvent que le
  reste ; une colonne par question imposerait une migration par question.
- **Le modèle de phases dans le code** (`lib/templates.ts`), recopié à la création : aucune
  table de modèles dans la V1.
- **Le prix et les paiements séparés** : le prix est ce qui a été convenu, les paiements ce qui
  est attendu et reçu ; un avenant change le prix sans réécrire les paiements passés.
- **Les valeurs `CHECK`** (statuts, métiers, sortes de liens, modes de règlement) ont leur pendant
  `as const` et un `schema.test.ts`, comme le veut `CLAUDE.md` §5.

**Les images, et la question du socle.** Hauts faits a écrit la réduction (`preparePhoto.ts`),
le cache (`photoCache.ts`) et le stockage local (`blobStore.ts`) **dans le module**, « tant qu'un
seul en a besoin » (journal du 30/09/2026). Projets serait le deuxième. Deux voies :

- **recopier** ces fichiers dans le module — rapide, deux copies à maintenir ;
- **remonter** l'envoi et la lecture d'images dans le socle (`core/data/images/`), Hauts faits
  et Projets s'en servant, chacun avec son bucket — c'est la règle de §3 (« une pièce dont deux
  modules ont besoin appartient au socle »), et c'est ce qui a été fait pour la récurrence avec
  Tâches.

Recommandé : **remonter**, à l'étape 7 (les images), en vérifiant que la suite de Hauts faits
passe à l'identique — c'est la vérification du déplacement.

**La sauvegarde** suit le registre : le module y entre sous `projets`, sans les images (comme
Hauts faits : la liste, pas le contenu).

---

## 8. Ce qui va bloquer, ou coûter

| Sujet | Difficulté | Réponse |
|---|---|---|
| **L'usine à gaz** : clients, projets, phases, tâches, besoins, design, liens, images, argent, journal, temps | **le vrai risque** | une V1 resserrée (clients, projets, phases, tâches, tableau de bord) ; le reste par étapes, chacune utile seule |
| Le questionnaire qui vieillit | faible | JSON, questions identifiées par une clé stable, une question retirée garde sa réponse visible |
| Étendre le service de Budget | faible | un champ `direction`, testé des deux côtés (§6) |
| Stockage d'images partagé (1 Go gratuit) | faible | images réduites, plafond par projet, gros fichiers en liens (§3.6) |
| Remonter les images au socle | moyenne | à l'étape 7, déplacement vérifié par la suite de Hauts faits |
| Réglementaire (factures, livre des recettes, plafond) | à **ne pas** prendre | rien n'est facturé ici ; le livre des recettes est une vue d'aide, présentée comme telle (§3.8) |
| Données personnelles des clients (nom, téléphone) | faible | elles restent dans le compte de Jules, sous RLS ; aucune n'est envoyée ailleurs |
| Hors ligne | faible, déjà fait trois fois | ids choisis par l'app dès l'étape 1, file plus tard ; brouillon local pour les besoins (§5) |

Rien de payant, rien qui ne tienne dans l'offre gratuite.

---

## 9. Nommer le module

Règle du 28/09/2026 : un module porte un **nom fonctionnel**. Propositions :

- **Projets** 💼 — ce qu'il range ; neutre, clair, et ne présume pas que tous les projets seront
  des sites. **Recommandé.**
- **Clients** 🤝 — dit pour qui, mais la vue principale est le travail, pas le carnet
  d'adresses.
- **Freelance** 🧑‍💻 — dit le métier, mais un mot anglais de plus (Jules a accepté *Flashcards* et
  *Calendar*, c'est donc possible).
- **Atelier** 🛠️ — joli, moins immédiat.

Nom technique : **`projets`**. Couleur proposée : le bleu de la palette, `--blue` (`#6fa8f5`) — les teintes déjà prises
sont l'or, le violet, le bleu ciel, le turquoise, le lilas, le citron vert, le rose et le corail.

---

## 10. Découpage proposé

| Étape | Contenu | Résultat |
|---|---|---|
| 1 | Migration (clients, projets, phases, tâches, notes), contrat et ses deux implémentations, module signet et aperçu d'accueil | le module existe |
| 2 | Bibliothèques pures : modèle de phases et sa copie, avancement, « en danger », tableau de bord (ce qui entre dans « cette semaine », « en retard », « en attente »), validation | les règles sont justes |
| 3 | Clients, création d'un projet depuis le modèle, fiche (Aperçu, Tâches, Journal), statut et « en attente du client », tableau de bord | **la V1** |
| 4 | Besoins (questionnaire, brouillon local), Design, Documents (liens et accès sans mot de passe), pipeline | le projet complet |
| 5 | Argent : migration des paiements, échéancier, encaissé / reste, envoi à Budget (service étendu au socle), vue Recettes si retenue | l'argent suivi |
| 6 | Calque dans Calendar (échéances, tâches cochables et déplaçables, paiements attendus), rappels | le lien avec le reste d'Atlas |
| 7 | Images (logo, photos, maquettes) — avec, si décidé, l'envoi d'images remonté au socle | les images |
| plus tard | éditeur de modèles, plusieurs modèles (vitrine, boutique, maintenance), temps passé, récap imprimable du projet, file hors ligne | — |

---

## 11. Questions à trancher ensemble

1. **Le nom** : Projets, Clients, Freelance, Atelier, autre ? Et l'emoji.
2. **Les statuts du pipeline** (§3.2) : la liste proposée convient-elle ? « Maintenance » en fait
   partie ?
3. **Les métiers des clients** : liste fixe (food truck, restaurant, coiffeur, fleuriste,
   boulangerie, artisan, commerce, autre) ou texte libre ?
4. **Le modèle de projet** (§3.3) : les sept phases proposées te parlent-elles ? Un seul modèle
   (site vitrine) dans la V1, ou plusieurs (vitrine, boutique en ligne, maintenance) ?
5. **Le questionnaire de besoins** (§3.4) : fixe et écrit dans le code (on l'enrichit au fil des
   versions), ou modifiable dans l'app ?
6. **L'échéancier par défaut** (§3.8) : 30 % / 70 %, 50 % / 50 %, ou rien de proposé ?
7. **Les paiements reçus vers Budget** : automatiquement à chaque encaissement, ou une case
   à cocher (comme Courses, cochée par défaut) ?
8. **La vue Recettes** (livre des recettes exportable) : utile, ou ton outil de facturation s'en
   chargera ?
9. **Le temps passé** (§3.10) : le noter, oui ou non ?
10. **Les images remontées au socle** (§7), partagées avec Hauts faits : d'accord ?
11. **Le plafond d'images** par projet : 20 ?
12. **L'avancement** (§4.5) : part de toutes les tâches du projet, ou moyenne des phases ?

---

## 12. Décisions prises avec Jules (05/10/2026)

| Question | Décision |
|---|---|
| Nom (§9) | **Projets** 💼, nom technique `projets` |
| Statuts (§3.2) | le pipeline plaît, mais **le travail avance sur plusieurs fronts en même temps** (développement, contenus, hébergement…) : un seul statut ne peut pas le dire. Revu ci-dessous |
| Questionnaire (§3.4) | **fixe** pour l'instant, écrit dans le code |
| Temps passé (§3.10) | **oui**, on le note |
| Modèle de projet, échéancier | réexpliqués à Jules (ci-dessous), réponse attendue |

### Deux axes au lieu d'un : le statut et les chantiers

La remarque de Jules montre que la liste du §3.2 mélangeait deux choses : **où en est la
relation avec le client** (piste, devis, signé, livré) et **où en est le travail** (en cours, en
recette). La première est bien une suite d'étapes, une à la fois ; la seconde ne l'est pas.

- **Le statut ne parle plus que de la relation** : *Piste → Devis envoyé → Signé → En production →
  Livré → Maintenance*, plus *Terminé* et *Perdu*. « En cours » et « En recette » disparaissent,
  remplacés par un seul **En production**.
- **Les phases deviennent des chantiers**, menés **en parallèle**, sans ordre imposé :
  Découverte, Contenus, Maquette, Développement, Hébergement & domaine, Recette, Mise en ligne,
  Après. Chacun a son état, **calculé depuis ses tâches** et jamais choisi à la main : *à faire*
  (rien de coché), *en cours*, *attend le client* (une de ses tâches attend), *fait* (tout est
  coché).
- **La carte d'un projet** dit donc : « En production — en cours : Développement, Contenus,
  Hébergement ; attend le client : Contenus (photos) ». C'est la réponse à « je fais plusieurs
  choses en même temps ».
- Dans la fiche, les chantiers en cours s'affichent **en premier**, ceux qui sont faits se
  replient en bas.

Conséquences sur le modèle de données (§7) : `projets_phases` devient `projets_workstreams`
(chantiers), sans état stocké ; la colonne `position` ne sert plus qu'à l'ordre d'affichage du
modèle. La liste des statuts (CHECK, `as const`) devient
`lead, quoted, signed, production, delivered, maintenance, done, lost`. L'avancement du projet
(§4.5) reste la part de toutes ses tâches cochées.

### Le modèle de projet, réexpliqué

Un **modèle**, c'est la **liste de chantiers et de tâches toute prête** qu'Atlas recopie dans
chaque nouveau projet. Créer « Fleurs de Lou — site vitrine » donne d'office une quarantaine de
tâches (« acheter le nom de domaine », « mentions légales », « fiche Google à jour »…) qu'on n'a
plus à se rappeler ni à retaper ; on retire ce qui ne sert pas pour ce client, on ajoute ce qui
manque. Les sites pour commerçants se ressemblent : c'est ce qui rend « carré » sans effort.

La question restante est de savoir s'il en faut **un seul** (site vitrine) ou **plusieurs**
(vitrine, boutique en ligne, maintenance). Recommandé : un seul dans la V1, d'autres quand un
vrai projet le demandera.

### L'échéancier, réexpliqué

C'est **le découpage du prix en paiements**. Pour un site à 900 €, l'usage chez les
indépendants est de demander une partie **à la signature** (l'acompte, qui engage le client et
couvre le début du travail) et le reste **à la livraison** (le solde). Exemple « 30 / 70 » :
270 € à la signature, 630 € à la mise en ligne. Atlas proposerait ce découpage à la création du
projet (modifiable), pour que les deux paiements attendus existent tout de suite et qu'un solde
non reçu remonte dans le tableau de bord. La question : quel découpage proposer par défaut —
30 / 70, 50 / 50, ou aucun (on saisit les paiements à la main) ?

### Le temps passé

Retenu : une table `projets_time` (projet, jour, minutes, chantier facultatif, note), une saisie
rapide « 2 h 30 sur Développement » depuis la fiche, et dans l'onglet Argent le **taux horaire
réel** (encaissé, ou prix convenu, divisé par le temps noté). Pas de chronomètre dans la V1 : une
durée tapée après coup suffit et ne s'oublie pas allumée. Rangé à l'étape 5, avec l'argent.

### Les deux réponses suivantes (05/10/2026)

- **Plusieurs modèles de projet.** Proposés pour l'étape 2, à relire par Jules quand leurs
  listes seront écrites : **Site vitrine** (le modèle du §3.3, chantiers parallèles), **Boutique
  en ligne** (le même, plus catalogue, paiement en ligne, livraison ou retrait, CGV),
  **Refonte** (reprise de l'existant, redirections des anciennes adresses), et **Vide** (aucun
  chantier). La maintenance reste un **statut**, pas un modèle : c'est un suivi après livraison,
  pas un projet qui se découpe en chantiers.
- **Échéancier 30 / 70** proposé à la création d'un projet qui a un prix : l'acompte de 30 % à
  la signature, le solde à la livraison, les deux modifiables (étape 5).
- Les **chantiers parallèles** de ci-dessus n'ont pas soulevé d'objection : ils sont retenus, et
  la maquette les montre (cartes du tableau de bord, fiche groupée par état).

---

## 13. Étape 1 : le module existe (05/10/2026)

- **Migration** `supabase/2026-10-05-projets-tables.sql` : `projets_clients`,
  `projets_projects`, `projets_workstreams` (les chantiers), `projets_tasks`, `projets_notes`, RLS
  complet (quatre politiques par table, écrites en toutes lettres). Les paiements, le temps passé,
  les liens et les images auront leurs migrations à leur étape.
- **Contrat** `data/projetsStore.ts` et ses deux implémentations, `LocalProjets` et
  `SupabaseProjets`. Créations rejouables (id choisi par l'application, `upsert … ignoreDuplicates`
  puis relecture), comme Tâches et Hauts faits.
- **Module signet** (`ProjetsScreen`, avec `ModuleBrand`) et aperçu pour la page d'accueil.
  Couleur : le bleu de la palette (`--blue`), seule teinte encore libre.

Choix faits en l'écrivant :

- **Une tâche ne peut être que dans un chantier de son propre projet** : la clé étrangère des
  tâches porte sur le couple (chantier, projet), adossée à une unicité `(id, project_id)` sur les
  chantiers. Le mode local refuse la même chose, pour ne pas permettre plus que la base.
- **Un client qui a des projets ne se supprime pas** (`on delete restrict`), il s'archive ; les
  deux implémentations le disent en clair avant que la base ne refuse.
- **Le numéro du projet** est le plus grand du compte plus un, attribué à la création et gardé
  par la sauvegarde ; une création rejouée garde le numéro de la première fois. Unique par compte
  en base : deux créations simultanées ne peuvent pas prendre le même.
- **Copier un modèle se fait en deux envois** (`addWorkstreams` : les chantiers, puis leurs
  tâches), plutôt qu'une quarantaine. Pas de transaction : une coupure laisse au pire un projet
  aux tâches incomplètes, qu'un second appel avec les mêmes ids complète sans doublon.
- **Le questionnaire de besoins** est déjà une colonne (`needs`, un objet JSON) pour ne pas
  demander de migration à l'étape 4.
- **Ne plus rien attendre du client efface la date d'attente**, dans les deux implémentations
  comme dans la contrainte de la base.

Vérifications : 1170 → **1196** tests unitaires (+26 : `localProjets.test.ts` 12,
`schema.test.ts` 4, `conventions.test.ts` +10 pour le nouveau module), **866/866** vérifications
de bout en bout en local et **885/885** en mode comptes (+5). **Migration à appliquer sur
Supabase** avant la mise en ligne.

---

## 14. Étape 2 : les règles, testées avant tout écran (05/10/2026)

Six bibliothèques pures dans `src/modules/projets/lib/`, sans écran :

| Fichier | Ce qu'il décide |
|---|---|
| `templates.ts` | les quatre modèles (vitrine, boutique en ligne, refonte, vide) et leur copie dans un projet (`instantiateTemplate`, ids injectés) |
| `progress.ts` | l'état d'un chantier, les chantiers d'un projet rangés par état, l'avancement, les retards, « en danger » |
| `dashboard.ts` | cette semaine, les retards, l'attente du client, les cartes des projets actifs |
| `schedule.ts` | l'échéancier 30 / 70 proposé |
| `status.ts` | statuts et métiers en français ; projets clos (terminés, perdus) et projets « au travail » (signés, en production) |
| `validation.ts` | les règles de la base dites en français, avant l'envoi |

**Les modèles, à relire par Jules.** Le site vitrine compte 8 chantiers et 45 tâches :
Découverte (rendez-vous, questionnaire, devis, devis signé, acompte), Contenus (logo, photos,
textes, horaires, carte ou tarifs, accès aux réseaux et à la fiche Google), Maquette,
Développement (de la mise en place du projet à l'optimisation des images), Hébergement & domaine
(domaine **au nom du client**, e-mail pro, HTTPS), Recette (préproduction, relecture, tests
téléphone, validation écrite), Mise en ligne (mentions légales, confidentialité, Search Console,
fiche Google, favicon, sauvegarde), Après (formation, solde, avis, relance à trois mois). La
boutique ajoute un chantier **Boutique** (catalogue, paiement en ligne sur un compte au nom du
client, livraison ou retrait, CGV, e-mails de commande, commande test) ; la refonte, un chantier
**Reprise de l'existant** (audit, accès à l'ancien hébergement, sauvegarde, contenus à garder,
anciennes adresses et leurs redirections). Le détail est dans `lib/templates.ts`, écrit pour
être lu.

Règles retenues :

- **L'état d'un chantier** : *attend le client* dès qu'une tâche restante attend (c'est ce qui
  bloque, il l'emporte) ; *fait* quand tout est coché ; *en cours* dès une tâche cochée **ou une
  tâche restante prévue aujourd'hui ou avant** — on a commencé même sans rien finir ; sinon
  *à faire* ; *sans tâche* ne compte pas. Ordre dans la fiche : en cours, attend, à faire, sans
  tâche, fait.
- **L'avancement** est la part de toutes les tâches du projet ; sans tâche, aucun pourcentage
  (`null`) plutôt qu'un faux 0 %.
- **En retard** : une tâche dont le jour prévu ou l'échéance est passé ; un chantier dont la date
  est passée sans être fini ; un projet dont la mise en ligne est passée avec des tâches restantes.
  Un retard se date au jour dépassé le plus ancien.
- **En danger** (§4.5) : échéance dans 7 jours ou moins avec plus de la moitié des tâches
  restantes, ou un chantier qui a dépassé sa date. Un projet déjà en retard n'est pas « en
  danger » : il est en retard, une seule alerte suffit. La raison est rendue en toutes lettres.
- **Cette semaine** : aujourd'hui et les six jours suivants, par le jour prévu sinon l'échéance ;
  les retards ont leur propre section et n'y sont pas répétés.
- **L'attente du client** : celle posée sur un projet, la plus longue d'abord (pour savoir qui
  relancer), puis les tâches qui attendent. Au-delà de 7 jours (`NUDGE_DAYS`), elle se signalera.
- **Les projets actifs** sont les signés et en production — les pistes et devis appartiennent au
  pipeline, les livrés et en maintenance n'ont plus de chantiers en cours. Échéance la plus proche
  d'abord, sans échéance à la fin.
- **L'échéancier** : acompte arrondi au centime, le solde est ce qui reste — la somme fait
  toujours le prix.

1196 → **1224** tests unitaires (+28), vérifications de bout en bout inchangées : **885/885** en
mode comptes (866 en local).

---

## 15. Étape 3 : la V1 (05/10/2026)

L'écran du module (`ProjetsScreen`) et ses composants :

- **Trois vues** en pastilles, la dernière retenue sur l'appareil (`projets.view.v1`) :
  **Tableau de bord** (en retard, cette semaine, en attente du client, projets actifs avec
  leurs chantiers en cours et le danger dit en clair), **Projets** (tous, rangés par statut de la
  relation, les terminés et perdus repliés) et **Clients** (coordonnées, téléphone et e-mail qui
  se touchent, projets du client).
- **Nouveau projet** (`ProjectCreator`) : un client existant ou un nouveau sans quitter la
  fenêtre, le modèle en quatre cartes (avec leur nombre de chantiers et de tâches), le titre qui
  suit le modèle tant qu'on ne l'a pas écrit, le statut (« Piste » par défaut), la mise en ligne
  prévue et le prix. Le modèle est recopié aussitôt (`instantiateTemplate` puis
  `addWorkstreams`) et la fiche s'ouvre.
- **La fiche** (`ProjectSheet`) : client, métier et téléphone, statut à changer sur place,
  échéance, prix, avancement ; l'attente du client (`WaitingBar` : « J'attends quelque chose du
  client » → ce qu'on attend → « C'est reçu », « à relancer » au-delà de 7 jours) ; trois
  onglets — **Chantiers** groupés par état (`WorkstreamBlock`, ajout d'une tâche sur place),
  **Journal** (`Journal`, notes datées) et **Infos** (`ProjectInfos` : titre, client, dates,
  prix, note, numéro du projet, suppression).
- **Fenêtres** : `ClientEditor`, `TaskEditor` (jours, attente du client, chantier, note),
  `WorkstreamEditor` (nom, date, suppression avec ses tâches) ; une enveloppe commune (`Modal`)
  qu'un clic à côté ne ferme pas, et Échap si.
- `lib/money.ts` (montants à la française, en centimes) et `lib/format.ts` (dates courtes,
  « demain », « jeu. 8 », « dans 5 j », « depuis 9 jours »), testées ; `lib/colors.ts` donne à
  chaque projet une couleur de la palette tirée de son numéro.

Choix faits en l'écrivant :

- **Seuls les chantiers en cours, en attente ou sans tâche s'ouvrent** ; ceux à faire et finis
  se replient. La première version les ouvrait tous sauf les finis : une fiche tout juste tirée
  du modèle déroulait ses 45 tâches d'un coup (vu sur une capture).
- **Cocher est immédiat à l'écran**, la relecture remet la vérité en cas d'échec. Les autres
  écritures attendent le stockage puis relisent tout : quelques projets, quelques centaines de
  tâches au plus.
- **Rien de tapé ne se perd** : une tâche ajoutée sur place qui échoue garde son titre dans le
  champ, avec le message ; les fenêtres gardent leur saisie et affichent l'erreur ; le statut et
  l'attente, changés hors fenêtre, signalent l'échec dans le bandeau commun.
- **Le texte d'une tâche se sélectionne** : le rond coche, le ✎ ouvre la fenêtre (leçon de
  Tâches).
- Le module n'a **pas de section de réglages** : le bouton ⚙ ouvre la fenêtre commune
  (sauvegarde, compte).

1224 → **1230** tests unitaires (+6 : montants et dates), vérifications de bout en bout : les 5
du signet remplacées par **49** sur le vrai parcours, dont le rendu téléphone — **910/910** en
local et **929/929** en mode comptes.

---

## 16. Étape 4 : besoins, design, liens et pipeline (06/10/2026)

- **Migration** `supabase/2026-10-06-projets-design-links.sql` : la colonne `design` des projets
  (un objet JSON, comme `needs`) et la table `projets_links` (sorte, nom, adresse, identifiant,
  note ; RLS complet). **Aucune colonne pour un mot de passe**, et un test le vérifie
  (`schema.test.ts`).
- **Le questionnaire de besoins** (`lib/needs.ts`, `NeedsForm`) : 20 questions en 8 sections
  (l'activité, le but du site, les pages, les fonctions, les contenus, l'identité, le technique,
  le cadre), en texte libre ou en choix multiples. Chaque question peut être marquée **« à
  demander au client »** : tant qu'elle n'a pas de réponse, elle remonte dans « En attente du
  client » du tableau de bord (une ligne par projet, « 2 questions à lui poser »).
- **Le brouillon sur l'appareil** (`data/needsDraft.ts`, clé `projets.needs-draft.v1:<projet>`) :
  chaque frappe y est gardée, une page rechargée le reprend (« brouillon repris sur cet
  appareil »), « Enregistrer » l'efface. C'est la réponse au rendez-vous dans une boutique sans
  réseau (§5), sans file hors ligne.
- **La fiche design** (`lib/design.ts`, `DesignPanel`) : jusqu'à 8 couleurs (code lu sous
  toutes ses formes, `E7B7C3` → `#e7b7c3`), toucher une pastille copie son code, le texte de la
  pastille choisi pour rester lisible (luminance WCAG) ; polices, ambiance, sites de référence
  devenus des liens.
- **Les liens et les accès** (`lib/links.ts`, `LinksPanel`, `LinkEditor`) : dix sortes
  (maquette, dossier, préproduction, site, nom de domaine, hébergement, back-office, autre compte,
  devis, autre), rangées dans cet ordre ; l'identifiant se copie d'un toucher.
- **Le pipeline** (`ProjectsView`) : une colonne par statut, vides comprises ; empilées sur
  téléphone ; les terminés et perdus repliés dessous.

Choix faits en l'écrivant :

- **Un mot de passe noté est refusé**, dans le nom, l'identifiant ou la note : « mdp : … »,
  « mot de passe = … », « password: … ». Il faut les deux-points ou le signe égal : « mot de
  passe dans Bitwarden » est précisément ce qu'on veut lire. Un garde-fou contre le réflexe, pas
  une détection infaillible (§3.7).
- **Une adresse ne s'ouvre qu'en http(s) ou mailto** ; sans protocole, elle devient
  `https://…`. Un `javascript:` glissé dans une sauvegarde ne fait rien au clic.
- **Le questionnaire et la fiche design se relisent quoi que contienne la base**
  (`normalizeNeeds`, `normalizeDesign`) : une valeur écrite à la main ou par une version future
  ne casse pas l'écran. Une réponse vidée disparaît, pour qu'une question effacée ne compte plus.
- **Une question répondue n'est plus « à demander »**, même si la marque est restée : on n'a pas
  à penser à la retirer.
- Le logo et les captures de maquette attendent l'étape 7 (les images) ; un lien suffit d'ici là.

1230 → **1249** tests unitaires (+19), 49 → **70** vérifications de bout en bout pour le module
(dont un rechargement au milieu du questionnaire), **931/931** en local et **950/950** en mode
comptes. **Migration à appliquer par Jules.**

---

## 17. Étape 5 : l'argent et le temps passé (06/10/2026)

- **Migration** `supabase/2026-10-06-projets-payments-time.sql` : `projets_payments` (numéro
  unique par compte, nom, montant, attendu le, reçu le, mode de règlement, référence de facture ;
  un mode exige une réception) et `projets_time` (jour, minutes, chantier facultatif en
  `on delete set null`, note), RLS complet.
- **Au socle** (`core/lib/services.ts`) : `ExpenseRequest.direction` (`'expense'` par défaut,
  `'income'`). Budget applique le signe (`budget/data/expenseService.ts`, testé) ; Courses n'a
  rien changé. Le service garde son nom.
- `lib/payments.ts` (encaissé, reste, écart avec le prix, retards, échéancier en paiements,
  l'argent tous projets confondus), `lib/time.ts` (« 2h30 », « 1,5 h », « 45 » → minutes ; taux
  horaire réel), `lib/receipts.ts` (livre des recettes d'une année, CSV pour un tableur
  français) — testées.
- **L'onglet Argent** (`MoneyPanel`) : prix, encaissé, reste, jauge ; les paiements, « Reçu »
  (`PaymentReceiver` : jour, mode, facture, « Ajouter à Budget » coché d'office), modifier,
  « Pas encore reçu », supprimer (`PaymentEditor`) ; le temps passé et le taux horaire réel, sur
  le prix convenu et sur l'encaissé.
- **Le tableau de bord** gagne un panneau Argent : encaissé ce mois-ci et cette année, reste à
  encaisser sur les projets ouverts, paiements en retard.
- **Recettes** (`ReceiptsView`) : une quatrième vue, les encaissements d'une année dans l'ordre,
  le total, l'export CSV.

Choix faits en l'écrivant :

- **L'échéancier 30 / 70 est posé d'office** à la création d'un projet qui a un prix : l'acompte
  attendu au début du projet (ou le jour même), le solde à la mise en ligne prévue. Sans prix,
  l'onglet propose de le poser plus tard.
- **Le paiement d'abord, Budget ensuite.** Un échec de Budget laisse le paiement noté, avec
  « Ajouter à Budget » pour réessayer, jamais l'inverse. Dans l'autre sens — « Pas encore reçu »,
  supprimer un paiement, supprimer un projet — **Budget d'abord**, pour ne jamais laisser une
  entrée orpheline (même règle que Courses).
- **La référence vers Budget est `projets:paiement:<numéro>`**, pas l'identifiant, qu'une
  restauration change. Rejouer l'envoi ne double rien.
- **Catégorie demandée : « Revenus freelance »**, trouvée par son nom ; inconnue de Budget, l'entrée
  y est « à classer ». Elle n'est pas créée d'office : c'est à Jules de la créer dans Budget s'il
  la veut.
- **Le prix n'est pas recalculé** depuis les paiements : un écart se dit en clair (« il en
  manque 300 € », « ils dépassent le prix de 150 € »), sans rien corriger en silence.
- **Le reste à encaisser ne passe jamais sous zéro** ; sans prix fixé, il se compte sur les
  paiements prévus.
- **Le livre des recettes est une aide**, présentée comme telle à l'écran : pas une comptabilité
  certifiée. Le CSV porte un en-tête UTF-8 (sans lui, Excel abîme les accents), le
  point-virgule, la virgule décimale et les dates JJ/MM/AAAA.

1249 → **1267** tests unitaires (+18, dont un pour Budget), 70 → **86** vérifications de bout en
bout pour le module (dont l'entrée vue de l'autre côté, dans Budget, et le contenu du CSV
téléchargé), **947/947** en local et **966/966** en mode comptes. **Migration à appliquer par
Jules.**

---

## Sources

- Réforme de la facturation électronique : calendrier publié par l'administration (impots.gouv.fr,
  « facturation électronique entre entreprises ») — réception obligatoire pour toutes les
  entreprises au 1er septembre 2026, émission pour les PME et micro-entreprises au 1er septembre
  2027. **À revérifier** au moment de créer l'entreprise : ce calendrier a déjà été repoussé.
- Obligations du micro-entrepreneur (livre des recettes, mentions des factures, plafonds de
  chiffre d'affaires) : autoentrepreneur.urssaf.fr et service-public.fr.
- Produits cités (§2) : présentations publiques de Trello, Asana, ClickUp, Basecamp, Notion,
  Dubsado, HoneyBook, Moxie, Bonsai, Plutio, Indy, Abby, Freebe. Aucune fonctionnalité n'a été
  essayée dans le détail ; l'étude retient des idées, pas des comparatifs.
