-- =====================================================================
-- Atlas : choisir ses modules (demande de Jules, 15/10/2026).
--
-- `profiles.hidden_modules` : les modules que le compte a cachés, vide =
-- tous visibles. `null` = jamais choisi : un compte tout neuf, à qui Atlas
-- demande d'abord par quoi commencer. Les comptes qui existent déjà gardent
-- tous leurs modules (mis à « aucun caché » une seule fois, à l'ajout de la
-- colonne) : ils ne voient pas l'écran de choix. Rejouable sans casse.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'hidden_modules'
  ) then
    alter table public.profiles add column hidden_modules text[];
    update public.profiles set hidden_modules = '{}';
  end if;
end $$;
