-- =====================================================================
--  Atlas — le connecteur de Claude : les jetons (docs/connecteur-claude.md)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  L'adresse du connecteur porte un jeton personnel (« atl_… »), créé dans
--  Réglages → Claude et montré une fois. Seule son empreinte SHA-256 est
--  rangée ici ; la fonction `atlas-mcp` calcule la même sur l'adresse reçue.
--  Table du socle : un jeton vaut pour tout Atlas (aujourd'hui, Recettes).
-- =====================================================================

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique check (char_length(token_hash) = 64),
  label        text not null default '' check (char_length(label) <= 80),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;

drop policy if exists "mcp_tokens_select_own" on public.mcp_tokens;
create policy "mcp_tokens_select_own" on public.mcp_tokens
  for select using (auth.uid() = user_id);
drop policy if exists "mcp_tokens_insert_own" on public.mcp_tokens;
create policy "mcp_tokens_insert_own" on public.mcp_tokens
  for insert with check (auth.uid() = user_id);
drop policy if exists "mcp_tokens_update_own" on public.mcp_tokens;
create policy "mcp_tokens_update_own" on public.mcp_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "mcp_tokens_delete_own" on public.mcp_tokens;
create policy "mcp_tokens_delete_own" on public.mcp_tokens
  for delete using (auth.uid() = user_id);
