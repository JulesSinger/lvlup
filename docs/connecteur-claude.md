# Le connecteur de Claude

> Demande de Jules (10/10/2026) : « créer un connecteur pour communiquer entre Atlas et Claude,
> par exemple pour demander de créer des objectifs, remplir des recettes, des courses… —
> gratuitement ? ». Puis (11/10/2026) : « pour l'instant une seule fonctionnalité : ajouter /
> modifier / supprimer sur tout le module de recette ; on fera le reste plus tard ».

## 1. Ce que c'est

Un **serveur MCP** (le protocole des connecteurs de Claude), hébergé comme une fonction Supabase,
`atlas-mcp`. Dans Claude — le site, l'app iPhone ou l'app d'ordinateur — on l'ajoute comme
**connecteur personnalisé**. Claude lit alors la liste des outils d'Atlas et les appelle quand on
le lui demande : « ajoute cette recette », « mets le curry au menu de jeudi soir », « note que
j'ai fait la tarte hier, 4 sur 5 ».

**Gratuit** : une fonction de plus dans le palier gratuit de Supabase (500 000 appels par mois).
Côté Claude, les connecteurs personnalisés existent sur tous les forfaits, un seul à la fois sur
le forfait gratuit (centre d'aide d'Anthropic, octobre 2026) ; l'abonnement de Jules à Claude
n'est pas une dépense d'Atlas. **Avec un compte seulement** : Claude se connecte depuis les
serveurs d'Anthropic, il lui faut un serveur à joindre.

## 2. Qui parle : une clé personnelle

> **Depuis le 11/10/2026 (soir)**, la clé voyage dans un **en-tête de requête**
> (`Authorization: Bearer atl_…`), que Claude garde à l'abri et n'affiche plus ; l'adresse,
> `…/functions/v1/atlas-mcp`, ne porte plus rien de secret. La première façon, ci-dessous (la clé
> en fin d'adresse), reste acceptée pour un connecteur déjà réglé — elle se voyait partout où
> l'adresse passait, jusque dans une conversation. Décision de Jules, après avoir collé une
> adresse dans une conversation.

### La première façon : une adresse secrète

L'adresse du connecteur porte un **jeton personnel** :

```
https://beddtzjoyvdrqxmtmkkr.supabase.co/functions/v1/atlas-mcp/atl_…
```

Créé dans **Réglages → Claude**, tiré sur l'appareil, **montré une seule fois** ; seule son
empreinte SHA-256 est rangée (`mcp_tokens`, migration `2026-10-11-mcp-tokens.sql`), comme le jeton
du raccourci de Sport. Le tirage et l'empreinte sont **remontés au socle**
(`core/lib/secretToken.ts`) : deuxième usage après Sport (CLAUDE.md §3). Révoquer l'adresse coupe
Claude aussitôt ; la liste dit quand chaque adresse a servi pour la dernière fois.

Pourquoi pas une connexion OAuth (« Se connecter avec Atlas ») : le guide de Supabase pour les
serveurs MCP ne la prévoit pas encore, et l'écrire soi-même (serveur d'autorisation, inscription
dynamique des clients) est un chantier en soi. Pour une personne seule, une adresse secrète et
révocable suffit. À revoir si des proches s'en servent un jour. Limite connue : l'adresse figure
dans les journaux de la fonction chez Supabase (accessibles au seul propriétaire du projet).

## 3. Le protocole, écrit à la main

