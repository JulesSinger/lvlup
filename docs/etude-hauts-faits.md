# Hauts faits — étude du huitième module

*Étude de conception, écrite avant le code — même exercice que `docs/etude-taches.md`.
Objectif : savoir ce que le module doit être, ce qu'Atlas permet sous sa contrainte « gratuit à
vie » (les photos surtout), et comment il doit se présenter, avant d'écrire une ligne. Les
décisions qui reviennent à Jules sont regroupées en fin de document (§12). Une maquette
accompagne l'étude : `docs/maquette-hauts-faits.html`.*

Demande de Jules (29/09/2026) : « un module "Hauts faits" de la vie : passer le brevet, le bac,
faire un semi, premier appartement, 6 mois à l'étranger, diplôme d'ingénieur… avec la date et
potentiellement des photos pour me rappeler. […] La présentation / la forme compte beaucoup pour
ce module aussi. »

---

## 1. Ce que le module est, et ce qu'il n'est pas

Les sept modules d'Atlas servent le **quotidien** : on y écrit tous les jours, vite, souvent au
téléphone. Celui-ci est l'inverse :

- **peu d'entrées, chacune précieuse** : une vie, c'est quelques dizaines de hauts faits, une
  centaine au plus. Personne n'en ajoute trois par jour ;
- **rétroactif** : la plupart datent d'avant Atlas (le brevet, il y a dix ans). Il faut donc
  accepter une date **imprécise** — on sait l'année du brevet, rarement le jour ;
- **fait pour être regardé**, plus que pour être saisi. La saisie peut prendre deux minutes ;
  l'écran qui les montre, lui, doit donner envie d'y revenir.

D'où la conséquence qui guide toute l'étude : **la forme n'est pas une finition, c'est la
fonctionnalité.** Un tableau de lignes datées ferait le même travail qu'une note dans le
téléphone ; ce qui justifie un module, c'est la frise, les photos, l'âge qu'on avait, le
« il y a 7 ans aujourd'hui ».

**La frontière avec Objectifs.** Objectifs a déjà des trophées : ils récompensent un palier
franchi *dans l'app*, calculés par elle. Un haut fait est un moment *de la vie*, raconté par
soi, souvent sans aucun rapport avec un objectif suivi. Les deux se touchent à un seul endroit :
un objectif mené au bout (« courir un semi ») mérite d'être **gravé** ici — c'est un lien
facultatif (§7), pas une fusion.

**Ce que le module n'est pas** : un journal intime (pas d'entrée quotidienne), un album photo
(pas de photos sans haut fait), un réseau social (rien n'est partagé — règle n°2 de `CLAUDE.md`).

---

## 2. Le marché, et ce qu'on en retient

| Produit | Ce qu'il fait bien | Ce qu'on en garde |
|---|---|---|
| **Day One**, journaux intimes | « Ce jour-là » : ressortir ce qui s'est passé à la même date les années précédentes | le bandeau **« Ce jour-là »** et un rappel facultatif |
| **Photos d'Apple, Google Photos** | les souvenirs : une photo plein écran, une date, une émotion | la **photo de couverture en grand**, le titre posé dessus |
| **Hauts faits des jeux vidéo** (le mot vient de là : c'est le nom français des *achievements* de World of Warcraft) | la plaque : un emblème, un titre, une date de déblocage, un chiffre | le **médaillon** et le **chiffre clé** (« 1 h 52 », « mention Bien ») |
| **« Your life in weeks »** (Tim Urban, *Wait But Why*) | une vie entière en une grille de ~4 700 cases, une par semaine | la vue **« Une vie en semaines »**, les hauts faits posés dans la grille |
| **Frises chronologiques** (applis de *timeline*, CV visuels) | l'axe du temps, les périodes en bandes | la **frise** comme vue principale, les **périodes** (6 mois à l'étranger) en bande |

Ce que le marché fait aussi, et qu'on **laisse de côté** : partager publiquement, comparer aux
autres, badges imposés par l'app (« tu n'as pas encore débloqué Voyage ») — une case vide qu'on
n'a pas choisie culpabilise, elle ne motive pas.

---

## 3. Les briques d'un haut fait

| Champ | Obligatoire | Pourquoi |
|---|---|---|
| **Titre** | oui | « Brevet des collèges », « Semi-marathon de Paris » |
| **Date** avec sa **précision** (jour, mois ou année) | oui | le brevet : « 2014 » suffit ; le semi : « 2 mars 2025 ». Stockée comme le premier jour de la période + sa précision, pour trier sans mentir à l'affichage |
| **Date de fin** | non | fait du haut fait une **période** : « 6 mois à Madrid », « école d'ingénieur 2019 – 2022 » |
| **Catégorie** | oui | Études, Sport, Voyage, Chez-soi, Travail, Famille & amis, Création, Autre — une couleur et un emoji chacune (§12, Q3) |
| **Importance** : majeur ou non | non (non par défaut) | un majeur prend une grande carte avec sa photo dans la frise ; les autres restent compacts. C'est ce qui donne du relief à la frise au lieu d'une liste uniforme |
| **Chiffre clé** | non | un texte court mis en médaillon : « 1 h 52 min », « 16,4 / 20 », « mention Très bien », « 42 m² » |
| **Lieu** | non | texte libre (« Madrid », « Lycée Henri-IV ») — pas de carte en V1 (§4.6) |
| **Avec qui** | non | texte libre : « avec Léa et Tom » |
| **Récit** | non | quelques lignes pour se souvenir : ce qu'on ressentait, le détail qu'on oubliera |
| **Photos** | non | 0 à 12, une de couverture (§5) |

