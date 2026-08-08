-- ============================================================================
-- Remettre un compte à zéro — Zénith
--
-- À coller dans Supabase Studio → SQL Editor. Remplace l'adresse ci-dessous,
-- puis exécute UNE SEULE des deux options.
--
-- Toutes les tables de l'app référencent `auth.users (id) on delete cascade` :
-- goals, tiers, actions, checkins, achievements, profiles, push_subscriptions.
-- Autrement dit, supprimer l'utilisateur emporte tout le reste — il n'y a
-- aucune table à nettoyer à la main, et rien ne peut rester orphelin.
--
-- ⚠️  Ces suppressions sont définitives. Il n'y a pas de corbeille.
--     Fais un export depuis l'app (Réglages → Exporter) avant, si tu veux
--     pouvoir revenir en arrière.
--
-- ----------------------------------------------------------------------------
-- REMISE À ZÉRO VRAIMENT PROPRE — l'ordre compte
--
-- La base n'est que la moitié du problème : le navigateur garde sept traces de
-- l'ancien compte, dont une dangereuse. Dans cet ordre :
--
--   1. DANS L'APP, désactiver le rappel quotidien (Réglages).
--      À faire AVANT la suppression : ça appelle `unsubscribeFromPush()` puis
--      `removePushDevice()`, donc ça nettoie le navigateur ET le serveur.
--      Dans l'autre sens, la ligne serveur disparaît et l'abonnement push
--      reste vivant dans le navigateur — l'app se croira abonnée pour
--      toujours, et le serveur n'en saura rien.
--
--   2. Se déconnecter (le jeton Supabase est retiré proprement).
--
--   3. Exécuter l'OPTION B ci-dessous.
--
--   4. DevTools → Application → Storage → « Clear site data », tout coché.
--      Ça vide d'un coup :
--        · palier.v1          les données du mode local
--        · zenith.outbox.v1   la file d'attente hors ligne  ← le fantôme vicieux :
--                             une coche en attente de l'ancien compte partirait
--                             vers le NOUVEAU au premier retour du réseau
--        · zenith.onboarded   sans quoi l'onboarding ne se réaffiche jamais
--        · zenith.muted       le réglage du son
--        · sb-<projet>-auth-token   la session Supabase
--        · le cache « zenith-v2 » et l'enregistrement du service worker
--
--   5. Recharger.
--
-- Une fenêtre de navigation privée ne remplace pas l'étape 4 : les
-- notifications push n'y fonctionnent pas de façon fiable, donc elle ne
-- prouve pas que le vrai parcours marche.
-- ----------------------------------------------------------------------------
-- ============================================================================

-- Mets ton adresse ici une fois pour toutes.
\set email 'ton.adresse@gmail.com'


-- ────────────────────────────────────────────────────────────────────────────
-- OPTION A — Vider les données, garder le compte
--
-- Pour repartir d'une app vide sans refaire d'inscription : l'utilisateur, son
-- mot de passe et sa session restent valides. C'est ce qu'il faut pour tester
-- l'écran d'accueil vide, l'onboarding et la création du premier objectif.
-- Ça ne teste PAS l'inscription elle-même.
-- ────────────────────────────────────────────────────────────────────────────

-- delete from public.goals              where user_id = (select id from auth.users where email = :'email');
-- delete from public.checkins           where user_id = (select id from auth.users where email = :'email');
-- delete from public.actions            where user_id = (select id from auth.users where email = :'email');
-- delete from public.achievements       where user_id = (select id from auth.users where email = :'email');
-- delete from public.push_subscriptions where user_id = (select id from auth.users where email = :'email');
-- update public.profiles
--    set daily_goal = 40, reminder_enabled = false, reminder_time = '20:00', tz_offset = 0
--  where user_id = (select id from auth.users where email = :'email');

-- Note : `delete from goals` suffit à emporter les paliers (tiers), et les
-- actions/checkins de ces objectifs. Les trois lignes suivantes ne servent
-- qu'à balayer d'éventuels restes sans objectif parent.


-- ────────────────────────────────────────────────────────────────────────────
-- OPTION B — Supprimer le compte entièrement
--
-- Pour retester l'inscription de zéro avec la même adresse : mail de
-- confirmation compris. La cascade emporte les sept tables.
--
-- Décommente la ligne pour l'exécuter.
-- ────────────────────────────────────────────────────────────────────────────

-- delete from auth.users where email = :'email';


-- ────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION — à lancer avant et après, ça ne modifie rien
-- ────────────────────────────────────────────────────────────────────────────

select
  u.email,
  u.created_at,
  u.email_confirmed_at,
  (select count(*) from public.goals              g where g.user_id = u.id) as objectifs,
  (select count(*) from public.tiers              t where t.user_id = u.id) as paliers,
  (select count(*) from public.actions            a where a.user_id = u.id) as actions,
  (select count(*) from public.checkins           c where c.user_id = u.id) as realisations,
  (select count(*) from public.achievements       h where h.user_id = u.id) as trophees,
  (select count(*) from public.push_subscriptions p where p.user_id = u.id) as appareils
from auth.users u
where u.email = :'email';