`supabase/functions/atlas-mcp/mcp.ts`, pur et testé (`src/core/lib/mcpServer.test.ts`) :
transport **Streamable HTTP sans session** — chaque POST porte un message JSON-RPC (ou un lot),
la réponse est un JSON simple, jamais un flux SSE ; une notification seule reçoit 202. Quatre
méthodes : `initialize` (la version du protocole demandée si on la connaît, sinon la plus récente),
`ping`, `tools/list`, `tools/call`. Une erreur d'outil revient comme un **résultat `isError`**,
pas comme une erreur du protocole : Claude la lit, comprend (« le jour s'écrit AAAA-MM-JJ ») et
corrige son appel. Écrit à la main plutôt que pris au SDK : quatre méthodes, aucune dépendance à
suivre, tout se teste sans réseau. Les instructions du serveur disent à Claude la date du jour
(heure de Paris) et de demander confirmation avant toute suppression.

## 4. Les outils de Recettes

`supabase/functions/atlas-mcp/recettes.ts`, testé par `src/modules/recettes/lib/mcpTools.test.ts`
sur une base en mémoire — test qui compare aussi les bornes (catégories, repas, longueurs, nombres)
à celles du module : si l'un change, l'autre suit ou le test casse.

| Outil | Ce qu'il fait |
|---|---|
| `recettes_lister` | le carnet en résumé, ou une recherche (titre, étiquettes, ingrédients ; sans accents ni majuscules) |
| `recettes_lire` | une recette entière, avec les fois où elle a été faite |
| `recettes_creer` | une recette : titre, ingrédients (un par ligne, quantité en tête, groupes possibles), étapes, personnes, temps, catégorie, étiquettes, source, note, favori |
| `recettes_modifier` | seuls les champs donnés changent ; une liste donnée remplace la liste entière — des étapes réécrites **gardent leur temps** (même texte, sinon même place) |
| `recettes_minuter` | le temps des étapes (§20 de l'étude) : poste, durée, « tu es dessus » ou non, ce qui les déclenche (`launch`, `after_previous`, `{ end_of: N }`, `{ start_of: N, offset_minutes: M }`) ; `recettes_lire` le rend dans `steps_timing` |
| `recettes_supprimer` | avec sa photo (fichiers compris), son historique et ses places au menu — **marqué destructeur** |
| `recettes_menu_lister` | le menu entre deux jours, la semaine en cours par défaut |
| `recettes_menu_ajouter` | une recette ou un simple titre (« Restes »), à la suite dans le repas |
| `recettes_menu_modifier` / `recettes_menu_retirer` | déplacer, changer, retirer une entrée |
| `recettes_faite_ajouter` / `_modifier` / `_retirer` | « je l'ai faite » : jour (aujourd'hui par défaut), pour combien, note de 1 à 5, un mot |
| `recettes_toujours_la` | les ingrédients « toujours là » : lire, ajouter, retirer, remplacer |

Seule **la photo** reste à l'app : une image ne passe pas par un outil.

Les outils écrivent comme l'app : ingrédients rangés **tels qu'ils sont écrits** (l'app en calcule
la lecture pour ajuster les personnes et faire les courses), étiquettes en minuscules sans
doublon, une entrée du menu après les autres du même repas. Les refus sont dits en français, avec
ce qu'il faut corriger.

**La clé de service contourne le RLS** : chaque requête de la fonction porte donc `user_id = <compte
du jeton>` (`recettesData` dans `index.ts`), et un `recipe_id` donné par Claude est toujours
vérifié comme appartenant au compte avant d'être rattaché au menu ou à l'historique.

## 5. Ce qui a été vérifié, et ce qui reste à essayer

Vérifié : le protocole et chaque outil par les tests unitaires (13), la fonction par le typage avec
des doublures de Deno, l'écran des réglages par la suite du socle (sans compte, la section dit
qu'il en faut un). **Pas vérifiable automatiquement** : le vrai branchement dans Claude — c'est le
premier essai de Jules.

## 6. Mise en route (Jules, une fois)

1. Appliquer `supabase/2026-10-11-mcp-tokens.sql` et `supabase/2026-10-11-courses-close-trip-for.sql`
   dans Supabase Studio.
2. Déployer : `supabase functions deploy atlas-mcp --no-verify-jwt`.
3. Pousser (`git push`), ouvrir Atlas connecté : **Réglages → Claude → Créer une clé pour
   Claude** ; la fenêtre montre l'adresse et l'en-tête à copier.
4. Dans Claude : **Réglages → Connecteurs → Ajouter un connecteur personnalisé**, nom « Atlas »,
   l'adresse ; authentification « Aucune connexion » ; en-tête de requête `Authorization`, valeur
   `Bearer atl_…`.
5. Dans une conversation, activer le connecteur Atlas (menu des outils), puis : « Liste mes
   recettes », « Ajoute cette recette : … ».

## 8. Courses, et les tickets de caisse (11/10/2026)

Demande de Jules : « donner mon ticket de caisse à Claude et que tout soit rempli dans les courses
que j'ai faites ». **C'est Claude qui lit la photo** : Atlas ne paie aucun service de lecture ; le
connecteur reçoit des données déjà propres. Ses décisions : le ticket **coche la liste** ; la
**dépense est créée dans Budget** ; la clé passe dans un en-tête (§2).

`supabase/functions/atlas-mcp/courses.ts`, testé par `src/modules/courses/lib/mcpTools.test.ts` :

| Outil | Ce qu'il fait |
|---|---|
| `courses_enregistrer_ticket` | magasin, jour, total payé, articles (nom au propre, quantité, prix remises déduites) → la course, comme « Terminer la course » |
| `courses_catalogue` | les articles connus (rayon, récurrence, sur la liste, dernier prix) et les magasins — à lire avant un ticket, pour reprendre les noms |
| `courses_liste`, `courses_liste_ajouter`, `_modifier`, `_retirer` | la liste en cours ; un article déjà sur la liste n'y est jamais deux fois |
| `courses_article_modifier` | renommer un article, son rayon, sa quantité habituelle, sa récurrence |
| `courses_historique` | les dernières courses, leurs articles et prix, et si la dépense est dans Budget |
| `courses_supprimer_course` | une course enregistrée par erreur, et sa dépense — **marqué destructeur** |

**Le ticket, comme « Terminer la course »** (`ticketPlan`, comparé par un test à `buildClosePlan`
du module sur le même cas) : chaque ligne retrouve son article du catalogue (par `item_id`, ou par
son nom à la casse, aux accents et au pluriel près) ; **une ligne de la liste dont l'article est
sur le ticket est retirée**, cochée ou non ; le reste de la liste reste ; les articles habituels
reviennent quand c'est leur tour. Deux nouveautés par rapport à l'app : un article encore inconnu
**entre au catalogue** (ponctuel, rayon donné par Claude ou deviné), et un magasin inconnu est
créé. Le total est celui du ticket ; si la somme des lignes en diffère, le résultat le dit à Claude
(remise globale, sac, ligne mal lue), qui le signale. Les règles recopiées (rayons, catalogue,
récurrence, dépense) sont comparées à celles du module par le test.

**Une transaction, sans session** : la clôture de l'app (`courses_close_trip`) écrit pour
`auth.uid()`, que la fonction n'a pas. Variante `courses_close_trip_for(p_user, plan)` (migration
`2026-10-11-courses-close-trip-for.sql`), qui crée aussi le magasin et les articles nouveaux dans
la même transaction — **appelable seulement avec la clé de service** (`revoke` pour `anon` et
`authenticated`), sans quoi un compte pourrait écrire chez un autre.

