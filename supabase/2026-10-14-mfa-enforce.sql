-- La double authentification, imposée par la base — docs/securite.md §7.
--
-- Supabase délivre d'abord une session « aal1 » (mot de passe), puis « aal2 »
-- une fois le code de l'app d'authentification donné. Sans cette migration,
-- l'écran du code ne serait qu'une porte peinte : avec un mot de passe volé,
-- on interrogerait l'API directement en aal1 et on lirait tout.
--
-- Une politique RESTRICTIVE s'ajoute aux quatre politiques de chaque table
-- (elle ne donne aucun droit, elle en retire) : un compte qui a une app
-- d'authentification vérifiée ne lit ni n'écrit rien en aal1. Un compte sans
-- double authentification n'est pas touché.
--
-- Rejouable. **Une table créée après doit recevoir la même politique** : rejouer
-- ce fichier suffit (la boucle prend toutes les tables de `public`).

-- auth.mfa_factors n'est pas lisible par le rôle `authenticated` : la vérification
-- passe par une fonction qui la lit avec les droits de son propriétaire, et ne
-- rend qu'un booléen sur le compte connecté.
create or replace function public.atlas_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.atlas_mfa_ok() from public, anon;
grant execute on function public.atlas_mfa_ok() to authenticated;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', t.tablename || '_mfa', t.tablename);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.atlas_mfa_ok()) with check (public.atlas_mfa_ok())',
      t.tablename || '_mfa',
      t.tablename
    );
  end loop;
end
$$;

-- Les fichiers (photos des hauts faits, images des projets, photos des recettes).
drop policy if exists "atlas_objects_mfa" on storage.objects;
create policy "atlas_objects_mfa" on storage.objects
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
