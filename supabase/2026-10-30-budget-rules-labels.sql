-- =====================================================================
--  Budget — migration : le carnet des libellés
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (2026-10-30) : « des fois je me demande à quoi
--  correspond la dépense, j'oublie, je cherche, et je réoublie ». Une
--  règle de classement peut maintenant dire ce que cache un libellé
--  (« COMPTOIR DE STA » = « Buvette ASNL »), avec ou sans catégorie.
--  Voir docs/etude-astra.md §18.
-- =====================================================================

alter table public.budget_rules
  add column if not exists label text not null default ''
    constraint budget_rules_label_check check (char_length(label) <= 60);
alter table public.budget_rules
  add column if not exists description text not null default ''
    constraint budget_rules_description_check check (char_length(description) <= 500);

-- Une fiche peut ne rien ranger : la catégorie devient facultative…
alter table public.budget_rules alter column category_id drop not null;

-- … mais une ligne doit dire quelque chose : ranger, nommer ou décrire.
alter table public.budget_rules drop constraint if exists budget_rules_useful_check;
alter table public.budget_rules add constraint budget_rules_useful_check
  check (category_id is not null or label <> '' or description <> '');
