-- =====================================================================
--  Orbite (Flashcards) — migration : recto et verso jusqu'à 200 000 caractères
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (29/09/2026) : des dessins sur les cartes. Un dessin est
--  rangé dans le HTML du recto ou du verso sous forme de traits
--  (`lib/drawing.ts`), quelques Ko par croquis : les 2000 caractères d'origine
--  (2026-08-30-flashcards-tables.sql) n'y suffisaient pas. Les contraintes
--  d'origine, nommées automatiquement par Postgres, sont remplacées par des
--  contraintes nommées, comparées par `lib/schema.test.ts` à `CARD_FACE_MAX`.
-- =====================================================================

alter table public.flashcards_cards drop constraint if exists flashcards_cards_front_check;
alter table public.flashcards_cards add constraint flashcards_cards_front_check
  check (char_length(front) between 1 and 200000);

alter table public.flashcards_cards drop constraint if exists flashcards_cards_back_check;
alter table public.flashcards_cards add constraint flashcards_cards_back_check
  check (char_length(back) between 1 and 200000);
