-- Atelier de idei: rulează o singură dată în Supabase, la SQL Editor.
-- Fiecare utilizator poate citi și modifica doar propriile rânduri.
create table if not exists public.ideas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  data jsonb not null check (pg_column_size(data) < 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  last_review date,
  target_date date,
  updated_at timestamptz not null default now()
);
alter table public.ideas enable row level security;
alter table public.user_settings enable row level security;

create policy "ideile mele: citire" on public.ideas for select to authenticated using ((select auth.uid()) = user_id);
create policy "ideile mele: adăugare" on public.ideas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ideile mele: modificare" on public.ideas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ideile mele: ștergere" on public.ideas for delete to authenticated using ((select auth.uid()) = user_id);
create policy "setările mele: citire" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "setările mele: adăugare" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "setările mele: modificare" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.ideas, public.user_settings from anon;
grant select, insert, update, delete on public.ideas to authenticated;
grant select, insert, update on public.user_settings to authenticated;