**La dépense** : la même que l'app (`comete:course:<numéro>`, « Courses — Lidl », catégorie
« Courses » trouvée par son nom, sinon à classer), écrite directement dans `budget_entries` par la
fonction ; rejouer ne double rien. Un échec de Budget n'empêche pas la course (« Ajouter au
budget » reste dans l'historique de l'app). **Et le relevé bancaire ne la compte plus deux fois** :
l'import de Budget reconnaît désormais un paiement déjà enregistré par un module
(`docs/etude-astra.md` §16).

## 9. Sport, et le coach marathon (12/10/2026)

Demande de Jules : une conversation de Claude lui sert de **coach pour le marathon d'Annecy** —
elle a tout le contexte et lui donne les séances de la semaine. Il veut que ces séances arrivent
**dans le plan de Sport**, « et tout le reste dans ce module ». Une conversation ne peut pas en lire
une autre : c'est le connecteur, activé dans la conversation du coach, qui fait le lien.

`supabase/functions/atlas-mcp/sport.ts`, testé par `src/modules/sport/lib/mcpTools.test.ts` :

| Outil | Ce qu'il fait |
|---|---|
| `sport_resume` | à lire en premier : le plan (course, date, objectif et allure visée, semaine actuelle sur le total, jours restants), les séances de cette semaine et de la suivante, les km des 8 dernières semaines, les sorties des 14 derniers jours, FC et zones |
| `sport_semaine_programmer` | **le geste du coach** : les séances d'une semaine, qui **remplacent** celles prévues (du générateur ou d'une version précédente) |
| `sport_seance_ajouter` / `_modifier` / `_supprimer` | une séance à la fois ; changer son jour peut la faire changer de semaine |
| `sport_seance_cocher` | marquer faite une séance de renforcement ou de vélo (depuis le 12/10/2026, `docs/etude-sport.md` §23) |
| `sport_plan_lire` | les séances semaine par semaine, avec les sorties faites ces semaines-là pour comparer |
| `sport_plan_creer` / `sport_plan_modifier` | un plan vide vers une course (les séances se programment ensuite), ou la date, sa confirmation, l'objectif, l'état |
| `sport_sorties_lister` | les sorties, avec allure, FC, dénivelé, ressenti, note et temps au km |
| `sport_sortie_ajouter` / `_modifier` / `_supprimer` | une sortie sans montre ; la sorte, la note, le ressenti, la séance faite |
| `sport_reglages` | FC max et de repos, zones de Karvonen |