L'**âge** qu'on avait n'est pas un champ : il se calcule, à condition d'avoir donné sa date de
naissance (un réglage du module, facultatif — sans elle, pas d'âge ni de « vie en semaines »).

---

## 4. La présentation — le cœur du module

Tout ce qui suit reprend le langage d'Atlas (fond sombre étoilé, Cinzel pour les titres, Inter
pour le texte, palette commune de `base.css`), et marche dans les deux thèmes. La maquette
montre la frise, la fiche et la vie en semaines.

### 4.1 La frise (vue principale)

- Un axe vertical ; **chaque année en grand chiffre Cinzel**, avec l'âge à côté : « 2014 ·
  15 ans ». Les années sans haut fait se resserrent (une fine graduation) au lieu de laisser des
  trous.
- Un haut fait **majeur** : grande carte, photo de couverture en plein, titre posé sur un
  dégradé, chiffre clé en médaillon. Un haut fait **ordinaire** : une ligne compacte, pastille de
  catégorie, titre, date.
- Une **période** : une bande colorée le long de l'axe, de son début à sa fin (« Erasmus,
  Madrid »), avec ce qui s'y est passé à côté.
- Sur ordinateur, les cartes s'alternent de part et d'autre de l'axe ; sur téléphone, une seule
  colonne, l'axe à gauche.
- Du plus récent en haut, par défaut (question §12, Q5).
- Filtre par catégorie en pastilles, comme ailleurs dans Atlas.
- Les cartes **apparaissent au défilement** (fondu et léger glissement), sauf avec
  `prefers-reduced-motion`.

### 4.2 La fiche d'un haut fait

Plein écran, pensée comme une page de souvenir : la couverture en haut, sur toute la largeur,
titre en Cinzel posé dessus ; en dessous, la date longue et **« il y a 7 ans · tu avais
18 ans »**, le médaillon du chiffre clé, le lieu, avec qui, le récit, puis la galerie. Toucher
une photo ouvre la **visionneuse** : plein écran, fond noir, glisser d'une photo à l'autre,
Échap ou glisser vers le bas pour fermer.

Sans photo, la fiche ne doit pas paraître vide : l'emblème de la catégorie en grand, sur un
fond teinté de sa couleur, tient lieu de couverture.

### 4.3 Une vie en semaines

La grille de Tim Urban : une ligne par année de vie, 52 cases par ligne ; les semaines vécues
remplies, celle-ci qui brille, les hauts faits posés en points de leur couleur, les périodes en
bandes. Toucher un point ouvre sa fiche. C'est la vue la plus frappante du module, et elle ne
coûte presque rien : quelques milliers de cases dans un seul SVG (ou un `<canvas>`, à mesurer).
Elle demande la date de naissance ; sans elle, elle explique pourquoi et propose de la donner.

Le nombre de lignes affichées est une question de ton (§12, Q6) : jusqu'à aujourd'hui seulement,
ou jusqu'à 90 ans avec les semaines à venir en creux — ce qui est le propos de l'original, mais
peut peser.

### 4.4 « Ce jour-là »

Quand un haut fait tombe **à la même date** (précision au jour) une année passée, un bandeau en
tête de la frise : « Il y a 3 ans aujourd'hui — Semi-marathon de Paris ». Pour la précision au
mois, le bandeau vaut pour tout le mois (« Il y a 6 ans ce mois-ci »). Avec, en option et
coupé par défaut, un **rappel poussé** le matin même, par le mécanisme commun des rappels
(`coreStore.scheduleReminders`, §6 de `CLAUDE.md`) — aucune infrastructure nouvelle.

### 4.5 La vitrine

Une deuxième vue, en grille : un **médaillon par haut fait**, regroupés par catégorie, comme une
salle des trophées. Plus dense que la frise, pour voir d'un coup d'œil « tout ce que j'ai fait
en sport ». Jamais de médaillon vide pour ce qu'on n'a pas fait (§2).

### 4.6 Ce qui attendra

