-- =====================================================================
--  Astra — sous-catégories (« Restaurants & bars » → « Restaurants », « Bar »)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  `parent_id` référence une autre ligne de `budget_categories` — un seul
--  niveau de profondeur (une sous-catégorie ne peut pas elle-même être
--  parente, contrôlé côté application, pas ici). `on delete set null`, pas
--  `cascade` : supprimer une catégorie ne doit jamais supprimer les
--  sous-catégories qu'elle porte, seulement les détacher — elles
--  deviennent des catégories normales (« promues »), exactement comme
--  `budget_entries.category_id` redevient « à classer » plutôt que de
--  disparaître. Rien de saisi par l'utilisateur ne se perd jamais.
-- =====================================================================

alter table public.budget_categories
  add column if not exists parent_id uuid references public.budget_categories (id) on delete set null;

create index if not exists budget_categories_parent_idx
  on public.budget_categories (parent_id);
