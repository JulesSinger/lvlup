# Tier lists — le douzième module

Demande de Jules (10/11/2026) : « un module qui me permettra de créer et faire des tier lists ».

## 1. Décisions de Jules

- **Ce qu'on classe** : du texte, et des images qu'il ajoute.
- **Pour lui seul** : ni partage, ni lien public.
- **Glisser-déposer** pour ranger, à la souris comme au doigt.
- **Rangées modifiables** : S, A, B, C, D par défaut ; renommer, recolorer, ajouter, supprimer, déplacer.

## 2. Ce qui est livré (V1)

- Une grille de ses tier lists (la plus récemment touchée en tête), créer, renommer, décrire, supprimer.
- Le plateau : les rangées colorées, puis **« À classer »**, collée en bas de l'écran pour glisser
  sans tout faire défiler, avec l'ajout d'éléments :
  - du texte (plusieurs lignes collées d'un coup = un élément par ligne) ;
  - des images : bouton, fichier glissé depuis le Finder, ou **coller** (⌘V) une image copiée sur un
    site. Le nom du fichier devient le nom de l'élément (« Ahri.png » → « Ahri »), sauf un nom
    d'appareil photo ou de capture (`IMG_1234`, `Screenshot…`).
- **Glisser-déposer** (`components/useDrag.ts`, aux événements de pointeur, sans bibliothèque) :
  à la souris après 5 px ; **au doigt après un appui de 280 ms**, sinon c'est un défilement normal ;
  un trait montre où l'élément tombera ; la page défile seule près des bords ; Échap annule.
- **« Envoyer à »** dans la fenêtre d'un élément : classer sans glisser (clavier, lecteur d'écran,
  ou doigt qui préfère toucher). Renommer ou supprimer l'élément au même endroit.
- Une rangée : nom (12 caractères), 15 couleurs de la palette, monter / descendre, supprimer — ses
  éléments retournent à classer, jamais perdus.
- « Tout remettre à classer » pour refaire une liste, dans l'ordre du classement.

## 3. Données

Migration `supabase/2026-11-10-tierlists-tables.sql` : `tierlists_lists`, `tierlists_tiers`,
`tierlists_items` (RLS complet + double authentification), bucket privé `tierlists` (5 Mo, JPEG).
Une image est réduite dans le navigateur (900 px + vignette 240 px) puis rangée sous
`<compte>/<liste>/<élément>.jpg`. `tier_id` nul = à classer ; une rangée supprimée y renvoie ses
éléments (`on delete set null`). Les règles pures (`lib/board.ts` : place après un déplacement,
point de chute, rangées par défaut) sont testées ; les deux stockages partagent `lib/validation.ts`.
La suppression de compte efface aussi le bucket `tierlists` (`account-delete`, à redéployer).

## 4. Pas dans la V1, à proposer

- Exporter une tier list en image (pour l'envoyer à quelqu'un).
- Dupliquer une liste comme modèle (mêmes éléments, tout à classer).
- Le hors ligne, et des outils dans le connecteur de Claude (créer une liste depuis une conversation).