- **La carte des lieux** (Leaflet et les tuiles OpenStreetMap, gratuites mais avec une politique
  d'usage, et un géocodage limité à un appel par seconde) : faisable, mais c'est un chantier en
  soi. Le lieu reste un texte en V1 ; la carte viendra si Jules veut « voir où ».
- **La carte souvenir** : une image générée (canvas) d'un haut fait — photo, titre, date — à
  garder ou à envoyer par le partage du téléphone. Joli, pas indispensable.
- **Les hauts faits à venir** (une *bucket list*) : c'est plutôt le rôle d'Objectifs ; à
  trancher (§12, Q7).

### 4.7 La cérémonie

Ajouter un haut fait, c'est rare : ça mérite un petit moment. À l'enregistrement, la carte se
pose dans la frise avec un éclat doré et un scintillement bref (pas de confettis : ce n'est pas
une victoire du jour, c'est un souvenir). Objectifs a sa cérémonie de palier ; celle-ci en est
une cousine sobre, écrite dans le module (aucun import entre modules).

---

## 5. Les photos — la vraie difficulté

C'est la première fois qu'Atlas stocke des **fichiers**. Tout le reste du module est du déjà-vu.

### 5.1 Où les mettre sans rien payer

**Supabase Storage**, inclus dans le palier gratuit du projet déjà en place : **1 Go de
fichiers** (et une bande passante sortante mensuelle limitée) — chiffres à revérifier sur la
page de tarifs au moment de construire. Écartés : Cloudflare R2 (10 Go gratuits, mais une carte
bancaire est exigée à l'activation — règle n°1), Google Drive ou iCloud (pas d'accès simple et
gratuit depuis une page web sans serveur).

Un **bucket privé** `hautsfaits`, chaque fichier rangé sous `<id du compte>/…`, et des
politiques RLS sur `storage.objects` qui n'autorisent un compte qu'à son propre dossier — le même
principe que les tables, écrit dans la migration.

### 5.2 Faire tenir 1 Go

Une photo d'iPhone pèse 3 à 5 Mo. **L'app la réduit avant l'envoi**, dans le navigateur
(`createImageBitmap` puis un `<canvas>`) :

- une version **grande** (2 048 px sur le grand côté, qualité ~0,82) : ~300 à 500 Ko ;
- une **miniature** (480 px) : ~30 à 40 Ko, la seule chargée par la frise.

Soit **2 000 à 3 000 photos** dans 1 Go — large pour une personne, à surveiller pour « quelques
proches » puisque le quota est commun au projet. D'où un plafond par haut fait (12 photos, à
discuter) et une jauge dans les réglages du module.

Deux bonus de ce ré-encodage : il **retire les métadonnées** (dont la position GPS) de la copie
stockée, et il normalise le format (Safari fournit déjà du JPEG à un `<input type="file">`,
même pour une photo HEIC).

### 5.3 La date de la photo, proposée

Avant de réduire la photo, l'app lit sa date de prise de vue (EXIF `DateTimeOriginal`, un petit
lecteur maison, pur et testé) et **propose** de dater le haut fait avec elle quand la date est
encore vide. Retrouver le jour exact du semi de 2019 devient un geste.

### 5.4 Charger peu, une seule fois

La frise ne demande que des miniatures ; la grande version ne se charge qu'à l'ouverture de la
visionneuse. Un bucket privé se lit par des **liens signés**, qui changent à chaque demande : le
cache du service worker ne les reconnaîtrait pas. Les photos sont donc téléchargées par leur
chemin et gardées sur l'appareil (Cache API, clé = chemin, qui ne change jamais puisqu'une
photo n'est jamais réécrite) : chaque photo traverse le réseau **une fois par appareil**.

### 5.5 En mode local

`localStorage` plafonne vers 5 Mo : inutilisable. L'implémentation locale range les photos dans
**IndexedDB**. Le contrat de stockage garde la même forme dans les deux modes (`addPhoto`,
`photoUrl`, `removePhoto`) — règle de `CLAUDE.md` §3.

### 5.6 La sauvegarde, et la règle « ne jamais perdre une donnée »

Le fichier de sauvegarde d'Atlas est un JSON : y mettre les photos en base64 le ferait passer à
des centaines de Mo. Proposition :

- la sauvegarde contient **tous les hauts faits et la liste de leurs photos**, pas leur contenu ;
- un bouton du module, « **Télécharger toutes mes photos** », produit une archive (un `.zip`
  écrit dans le navigateur) ;
- l'app le dit en toutes lettres à l'ajout : **l'original reste dans la photothèque du
  téléphone**, Atlas en garde une copie allégée.

### 5.7 Supprimer

Le stockage de fichiers ne suit pas les `on delete cascade` des tables. Supprimer un haut fait
supprime d'abord la ligne (et ses photos en base, par cascade), **puis** les fichiers : une
coupure entre les deux laisse au pire un fichier orphelin (de la place perdue, rattrapée par un
ménage au chargement), jamais un haut fait qui pointe vers des photos disparues.

### 5.8 Le socle ou le module ?

Stocker un fichier pourrait servir ailleurs un jour (un dessin dans une carte de Flashcards, une
photo de ticket dans Courses). La règle de `CLAUDE.md` §3 dit : **une pièce dont deux modules ont
besoin monte au socle**. Un seul module en a besoin aujourd'hui : l'envoi et la réduction vivent
dans le module, écrits pour pouvoir monter le jour où un deuxième en aura besoin — comme la file
hors ligne l'a fait avec Cérès.

---

## 6. Hors ligne

