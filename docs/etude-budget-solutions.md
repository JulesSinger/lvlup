> **Pourquoi ce document est ici.** C'est l'étude qui a conduit à construire le module Astra
> plutôt qu'à prendre une application existante ou un tableur. Elle porte deux contraintes
> dont dépend la conception d'Astra, et qu'il ne faut pas redécouvrir : **la connexion
> automatique à la banque est fermée aux particuliers** (BoursoBank n'ouvre ses API DSP2
> qu'aux prestataires agréés, et les intermédiaires gratuits ont fermé), et **l'import du
> relevé CSV depuis l'espace client est la seule voie gratuite et pérenne**. C'est ce qui
> justifie `budget_rules` : rendre cet import de moins en moins coûteux au fil des mois.
>
> Août 2026. Les prix et les offres cités sont à revérifier avant d'en tirer une décision.

---

# Tenir son budget dans un premier appartement — analyse comparative des solutions

**Pour :** Jules — emménagement seul d'ici ~2 mois (octobre 2026)
**Contrainte absolue :** 0 € dépensé. Aucun abonnement, aucun achat intégré.
**Contexte matériel :** iPhone + ordinateur.

---

## 1. Ce qu'il faut clarifier avant de comparer

Tu as posé cinq exigences. Elles n'ont pas du tout le même poids dans le choix final, et c'est ce déséquilibre qui décide de tout :

| # | Exigence | Difficulté à satisfaire gratuitement |
|---|----------|--------------------------------------|
| 1 | Suivre les frais fixes chaque mois | Facile — toutes les solutions le font |
| 2 | Catégories de dépenses **personnalisées** | **Difficile** — c'est très souvent la première fonction mise derrière le paywall |
| 3 | Comparer plusieurs mois pour identifier où économiser | **Difficile** — l'historique multi-mois est l'autre grand classique du paywall |
| 4 | Plusieurs types de visualisations (camembert, tableau, courbes) | Moyen |
| 5 | Alimentation automatique si possible | Facile — la synchro bancaire est souvent gratuite |

**Le point contre-intuitif :** ce n'est pas la connexion bancaire qui est payante en France, c'est l'*analyse*. Les agrégateurs offrent la collecte des données (c'est leur produit d'appel, et ils se rémunèrent par le cashback et les offres de crédit) et facturent la personnalisation et la profondeur d'historique — exactement tes exigences 2 et 3.

Autrement dit : **les apps gratuites sont excellentes pour collecter, faibles pour analyser. C'est l'inverse de ton besoin.**

---

## 2. Les options, une par une

### Option A — Une application existante (agrégateur bancaire)

**Bankin'**
Version gratuite : synchronisation illimitée avec 350+ établissements, catégorisation automatique, budget mensuel avec alertes, notifications.
Passent en payant (Bankin' Plus, ~3,33 €/mois en annuel, ~4,99 €/mois sans engagement) : **les catégories de dépenses personnalisées**, **l'historique budgétaire sur plusieurs mois**, et l'export CSV/Excel illimité.
Autre point : la version gratuite affiche de la publicité, et l'app pousse activement du crédit à la consommation et du cashback — sollicitations à connaître quand on emménage et qu'on est financièrement tendu.

> **Verdict : la version gratuite échoue précisément sur tes exigences 2 et 3.** C'est un excellent outil, mais pas gratuitement pour ton usage.

**Linxo (Linxo Lab)**
Présenté comme entièrement gratuit, sans publicité, avec 1 700+ connecteurs bancaires, catégorisation automatique et budgets. La limite documentée : **pas de catégories personnalisées**.

> **Verdict : le meilleur "collecteur" gratuit du marché français.** Il coche 1, 4 (partiellement) et 5, mais pas 2.

**Gérer mes comptes**
Propose les catégories personnalisées gratuitement, mais l'app iOS fonctionne sur un essai premium de 3 mois puis bascule sur des abonnements payants (2,99 € à 6,99 €/mois selon le stockage). Note App Store moyenne (3,7/5).

> **Verdict : incompatible avec ta contrainte — le piège classique de l'essai gratuit qui expire pile quand tes données sont dedans.**

**Apps à saisie manuelle (Spendee, Wallet, Goodbudget, 1Money…)**
Toutes freemium. Les visualisations riches, les catégories illimitées et la synchro multi-appareils sont systématiquement dans la version payante. YNAB, souvent citée comme la meilleure, est purement payante sur abonnement.

**Bilan de l'option A :** aucune application existante ne satisfait *simultanément* tes cinq exigences à 0 €. Toutes en couvrent 3 ou 4, et te font payer la cinquième. Et c'est structurel : leur modèle économique est bâti sur le fait que tu t'attaches à l'outil pendant 3 mois avant de buter sur le mur.

**Le risque caché de l'option A :** tes données vivent chez eux. Si l'app change de politique tarifaire dans 8 mois (Linxo a déjà fait évoluer son modèle par le passé), tu perds ton historique ou tu payes. Après un an de suivi, cet historique est justement devenu ta ressource la plus précieuse.

---

### Option B — Un tableur (Google Sheets ou Excel)

**Gratuité :** totale et définitive. Google Sheets est gratuit à vie avec un compte Google, application iPhone incluse, synchro entre téléphone et ordinateur. Excel en ligne est également gratuit. Aucun modèle économique ne viendra un jour te réclamer un abonnement pour voir tes propres chiffres.

**Contre tes exigences :**

- **Catégories personnalisées :** illimitées, tu les définis toi-même, tu les changes quand tu veux. ✅
- **Multi-mois :** un onglet par mois ou une seule table alimentée en continu, avec des tableaux croisés dynamiques qui comparent 3, 6 ou 12 mois. Aucune limite. ✅
- **Visualisations :** camembert par catégorie, barres empilées mois par mois, courbes de tendance, jauges de budget restant, tableau détaillé filtrable. Tout est natif. ✅
- **Frais fixes :** un onglet dédié qui se recopie automatiquement chaque mois. ✅
- **Automatisation :** c'est ici que le tableur perd — la saisie est manuelle. ⚠️

**La réponse au problème de la saisie :** tu n'as pas besoin de l'app pour automatiser. **Ta banque te permet déjà d'exporter tes relevés en CSV depuis ton espace en ligne, gratuitement, sans intermédiaire.** Une fois par mois, tu télécharges le fichier, tu le colles dans un onglet, et des formules le catégorisent automatiquement à partir de règles sur le libellé ("MONOPRIX" → Courses, "ENEDIS" → Énergie). Tu ajustes les 5 à 10 lignes ambiguës. Compte 10 à 15 minutes par mois.

C'est même *supérieur* à la synchro d'un agrégateur sur un plan : c'est ce passage en revue mensuel qui te fait réellement voir tes dépenses. La synchro automatique a un effet pervers documenté — on regarde de moins en moins, parce que "l'app s'en occupe".

**Vrai inconvénient :** l'ajout de dépense en cours de journée sur iPhone est moins agréable que dans une app dédiée. Mais avec l'import mensuel, tu n'as pas besoin de saisir au fil de l'eau — sauf pour les dépenses en espèces.

---

### Option C — Une app sur mesure construite avec moi

**Ce que ça permet :** exactement ton besoin, ni plus ni moins, avec l'interface et les vues que tu veux. Intellectuellement satisfaisant, et je peux la produire rapidement.

**Ce que ça coûte réellement — et c'est là que ça se joue :**

Une app, ce n'est pas seulement un écran. C'est une **base de données qui doit survivre des années**, être accessible depuis ton iPhone *et* ton ordinateur, être sauvegardée, et continuer à fonctionner sans que personne ne la maintienne. Une page web autonome que je te livre ne stocke rien durablement de manière fiable : sans hébergement, tes données vivent dans un fichier local que tu peux perdre en changeant de téléphone ou en vidant un cache.

Pour une vraie app persistante il faudrait un hébergement et une base de données. Il existe des offres gratuites, mais leurs paliers gratuits changent, expirent, ou exigent une carte bancaire — tu réintroduis exactement le risque que tu voulais éviter.

**Le problème de fond :** dans 6 mois, quand tu voudras ajouter une catégorie ou corriger un bug, il faudra revenir vers moi. Ton budget deviendrait dépendant d'une conversation. Un tableur, tu le modifies toi-même en 30 secondes.

> **Verdict : excellente option en V2, mauvaise option en V1.** Tu ne sais pas encore précisément ce que tu veux (tu le dis toi-même) — construire du sur-mesure avant de connaître son besoin est le meilleur moyen de construire la mauvaise chose. Six mois de tableur te diront exactement quelles vues tu regardes vraiment et lesquelles tu n'as jamais ouvertes.

---

### Option D — Les options que tu n'avais pas envisagées

**D1. L'outil de budget intégré à ta banque**
La plupart des banques françaises proposent désormais gratuitement, dans leur propre application, une catégorisation automatique et des graphiques de répartition (BoursoBank a Wicount Budget, le Crédit Agricole et les autres réseaux ont leurs équivalents). Zéro installation, zéro partage de tes identifiants à un tiers, zéro risque de paywall.
*Limite :* catégories généralement figées, analyse superficielle, et inutilisable si tu as plusieurs banques.
**→ À utiliser comme complément de contrôle, pas comme outil principal.**

**D2. La structure de comptes — la solution "sans outil"**
Souvent plus efficace que n'importe quelle app : ouvre un **second compte courant gratuit** dédié aux charges fixes (loyer, énergie, internet, assurance, abonnements). Le 2 de chaque mois, un virement automatique y dépose le montant exact de tes charges. Tous les prélèvements partent de là.
Résultat : ce qui reste sur ton compte principal est ton budget réellement disponible, sans calcul. Ton reste-à-vivre devient un solde que tu lis en 2 secondes.
**→ Ce n'est pas une alternative au suivi, c'est ce qui le rend facile.** À mettre en place dès l'emménagement, quelle que soit l'option retenue. Particulièrement adapté à un premier appartement, où le vrai risque n'est pas de mal analyser mais de se faire surprendre par un prélèvement.

**D3. Notion**
Gratuit en usage personnel, joli, bases de données avec vues multiples. Mais : calculs sur plusieurs mois laborieux, graphiques natifs pauvres, et saisie plus lente qu'un tableur. Beaucoup de setup pour un résultat analytique inférieur.
**→ Non recommandé pour du budget chiffré.**

**D4. Logiciels libres auto-hébergés (Actual Budget, Firefly III)**
Gratuits, open source, très puissants, tes données t'appartiennent. Mais ils exigent d'installer et de maintenir un serveur. Sans compétence ni envie d'administration système, c'est un projet à part entière — et un budget non tenu pendant que tu débugges ton installation.
**→ À écarter, sauf si l'aspect technique t'intéresse pour lui-même.**

**D5. L'approche hybride — celle que je recommande**
Séparer le rôle de **collecte** et le rôle d'**analyse**, au lieu de chercher un outil qui fasse bien les deux gratuitement (il n'existe pas).

---

## 3. Tableau de synthèse

| Critère | App existante (Bankin'/Linxo gratuit) | Tableur | App sur mesure | Hybride recommandé |
|---|---|---|---|---|
| Coût réel à 12 mois | 0 € mais fonctions clés bloquées | **0 €** | 0 € puis risque d'hébergement | **0 €** |
| Catégories personnalisées | ❌ payant ou absent | ✅ illimitées | ✅ | ✅ |
| Comparaison multi-mois | ❌ payant | ✅ illimitée | ✅ | ✅ |
| Variété des visualisations | ⚠️ imposées | ✅ toutes | ✅ | ✅ |
| Effort de saisie | ✅ automatique | ⚠️ ~15 min/mois | ⚠️ manuelle | ⚠️ ~15 min/mois |
| Tu possèdes tes données | ❌ | ✅ | ✅ | ✅ |
| Évolutif par toi-même | ❌ | ✅ | ❌ dépend de moi | ✅ |
| Résiste à un changement de tarif | ❌ | ✅ | ✅ | ✅ |
| Effort de mise en place | 15 min | 1–2 h (avec moi) | 3–4 h + maintenance | 1–2 h |

---

## 4. Recommandation

**Architecture en trois couches, entièrement gratuite et pérenne :**

1. **Collecte — export CSV de ta banque** (et/ou Linxo Lab en lecture, si tu veux la vue consolidée immédiate sur iPhone). Universel, gratuit, jamais soumis à un paywall.
2. **Analyse — un Google Sheets que je construis avec toi.** C'est le cœur : catégories que tu définis, catégorisation semi-automatique des libellés, suivi des frais fixes, comparaison mois par mois, et un onglet tableau de bord avec camembert de répartition, barres empilées par mois, courbe d'évolution du reste-à-vivre et tableau détaillé filtrable.
3. **Discipline — le compte dédié aux charges fixes (D2).** C'est ce qui fait que le suivi reste facile même les mois où tu n'as pas le temps.

**Puis, dans 6 mois :** si le tableur te frustre sur un point précis et identifié — et seulement à ce moment-là — on construit l'app sur mesure. Tu sauras alors exactement quoi lui demander, et le tableur aura servi de cahier des charges. C'est l'ordre inverse qui produit des outils abandonnés au bout de deux mois.

**Ce que je n'ai pas retenu, et pourquoi :** l'app existante seule, parce que la gratuité y est réelle mais s'arrête juste avant tes deux besoins principaux. L'app sur mesure seule, parce que la vraie difficulté n'est pas de la construire mais de la faire vivre — et parce que tu ne connais pas encore ton besoin.

---

## 5. Deux réserves honnêtes sur cette analyse

**Sur la fiabilité des prix.** Les détails des offres gratuites françaises (limites du nombre de comptes chez Bankin', périmètre exact du gratuit chez Linxo) varient d'une source à l'autre, y compris entre articles récents — le référencement de ce secteur est saturé de contenus affiliés. Les fourchettes de prix et le fait que la synchro soit gratuite sont cohérents partout ; le détail des limites, non. **Vérifie sur l'application au moment de l'installation avant de t'engager.**

**Sur le biais du tableur.** Le tableur gagne largement ici, mais il perd sur un point qui compte : le plaisir d'usage. Une app bien faite donne envie d'être ouverte ; un tableur, non. Si tu sais que tu n'ouvriras jamais un Google Sheets, alors Linxo Lab gratuit — même sans catégories personnalisées — te fera plus de bien qu'un tableur parfait que tu n'utilises pas. **Le meilleur outil de budget est celui que tu ouvres encore au sixième mois.**

---

## Sources

- [Comparatif applications gratuites de gestion de budget 2026 — Clubic](https://www.clubic.com/telecharger/actus-logiciels/article-723563-1-gestion-budget-apps-logiciels-gratuits.html)
- [Avis Bankin' 2026 : test complet, tarifs et alternatives — TousLesCashbacks](https://touslescashbacks.com/articles/avis-bankin-application-gestion-budget)
- [Linxo, Bankin', Budgea : comparatif des agrégateurs de comptes — Selectra](https://selectra.info/finance/guides/compte-bancaire/comparatif-agregateurs)
- [Bankin' : avis complet et test de l'agrégateur de comptes — Selectra](https://selectra.info/finance/guides/compte-bancaire/bankin-avis)
- [Comparatif outils de budget 2026 : Bankin vs Linxo — Solicio](https://solicio.fr/2026/02/03/outils-de-budget-bankin-linxo-agregateurs/)
- [Meilleure application budget iPhone : top applis iOS 2026 — Ptit'Clic](https://www.ptitclic.net/faire-des-economies/application-budget-iphone/)
- [Gérer mes comptes — App Store](https://apps.apple.com/fr/app/g%C3%A9rer-mes-comptes/id400927414)
- [Wicount Budget, l'outil gratuit de suivi des dépenses — Boursorama](https://www.boursorama.com/budget/banque/actualites/wicount-budget-l-outil-gratuit-qui-vous-accompagne-dans-vos-depenses-et-vos-projets-48b1bbcd24bcd0576ab16945f4a0e5a9)
- [Firefly III vs Actual Budget 2026 — selfhostable.dev](https://selfhostable.dev/blog/firefly-iii-vs-actual-budget-self-hosted-finance/)
