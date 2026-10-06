-- =====================================================================
--  Budget — migration : payer une dépense avec une enveloppe
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  docs/etude-astra-epargne.md §6 bis prévoyait un vrai lien « si refaire
--  le geste à la main s'avère pénible » : Jules l'a demandé le 2026-10-07.
--  Un retrait d'enveloppe peut désormais désigner la dépense qu'il paie.
--  Le total épargné ne bouge toujours pas (§6 bis) : seule l'étiquette
--  « réservé pour… » diminue.
-- =====================================================================

alter table public.budget_envelope_moves
  add column if not exists entry_id uuid references public.budget_entries (id) on delete cascade;

-- Une dépense est payée par une enveloppe au plus.
create unique index if not exists budget_envelope_moves_entry_unique
  on public.budget_envelope_moves (entry_id)
  where entry_id is not null;