Ajouter un haut fait n'a rien d'urgent ni de mobile : on le fait chez soi, au calme. **Pas de
file hors ligne en V1** (proposition) : une écriture sans réseau échoue avec un message et le
formulaire reste rempli, comme chez Courses. Les ids sont choisis par l'application dès l'étape
1, pour pouvoir brancher la file commune plus tard sans migration. L'envoi d'une photo montre sa
progression et se relance s'il échoue ; le haut fait, lui, est enregistré avant ses photos.

---

## 7. Les liens avec les autres modules

Tous facultatifs, tous par les mécanismes existants — aucun import entre modules :

| Lien | Mécanisme | Quand |
|---|---|---|
| Les anniversaires de hauts faits dans **Calendar** | un calque `calendarSources` (masqué d'office), comme Budget | après la V1 |
| Le rappel « Ce jour-là » | `coreStore.scheduleReminders`, coupé par défaut | après la V1 |
| **« Graver dans les Hauts faits »** depuis Objectifs, quand un objectif est mené au bout | un service `feats` déclaré par ce module (`provides`), qui ouvre l'éditeur pré-rempli via `onOpenModule('hautsfaits', 'draft:…')` | plus tard, à décider |

---

## 8. Le modèle de données

```sql
hautsfaits_feats (
  id uuid primary key,                 -- choisi par l'application
  user_id uuid not null references auth.users on delete cascade,
  title text not null,                 -- 1 à 200 caractères
  category text not null,              -- CHECK : FEAT_CATEGORIES (as const + test, §5 de CLAUDE.md)
  date_start date not null,            -- premier jour de la période décrite
  date_precision text not null,        -- 'day' | 'month' | 'year'
  date_end date,                       -- période ; >= date_start
  date_end_precision text,
  major boolean not null default false,
  highlight text,                      -- le chiffre clé, 60 caractères au plus
  place text, people text, story text,
  cover_photo_id uuid,                 -- l'une de ses photos, ou la première
  created_at, updated_at
)

hautsfaits_photos (
  id uuid primary key,
  user_id uuid not null …,
  feat_id uuid not null references hautsfaits_feats on delete cascade,
  path text not null, thumb_path text not null,   -- dans le bucket `hautsfaits`
  width int, height int, taken_at timestamptz,
  position int not null, caption text
)

hautsfaits_settings (
  user_id uuid primary key …,
  birth_date date,                     -- facultative : âge et « vie en semaines »
  on_this_day_reminder boolean not null default false
)
```

Plus le bucket et ses politiques sur `storage.objects`. RLS complet sur les trois tables, avec
les quatre politiques nommées. Migration `AAAA-MM-JJ-hautsfaits-tables.sql`.

Une date à précision « année » est stockée au 1er janvier, « mois » au 1er du mois : le tri
marche tel quel, et c'est l'affichage (`formatFeatDate`) qui ne dit que ce qu'on sait. La date
de naissance vit en base plutôt que sur l'appareil, comme les réglages de Tâches : c'est une
donnée du compte, pas d'un téléphone.

---

## 9. Ce qui va bloquer, ou coûter

| Point | Coût | Parade |
|---|---|---|
| Premier stockage de fichiers d'Atlas | moyen : bucket, politiques, envoi, liens | tout dans une étape à part (étape 4), testé en mode comptes |
| Quota de 1 Go commun au projet | faible pour une personne | réduction à l'envoi, plafond par haut fait, jauge |
| Sauvegarde sans les photos | la règle n°3 en tension | archive `.zip` séparée, message clair, originaux dans le téléphone |
| Mode local : IndexedDB | nouveau dans Atlas | petit module du stockage local, testé avec `fake-indexeddb` (dépendance de test seulement) ou par la suite e2e |
| Photos en e2e | la suite doit envoyer une image | une petite image générée par Playwright (`setInputFiles` avec un tampon) |
| Frise et vie en semaines : de la mise en page, pas de la logique | se vérifie à l'œil | captures sur ordinateur et téléphone, dans les deux thèmes, à chaque étape |
| `var()` dans les attributs SVG sur iPhone | noté comme à vérifier (journal du 29/09) | à regarder sur le téléphone avec la vie en semaines |

Aucune dépendance nouvelle indispensable. L'archive `.zip` en demanderait une petite (fflate,
MIT) ou un écrivain maison sans compression — les JPEG ne se compressent de toute façon plus.

---

## 10. Nommer le module

Règle du 28/09/2026 : un nom fonctionnel. **« Hauts faits »** l'est, et c'est le mot de Jules.
Proposé :

