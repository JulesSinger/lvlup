-- ---------------------------------------------------------------------
-- Migration 9 — la nature « compte » manquait à la contrainte
--
-- Pourquoi elle existe : la migration 8 a été écrite quand il n'y avait que
-- cinq natures de palier. `cumul` a ensuite été scindé en deux — `compte`
-- (des jours distincts : « 30 jours sans écran ») et `cumul` (une somme :
-- « 100 km ») — parce que deviner laquelle à partir du nom de l'unité
-- marchait pour « jours » et cassait pour « nuits » ou « séances ».
--
-- Le type TypeScript a été mis à jour, la contrainte SQL non. Les deux ont
-- silencieusement divergé, et l'application a continué de compiler et de
-- passer ses tests : rien, côté code, ne connaît le contenu d'un CHECK.
--
-- Résultat en production : tout objectif comportant un palier « compte »
-- était refusé à la création par
--     new row for relation "tiers" violates check constraint "tiers_kind_check"
-- Ce qui touchait la quasi-totalité des habitudes et une bonne part des
-- modèles (« 30 jours sans écran », « 12 séances », « 7 jours à 10 000
-- pas »…), pendant que les objectifs faits de jalons ou de performances
-- passaient sans broncher.
--
-- Sans risque et rejouable : on ne fait qu'élargir la contrainte, aucune
-- ligne existante ne peut la violer.
-- ---------------------------------------------------------------------

alter table public.tiers
  drop constraint if exists tiers_kind_check;

alter table public.tiers
  add constraint tiers_kind_check
  check (kind in ('jalon', 'compte', 'cumul', 'serie', 'performance', 'mesure'));

-- Vérification : doit renvoyer la liste des six natures.
select pg_get_constraintdef(oid) as contrainte
from pg_constraint
where conname = 'tiers_kind_check';
