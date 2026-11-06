-- Analiza AI: rulează o singură dată, după schema.sql.
-- Limitează numărul de analize pe zi pentru fiecare cont.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create or replace function public.consume_ai_quota(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_used integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.ai_usage as u (user_id, day, used)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set used = u.used + 1
  where u.used < p_limit
  returning u.used into current_used;
  return current_used is not null;
end;
$$;
revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