- nom affiché **Hauts faits**, emoji **🏅** (🏆 évoquerait les trophées d'Objectifs ; 🏅 est la
  médaille qu'on garde) ;
- nom technique **`hautsfaits`** (minuscules, sans accent ni tiret : c'est le préfixe des
  tables et des classes CSS) ;
- accent **rose** (`#ee88b2`, `--pink`), la seule teinte de la palette qu'aucun module ne porte
  encore — ou l'or, si on veut le côté médaille, au risque de se confondre avec Objectifs.

Description pour le hub : « Les grands moments de ta vie, en frise et en photos ».

---

## 11. Fonctionnalités et découpage

### Liste des fonctionnalités

**V1** — ce qui fait exister le module :

1. Créer, modifier, supprimer un haut fait : titre, date à précision variable, date de fin
   (période), catégorie, majeur, chiffre clé, lieu, avec qui, récit.
2. **La frise** : années et âge, cartes majeures et compactes, périodes en bandes, filtre par
   catégorie, apparition au défilement.
3. **La fiche** plein écran, avec « il y a N ans · tu avais N ans ».
4. **Les photos** : ajout depuis le téléphone, réduction dans le navigateur, couverture,
   ordre, suppression, visionneuse plein écran ; date de prise de vue proposée.
5. Date de naissance dans les réglages du module.
6. La cérémonie sobre à l'ajout.
7. Quelques **suggestions** à l'écran vide, pour démarrer (« Brevet », « Bac », « Permis de
   conduire », « Premier appartement », « Premier emploi »…) : un toucher pré-remplit le
   titre et la catégorie. Un module rétroactif commence par une page blanche intimidante.

**Juste après** :

8. **Une vie en semaines.**
9. **« Ce jour-là »** en bandeau, puis le rappel poussé facultatif.
10. **La vitrine** des médaillons par catégorie.
11. Le calque des anniversaires dans Calendar.
12. « Télécharger toutes mes photos » (archive).

**Plus tard, si l'envie vient** : la carte des lieux, la carte souvenir partageable,
« Graver dans les Hauts faits » depuis Objectifs, la file hors ligne.

### Découpage en étapes

| Étape | Contenu | Ce qui est vrai à la fin |
|---|---|---|
| 1 | migration (tables, sans le bucket), contrat `HautsFaitsStore`, `LocalHautsFaits`, `SupabaseHautsFaits`, module signet, aperçu d'accueil | le module existe et passe `conventions.test.ts` |
| 2 | bibliothèques pures : dates à précision (`formatFeatDate`, tri, validation), âge, regroupement par année avec les années vides resserrées, « ce jour-là », suggestions | les règles sont justes avant d'être affichées |
| 3 | la frise, la fiche, l'éditeur, la cérémonie, les suggestions — **sans photo** | **la V1 sans photos** : on peut écrire sa vie |
| 4 | les photos : bucket et politiques, réduction, miniatures, IndexedDB en local, EXIF, visionneuse, cache sur l'appareil, ménage des orphelins | **la V1 complète** |
| 5 | une vie en semaines, « ce jour-là », la vitrine | la forme complète |
| 6 | calque Calendar, rappel « ce jour-là », archive des photos | les liens |

Chaque étape sur sa branche, `npm run test` et `npm run check` verts, journal tenu, captures
sur ordinateur et téléphone dans les deux thèmes pour toutes les étapes qui touchent l'écran.

---

## 12. Questions à trancher ensemble

1. **Nom et emoji** : « Hauts faits » 🏅, technique `hautsfaits` — d'accord ? Accent rose ou or ?
2. **Les photos en V1**, ou d'abord une V1 sans photo (étape 3) pour valider la forme, puis les
   photos (étape 4) ? Recommandé : dans cet ordre, mais les deux dans le même élan.
3. **Catégories** : une liste fixe (Études, Sport, Voyage, Chez-soi, Travail, Famille & amis,
   Création, Autre — plus simple, couleurs cohérentes), ou des catégories à soi comme dans
   Budget ? Recommandé : fixe en V1.
4. **Combien de photos par haut fait** : 12 ? Et accepter les vidéos ? (Recommandé : non — une
   seule vidéo de 30 s pèse autant que cent photos.)