**Une séance a un jour, ou au moins une semaine du plan** (`week`, comme celles du générateur) :
le jour donne la semaine, calculée comme le module (`weekOfPlan`, du lundi de la semaine du début).
Allures écrites comme un coach (« 5:30 » par km), durées en minutes ou « 1:05:00 ». Course à pied,
et depuis le 12/10/2026 **renforcement** (`renfo`) et **vélo** (`velo`), sans allure, cochés à la
main. Remplacer une semaine écrit les
nouvelles séances **avant** de retirer les anciennes : une coupure laisse au pire un doublon, jamais
une semaine vide. Une sortie notée à l'heure de Paris (décalage d'été ou d'hiver lu pour ce jour).

Ce que le connecteur ne fait pas : la synchronisation de Strava (l'app la fait à l'ouverture de
Sport), les coches d'Objectifs (idem), recaler les semaines quand la date de la course change
(l'app le propose), supprimer un plan. Les règles recopiées (semaines, allures, zones, bornes)
sont comparées à celles du module par le test.

## 10. Tous les modules (12/10/2026)

Demande de Jules : « développe ce qu'il faut pour les MCP des autres modules, par ordre de
priorités » — l'ordre de l'analyse du 11/10/2026. Chaque module a son fichier d'outils à côté
de `recettes.ts`, et un test **dans le module** (`src/modules/<id>/lib/mcpTools.test.ts`) qui
compare chaque règle recopiée à celle du module. La fonction ne peut pas importer `src/` (Deno
demande des extensions `.ts`) : ce test est ce qui empêche les deux copies de diverger.

Règles communes à tous :

- **chaque requête filtre `user_id`** (la fonction parle avec la clé de service) ;
- une écriture se **valide avec les règles du module** avant de partir, et refuse avec une phrase
  plutôt que de laisser Postgres répondre ;
- **ce qui touche un autre module passe par sa règle** : un paiement de projet entre dans Budget
  sous `projets:paiement:<n>`, comme le service `expenses` ; une coche tenue par Sport (`ref`)
  n'est jamais réécrite ;
- **les rappels sont recalculés après chaque écriture** pour Calendar et Tâches, à l'heure de
  Paris (`zone.ts`), exactement comme l'écran à son ouverture (comparé par les tests) : un
  rendez-vous ou une tâche notés depuis Claude préviennent même si l'app n'est pas rouverte ;
- les instructions du serveur (`serverInfo`) disent à Claude, **une ligne par module**, quand
  utiliser quoi, et les liens entre modules.

## 11. Tâches

`taches.ts` (+ `recurrence.ts`, copie du moteur commun, comparée au texte près par
`src/core/lib/mcpShared.test.ts`) : `taches_lister` (Aujourd'hui, À venir, À faire, une liste,
Terminées), `taches_ajouter` (sous-tâches comprises), `taches_modifier`, `taches_cocher` (une tâche
répétée laisse sa copie terminée et avance, comme l'app), `taches_supprimer`, `taches_listes`,
`taches_liste_creer`, `taches_liste_modifier`. Claude lit lui-même « demain 9 h » : pas d'analyseur
d'ajout rapide côté serveur.

## 12. Le bilan transversal

`bilan.ts` : `atlas_bilan` — une semaine ou un mois (ou deux jours), tous modules d'un coup :
coches et PP d'Objectifs, km et séances de Sport, dépensé et entré de Budget (**mêmes règles que
le camembert** : virements et épargne écartés, remboursements nets par catégorie — comparé à
`computeMonthlyBreakdown`), tâches faites et en retard, recettes cuisinées, courses, kcal
moyennes, hauts faits. Un module dont la table manque est simplement absent.

## 13. Budget

`budget.ts` : `budget_categories` (et les règles), `budget_ecritures` (un mois, « à classer »,
recherche), `budget_mois` (l'Aperçu et le mois d'avant), `budget_classer` (plusieurs d'un coup),
`budget_ecriture_ajouter` / `_modifier` / `_supprimer`, `budget_regle_creer` (qui dit quelles
« à classer » des trois derniers mois elle aurait rangées) et `budget_regle_supprimer`. **Une
opération du relevé garde le jour et le montant de la banque** : seuls catégorie, libellé et note
changent. Une dépense notée à la main puis importée apparaîtrait deux fois : l'outil le dit.

## 14. Calendar

`calendar.ts` : `calendrier_evenements` (séries dépliées), `calendrier_ajouter`,
`calendrier_modifier`, `calendrier_supprimer`. Une série se modifie **cet événement / les suivants /
tous** avec `planEdit` et `planDelete` recopiés (comparés sur chaque portée) : seul ce qui change
s'applique à la série, et la nouvelle série est créée avant que l'ancienne soit raccourcie. Une
heure sans fin donne une heure ; 22 h → 1 h passe au lendemain. Les jours de la semaine d'une
répétition : **0 = dimanche** (la convention du moteur).

## 15. Objectifs

`objectifs.ts` : `objectifs_resume` (rang, prochain palier et sa progression — `tierProgress`
recopié et comparé sorte par sorte —, actions, coches du jour), `objectifs_cocher` (avec la
quantité ; une mesure exige son relevé ; jamais un jour à venir), `objectifs_decocher`,
`objectifs_geste` et `_retirer` (le geste ponctuel, 10 PP), `objectifs_historique`. **Claude ne
valide pas un palier** : il dit qu'il est atteint, l'app le valide à son ouverture (le
« rattrapage silencieux » de `ZenithScreen`), comme pour une coche venue de Sport. Ni objectif ni
palier ne se créent ici.

## 16. Flashcards

`flashcards.ts` : `flashcards_paquets`, `flashcards_paquet_creer` / `_modifier`,
`flashcards_cartes_ajouter` (200 par envoi, en boîte 1, à réviser dès aujourd'hui, rectos déjà
là écartés), `flashcards_cartes`, `flashcards_carte_modifier` / `_supprimer`. **Claude n'écrit
jamais de HTML** : l'app affiche recto et verso tels quels, alors Claude écrit un petit Markdown
(gras, italique, souligné, barré, surligné, code, listes) que `toCardHtml` traduit dans les
balises de l'éditeur, tout le reste échappé — vérifié avec un `<img onerror>`. Une carte dessinée
ne se réécrit pas (le dessin serait perdu). La révision reste à l'app.

## 17. Nutrition

`nutrition.ts` et **une copie de `ciqual.json`** à côté (260 Ko, identique à l'octet près à celle de
l'app : le test compare les deux fichiers) : `nutrition_journal` (un jour avec l'objectif et le
reste, ou une période), `nutrition_chercher` (ses aliments et CIQUAL, favoris et récents d'abord,
`searchFoods` recopié et comparé), `nutrition_ajouter`, `nutrition_modifier` (le poids remet les
valeurs à l'échelle), `nutrition_supprimer`. Un aliment trouvé prend les valeurs de la table ; à
défaut, une **estimation** de Claude, rangée sous « … (estimation) » et dite comme telle. Après une
régénération de CIQUAL (`scripts/import-ciqual.mjs`), recopier le fichier, sinon le test échoue.

## 18. Projets

`projets.ts` : `projets_tableau`, `projets_projet` (chantiers et leur état, journal, paiements,
taux horaire réel), `projets_tache_ajouter` / `_modifier` (cocher compris) / `_supprimer`,
`projets_note` (le journal), `projets_temps`, `projets_attente`, `projets_statut`,
`projets_paiement_recu` : le paiement d'abord, **puis l'entrée dans Budget** (« Revenus
freelance », référence `projets:paiement:<n>`, rejouable sans doublon) — comme l'app. Clients,
questionnaire, design, liens, images et échéancier restent à l'app.

## 19. Hauts faits

`hautsfaits.ts` : `hautsfaits_frise`, `hautsfaits_ajouter`, `hautsfaits_modifier`,
`hautsfaits_supprimer`. La date s'écrit **à la précision connue** — « 2019 », « 2019-06 »,
« 2019-06-14 » — et la précision s'en déduit ; `validateFeat` recopié et comparé. Les photos restent à
l'app ; un haut fait qui en a ne se supprime pas ici (ses fichiers resteraient dans le stockage).

## 20. Ce qui reste

- **91 outils** : Claude les reçoit tous à chaque conversation. Si la liste gêne (lenteur, outils
  mal choisis), un connecteur par groupe de modules se ferait sans rien réécrire : chaque fichier
  exporte déjà sa liste.
- Recettes → Courses n'a pas d'outil à soi : `recettes_lire`, `recettes_toujours_la` et
  `courses_liste_ajouter` suffisent, et les instructions demandent la relecture de Jules avant
  l'envoi (décision du 08/10/2026 : jamais automatique).
- Les rappels de Projets, Sport, Budget et Hauts faits restent recalculés à l'ouverture de leur
  module (leurs dates changent rarement depuis Claude).
- À essayer pour de vrai, avec la clé : une tâche à 9 h demain doit sonner sans ouvrir l'app.
