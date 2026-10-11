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

## 2. Qui parle : une adresse secrète

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
| `recettes_modifier` | seuls les champs donnés changent ; une liste donnée remplace la liste entière |
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

1. Appliquer `supabase/2026-10-11-mcp-tokens.sql` dans Supabase Studio.
2. Déployer : `supabase functions deploy atlas-mcp --no-verify-jwt`.
3. Pousser (`git push`), ouvrir Atlas connecté : **Réglages → Claude → Créer l'adresse du
   connecteur**, la copier.
4. Dans Claude : **Réglages → Connecteurs → Ajouter un connecteur personnalisé**, nom « Atlas »,
   l'adresse ; rien d'autre.
5. Dans une conversation, activer le connecteur Atlas (menu des outils), puis : « Liste mes
   recettes », « Ajoute cette recette : … ».

## 7. La suite

Un module à la fois, chacun avec son fichier d'outils à côté de `recettes.ts` et son test qui
compare ses bornes à celles du module : Courses (ajouter à la liste), Objectifs (créer un objectif,
cocher), Tâches (l'ajout rapide en français), Budget, Sport. À trancher pour chacun : ce qui peut
se supprimer depuis Claude.