5. **Sens de la frise** : le plus récent en haut (on voit d'abord le dernier haut fait), ou
   l'enfance en haut (on lit sa vie comme un livre) ? Un bouton pour inverser, retenu sur
   l'appareil ?
6. **Une vie en semaines** : jusqu'à aujourd'hui, ou jusqu'à 90 ans avec l'avenir en creux ?
7. **Hauts faits à venir** (bucket list) ici, ou c'est le rôle d'Objectifs ? Recommandé :
   Objectifs, avec le lien « Graver » plus tard.
8. **La sauvegarde des photos** : l'archive séparée te convient-elle, sachant que le JSON de
   sauvegarde ne les contiendra pas ?
9. **Partagé à des proches** un jour (« voir les hauts faits de Léa ») ? Recommandé : non —
   règle n°2, et le RLS actuel ne le permet pas sans chantier.

---

## 13. Décisions prises avec Jules (29/09/2026)

1. **Nom** : Hauts faits 🏅, nom technique `hautsfaits`. Couleur rose (`#ee88b2`), non
   contestée.
2. **Photos** : dans l'ordre recommandé, une V1 sans photos (étape 3) pour valider la forme,
   puis les photos (étape 4) juste après.
3. **Catégories fixes** pour le moment : Études, Sport, Voyage, Chez-soi, Travail, Famille &
   amis (`proches`), Création, Autre.
4. Recommandations acceptées (« ça me convient ») : 12 photos au plus par haut fait, pas de
   vidéo ; la sauvegarde JSON sans les photos, avec une archive à part ; les hauts faits à venir
   restent le rôle d'Objectifs ; rien de partagé.
5. **Sens de la frise** : le plus récent en haut.
6. **Une vie en semaines** : jusqu'à aujourd'hui, avec une bascule pour afficher jusqu'à 90 ans.

---

## 14. Étape 1 : le module existe (30/09/2026)

**La migration** `supabase/2026-09-30-hautsfaits-tables.sql` : `hautsfaits_feats` et
`hautsfaits_settings`, RLS complet. La base refuse d'elle-même : une catégorie ou une précision
inconnue, une date qui ne tombe pas au début de sa période (« mois » = le 1er, « année » = le
1er janvier), une fin sans précision (ou l'inverse), une fin avant le début. Les photos auront
leur migration à l'étape 4.

**Le contrat** `HautsFaitsStore` et ses deux implémentations. `createFeat(input, id)` est
**rejouable** (id choisi par l'application), comme les tâches et les entrées de Cérès. Retirer
la fin d'une période retire sa précision, dans les deux modes. Les réglages (date de naissance,
rappel « Ce jour-là ») sont dans le contrat dès maintenant. Catégories, précisions et longueur
du titre sont comparées aux contraintes de la migration par `lib/schema.test.ts`. La
restauration garde les identifiants, pour que les photos retrouvent leur haut fait.

**Le module** `hautsfaits`, un écran signet et un aperçu pour la page d'accueil (une petite
frise d'exemple).

`1060/1060` → `1080/1080` tests unitaires (+20 : `localHautsFaits.test.ts` 8, `schema.test.ts`
3, `conventions.test.ts` +9 pour le nouveau module),
**782/782** vérifications en local et **801/801** en mode comptes (+4 chacune).

**Migration appliquée par Jules** sur Supabase (confirmé le 30/09/2026).

---

## 15. Étape 2 : les règles, testées avant tout écran (30/09/2026)

Six bibliothèques pures dans `lib/`, sans écran :

- **`dates.ts`** : `alignDate` (la date rangée au début de sa période, ce que la base exige),
  `periodLastDay`, `formatFeatDate` (« 2014 », « juin 2018 », « 1er juillet 2022 »),
  `formatFeatSpan` pour une période, sans répéter ce qui est commun aux deux bouts
  (« janvier – juin 2021 », « 3 – 10 août 2023 »), et `sortFeats`. **Une date imprécise se place
  au début de sa période**, comme elle est rangée : « 2022 » passe après les jours connus de 2022
  dans la frise récente.
- **`age.ts`** : l'âge qu'on avait, **sans deviner**. Au jour près, « tu avais 18 ans ». Quand la
  période englobe un anniversaire (le brevet « en 2014 », né en mars 1999 : 14 ou 15 ans), on dit
  l'âge atteint : « l'année de tes 15 ans », « le mois de tes 23 ans ». `sinceLabel` dit le temps
  écoulé **pas plus précisément que la date** : un haut fait daté d'une année se compte en années
  (« l'an dernier », « il y a 12 ans »), au jour près on descend jusqu'à « hier ».
- **`timeline.ts`** : `buildTimeline` met la frise en lignes (année avec l'âge atteint, hauts
  faits, et une ligne qui **resserre les années vides** : « 2015 – 2016 »), dans les deux sens,
  filtrable par catégorie. L'écran n'aura qu'à dessiner.
- **`onThisDay.ts`** : ce qui revient aujourd'hui, les dates exactes puis les mois, le plus récent
  d'abord. Une date connue à l'année près ne revient jamais (on ne sait pas quel jour fêter). Un
  29 février revient le 28 les années qui n'en ont pas.
- **`suggestions.ts`** : neuf idées pour démarrer ; une idée disparaît dès qu'un haut fait porte
  son titre, casse, accents et espaces ignorés.
- **`validation.ts`** : les règles de la base dites en français, plus une qu'elle ne vérifie pas :
  **un haut fait est déjà arrivé**, sa date n'est pas après aujourd'hui (l'année ou le mois en
  cours restent permis). La **fin** d'une période peut, elle, être à venir : six mois à
  l'étranger commencés le mois dernier se notent déjà.
- **`categories.ts`** : nom, emoji et couleur de chaque catégorie (la couleur par sa variable de
  la palette, pour suivre le thème clair).

`1080/1080` → `1112/1112` tests unitaires (+32 : `dates.test.ts` 9, `age.test.ts` 9,
`timeline.test.ts` 8 — frise, « ce jour-là » et idées —, `validation.test.ts` 6), vérifications
e2e inchangées en nombre, **782/782** en local.

---

## 16. Étape 3 : la frise, sans photos (30/09/2026)

**L'écran** (`HautsFaitsScreen`) : l'en-tête compte les hauts faits et dit depuis quand ; le
bandeau **« Ce jour-là »** s'il y a lieu (un toucher ouvre la fiche) ; les pastilles de
catégorie, seulement quand il y en a au moins deux ; puis **la frise** (`Timeline`), qui ne fait
que dessiner `buildTimeline` : les années en grand chiffre Cinzel avec l'âge atteint, les grands
hauts faits en **cartes à couverture**, les autres en **lignes compactes**, les années vides
resserrées en une graduation. Sur ordinateur, les hauts faits s'alternent de part et d'autre
d'un axe doré ; sur téléphone, l'axe passe à gauche. Les hauts faits sous le bord de l'écran
apparaissent en douceur au défilement ; ceux déjà visibles ne bougent pas, et rien ne bouge avec
`prefers-reduced-motion`.

**La couverture sans photo** (`FeatCover`) : l'emblème de la catégorie en grand, incliné, sur un
fond teinté de sa couleur, le titre posé dessus et le chiffre clé en médaillon. Les photos
prendront sa place à l'étape 4.

**La fiche** (`FeatSheet`) : la couverture en grand, puis « Il y a 1 an · tu avais 25 ans », la
date (et la durée d'une période), le lieu, la catégorie, avec qui, le récit. Sans date de
naissance, elle propose de l'ajouter. **Supprimer demande confirmation dans la fiche même**
(« Supprimer … pour de bon ? » — Garder / Supprimer), jamais par une boîte du navigateur. Plein
écran sur téléphone.

**La fenêtre** (`FeatEditor`, `DateField`) : le titre, la catégorie en pastilles, la **date
saisie aussi précisément qu'on la connaît** — Jour (un calendrier), Mois (une liste et l'année ;
`<input type="month">` écarté, Safari sur ordinateur ne le connaît pas), Année —, « C'est une
période » qui ouvre la fin avec la même précision, « Un des grands », le chiffre clé, le lieu,
avec qui, le récit. Changer de précision garde ce qu'on a dit (`lib/editorDraft.ts`, testé) :
« 2 mars 2025 » → Mois → Jour revient au 2 mars. Comme dans Flashcards depuis le 29/09, **un clic
à côté ne ferme pas la fenêtre** : il effacerait ce qui a été écrit. Une erreur d'enregistrement
laisse la fenêtre remplie. Le bouton dit « Graver » pour un nouveau haut fait.

**La cérémonie** : le haut fait tout juste gravé est amené à l'écran, se pose avec un éclat doré
et une étincelle qui s'envole (1,5 s), sans confettis.

**L'écran vide** : une phrase, les neuf idées en pastilles (un toucher pré-remplit titre,
catégorie et précision), et « ＋ Autre chose ».

**La date de naissance** se règle dans le panneau de réglages commun
(`HautsFaitsSettingsSection`). L'écran restant ouvert derrière, un petit signal propre au module
(`data/settingsSignal.ts`) lui dit de relire ses réglages : l'âge apparaît dès la fenêtre fermée,
sans recharger. Le socle n'en sait rien.

Vérifié à l'œil sur captures (ordinateur en sombre et en clair, téléphone), avec une frise
d'exemple de huit hauts faits. `1112/1112` → `1121/1121` tests unitaires (+9 :
`editorDraft.test.ts`, dont la durée d'une période), 782 → 809 vérifications en local et 801 →
828 en mode comptes (+27 : les 4 du signet remplacées par 31 sur le vrai parcours), **809/809**
et **828/828**.

---

## 17. Étape 4 : les photos (30/09/2026)

**La migration** `supabase/2026-09-30-hautsfaits-photos.sql`, **premier stockage de fichiers
d'Atlas** : la table `hautsfaits_photos` (RLS complet) et un **bucket privé** `hautsfaits` (JPEG
seulement, 5 Mo au plus par fichier), dont les politiques sur `storage.objects` ne laissent un
compte toucher qu'à son dossier — le premier segment du chemin est son identifiant. **La
couverture est la photo en première position** : pas de colonne `cover_photo_id` à tenir à jour
(l'étude §8 en prévoyait une).

**Le contrat** gagne `listPhotos`, `addPhoto`, `photoBlob`, `setPhotoPositions`, `removePhoto`,
dans les deux implémentations :

- **en local**, les lignes vont dans le blob partagé, les images dans **IndexedDB**
  (`data/blobStore.ts`, base `atlas-hautsfaits`) ; en mémoire sous Node, pour les tests ;
- **avec un compte**, les images dans le bucket, sous `<compte>/<haut fait>/<photo>.jpg` (et
  `-thumb.jpg`), puis gardées sur l'appareil dans le Cache API sous leur chemin
  (`data/photoCache.ts`, cache `hautsfaits-photos-v1`) : chaque photo ne traverse le réseau
  qu'une fois par appareil.

**L'ordre des écritures** protège la règle n°3 : ajouter range les images **puis** écrit la
ligne ; retirer (une photo ou tout un haut fait) retire la ligne **puis** les fichiers. Une
coupure laisse au pire un fichier sans ligne, de la place perdue, jamais une ligne vers une image
absente. `addPhoto` est rejouable (même id, `upsert` des fichiers). La sauvegarde garde la liste
des photos, pas leur contenu ; une restauration **n'efface jamais un fichier** : sur le même
compte ou le même appareil, chaque photo retrouve son image.

**Réduire avant d'envoyer** (`data/preparePhoto.ts`) : une grande version de 2 048 px (jamais
agrandie) et une miniature de **720 px** (480 prévus par l'étude : trop flou sur un écran Retina
dans une carte de la frise), en JPEG. Le ré-encodage retire toutes les métadonnées, **position
GPS comprise** — vérifié de bout en bout sur les octets rangés. Un fichier que le navigateur ne
sait pas lire (un HEIC sur Chrome d'ordinateur) le dit en toutes lettres.

**La date de prise de vue** : un lecteur EXIF maison (`lib/exif.ts`, pur et testé, les deux
ordres d'octets, fichiers tronqués compris) la lit **avant** la réduction. À la création, si une
photo choisie dit une autre date, la fenêtre propose « 📷 Photo prise le 17 juin 2023 — Utiliser
cette date ». Proposée, jamais imposée.

**À l'écran** : la première photo fait la couverture de la carte (titre en blanc sur un dégradé
sombre, dans les deux thèmes) et la pastille d'une ligne compacte ; la carte dit « 3 photos ». La
fiche passe à la grande version (la miniature en attendant) et montre la **galerie** ; toucher une
photo ouvre la **visionneuse** (noire dans les deux thèmes ; glisser, flèches ou boutons ; Échap
ou glisser vers le bas ferme la visionneuse sans fermer la fiche). « Arranger » : « En couverture »,
et « Retirer » en deux touchers. On peut choisir ses photos **dès la création** (envoyées une fois
le haut fait enregistré) ou les ajouter depuis la fiche. L'envoi se suit dans un bandeau (« Ajout
des photos : 2 / 3 ») ; une photo qui échoue n'arrête pas les suivantes. Les réglages disent la
place prise (« 23 photos, 8,4 Mo »). Les photos se chargent **à part** des hauts faits : si leur
table manque encore, la frise s'affiche quand même, avec un message. Sur téléphone, la couverture
de la fiche passe en 4:3.

**Non vérifié automatiquement** : le chemin Supabase (envoi dans le bucket, politiques, cache sur
l'appareil) — la suite tourne en local. **À essayer pour de vrai avec un compte**, et sur l'iPhone
(photo HEIC de la photothèque, appareil photo).

`1121/1121` → `1134/1134` tests unitaires (+13 : `photos.test.ts` 8 dont le lecteur EXIF,
`localHautsFaits.test.ts` +5), 809 → 828 vérifications en local et 828 → 847 en mode comptes
(+19, avec de vrais JPEG fabriqués dans le navigateur), **828/828** et **847/847**.

---

## 18. Étape 5 : une vie en semaines, la vitrine (09/10/2026)

« Ce jour-là » existait déjà depuis l'étape 3 (le bandeau) ; l'étape ajoute les deux autres
façons de regarder. **Trois vues en tête de l'écran** : Frise, Semaines, Vitrine, la dernière
choisie retenue sur l'appareil (`hautsfaits.view.v1`). Le filtre par catégorie ne vaut que pour
la frise : la vitrine range déjà par catégorie. Graver un haut fait ramène à la frise, où se
joue la cérémonie.

**Une vie en semaines** (`lib/lifeWeeks.ts`, `LifeWeeksView`) : une ligne par année de vie,
52 cases. **Chaque ligne commence pile à un anniversaire** : la semaine se compte depuis
l'anniversaire de l'année, et les un ou deux jours qui dépassent 52 semaines tombent dans la
dernière case — la grille ne dérive jamais. Né un 29 février, la ligne suivante commence le 28.
Les semaines vécues sont pleines, celle-ci dorée (et qui respire, sauf `prefers-reduced-motion`),
les périodes en bandes de leur couleur, les hauts faits en points (plus gros pour les grands),
**posés au début de leur période** comme dans la frise — « 2014 » dans la case du 1er janvier.
Plusieurs hauts faits la même semaine : un point, qui les nomme tous et ouvre le plus récent.
Rien d'avant la naissance ; une période commencée avant est coupée à la naissance. La bascule
**« Jusqu'à 90 ans »** (décision du 29/09/2026) dessine les semaines à venir en creux et dit
« … sur 4 680 », retenue sur l'appareil (`hautsfaits.weeks.v1`). Sans date de naissance, la vue
explique pourquoi et mène aux réglages. Un seul SVG, chaque sorte de case en **un seul chemin**
(4 680 cases à 90 ans) ; seuls les points sont des éléments à part, avec une zone de toucher
plus large que le point (la grille est réduite de moitié sur téléphone).

**La vitrine** (`lib/showcase.ts`, `Showcase`) : une étagère par catégorie présente, dans
l'ordre fixe des catégories, un médaillon par haut fait (sa photo de couverture, sinon l'emblème
de la catégorie), le plus récent d'abord ; les grands ont un **anneau doré** ; sous le médaillon,
le chiffre clé s'il y en a un, sinon la date.

Vérifié sur captures (ordinateur en sombre et en clair, téléphone) ; première version des points
trop petits à toucher sur téléphone, agrandis. `1646` → `1651` tests unitaires (+5,
`lifeWeeks.test.ts`), suite du module 48 → **61** (+13).
