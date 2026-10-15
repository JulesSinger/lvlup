# Les démos des modules

*Demande de Jules (15/10/2026) : une visite guidée par module, rejouable, sur des exemples —
« un placeholder qui montre comment utiliser le module ». Ses choix : **des données d'exemple**
plutôt que l'écran vide de la personne, **proposée à la première ouverture**, pour Tâches,
Calendar, Budget, Courses, Objectifs et Recettes d'abord.*

## Ce que voit la personne

- **À la première ouverture d'un module** qui a une démo, une ligne en haut : « Première fois dans
  Tâches ? Une démo d'une minute, sur des exemples. » — *Voir la démo* ou *Non merci*. Proposée une
  fois par module et par appareil (`atlas.demos.seen.v1`).
- **Ensuite**, un « ? » à côté du nom du module, et **Réglages → Démos**.
- **La démo** : le module s'ouvre sur des exemples, avec un bandeau « Démo de Tâches — des exemples ;
  rien n'est enregistré dans ton compte » (*Revoir la visite*, *Quitter la démo*), et une visite de
  4 à 6 bulles. Ce qui est montré est surligné ; l'écran reste utilisable dessous, on peut essayer.
  Sur téléphone, la bulle monte du bas.

## Comment ça marche

- **`?demo=<module>`** dans l'adresse (`core/lib/demo.ts`) : `core/data/index.ts` passe tout en
  mode local, et `localSnapshot` écrit dans **`atlas.demo.v1`**, jamais `palier.v1` ni le compte.
  Les exemples sont recréés à chaque ouverture ; quitter recharge l'app normale.
- **Un module déclare sa démo** (`AtlasModule.demo`, `core/lib/module.ts`) : `seed(today)` crée les
  exemples **avec son propre contrat de stockage** (pas un fichier de données : la démo reste juste
  quand le format change), et `tour`, une liste de bulles `{ target, title, body }` — `target` est
  un sélecteur CSS, absent pour une bulle au centre.
- **La visite** (`core/components/Tour.tsx`) suit l'élément montré (défilement, redimensionnement)
  et attend qu'il apparaisse ; introuvable au bout de 2,5 s, la bulle s'affiche au centre et le
  marque (`data-target-missing`).
- **Le « ? »** passe par `ModuleChromeContext` (`core/components/DemoChrome.tsx`), lu par
  `ModuleBrand` : aucun écran de module n'a été modifié pour l'afficher.

## Ajouter une démo à un module

1. `src/modules/<id>/demo.ts` : un `ModuleDemo` — `seed` avec le contrat du module, dates relatives
   à `today` ; `tour` sur des classes stables de l'écran d'arrivée.
2. `demo: <id>Demo` dans `module.ts`.
3. Rien d'autre : `e2e/core.mjs` (`demos`) parcourt **chaque démo listée dans les réglages**, bulle
   par bulle, et échoue si une bulle ne trouve plus ce qu'elle montre, ou si les vraies données
   ont bougé.
