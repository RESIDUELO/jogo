-- Residuelo — esquema do backend online (Supabase / PostgreSQL).
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Pode ser executado de novo sem problemas (idempotente).

-- ============================================================ PROFILES (USERS)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Jogador',
  avatar text not null default '🩺',
  xp integer not null default 0,
  level integer not null default 1,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  answered integer not null default 0,
  correct integer not null default 0,
  best_streak integer not null default 0,
  win_streak integer not null default 0,
  cat_stats jsonb not null default '{}'::jsonb,
  week_xp integer not null default 0,
  week_start date,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles: leitura pública" on public.profiles;
create policy "profiles: leitura pública" on public.profiles for select using (true);
drop policy if exists "profiles: cria o próprio" on public.profiles;
create policy "profiles: cria o próprio" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles: edita o próprio" on public.profiles;
create policy "profiles: edita o próprio" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- cria o perfil automaticamente no cadastro (nome vem dos metadados do signUp)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ MATCHES
create table if not exists public.online_matches (
  id uuid primary key default gen_random_uuid(),
  code text unique,                         -- código de convite (sala privada)
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'abandoned')),
  ranked boolean not null default false,
  config jsonb not null default '{"exams": [], "cats": []}'::jsonb,
  player_a uuid not null references public.profiles (id) on delete cascade,
  player_b uuid references public.profiles (id) on delete cascade,
  state jsonb,                              -- MatchState do motor (src/engine/match.ts)
  version integer not null default 0,       -- controle de concorrência otimista
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists online_matches_players on public.online_matches (player_a, player_b, status);

alter table public.online_matches enable row level security;
drop policy if exists "matches: participantes leem" on public.online_matches;
create policy "matches: participantes leem" on public.online_matches for select
  using (auth.uid() = player_a or auth.uid() = player_b);
drop policy if exists "matches: cria como jogador A" on public.online_matches;
create policy "matches: cria como jogador A" on public.online_matches for insert
  with check (auth.uid() = player_a);
drop policy if exists "matches: participantes atualizam" on public.online_matches;
create policy "matches: participantes atualizam" on public.online_matches for update
  using (auth.uid() = player_a or auth.uid() = player_b)
  with check (auth.uid() = player_a or auth.uid() = player_b);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists online_matches_touch on public.online_matches;
create trigger online_matches_touch before update on public.online_matches
  for each row execute function public.touch_updated_at();

-- ============================================================ MATCHMAKING
create table if not exists public.mm_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rating integer not null,
  config_key text not null,
  config jsonb not null,
  ranked boolean not null default false,
  match_id uuid references public.online_matches (id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
alter table public.mm_queue enable row level security;
drop policy if exists "fila: vê a própria entrada" on public.mm_queue;
create policy "fila: vê a própria entrada" on public.mm_queue for select using (auth.uid() = user_id);
drop policy if exists "fila: sai da fila" on public.mm_queue;
create policy "fila: sai da fila" on public.mm_queue for delete using (auth.uid() = user_id);

-- Procura adversário com a mesma configuração e rating dentro da janela.
-- Chamada repetidamente pelo cliente (janela crescente). Retorna o id da
-- partida quando pareado; senão, coloca/renova o jogador na fila e retorna null.
create or replace function public.find_match(p_config jsonb, p_key text, p_rating integer, p_window integer, p_ranked boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cand public.mm_queue%rowtype;
  mid uuid;
begin
  if me is null then raise exception 'não autenticado'; end if;

  -- alguém já me pareou enquanto eu esperava?
  select match_id into mid from public.mm_queue where user_id = me and match_id is not null;
  if mid is not null then
    delete from public.mm_queue where user_id = me;
    return mid;
  end if;

  select * into cand from public.mm_queue q
   where q.config_key = p_key and q.user_id <> me and q.match_id is null
     and abs(q.rating - p_rating) <= p_window
     and q.seen_at > now() - interval '15 seconds'   -- só quem ainda está procurando
   order by q.created_at
   limit 1
   for update skip locked;

  if found then
    insert into public.online_matches (status, ranked, config, player_a, player_b)
    values ('active', p_ranked, p_config, cand.user_id, me)
    returning id into mid;
    update public.mm_queue set match_id = mid where user_id = cand.user_id;
    delete from public.mm_queue where user_id = me;
    return mid;
  end if;

  insert into public.mm_queue (user_id, rating, config_key, config, ranked)
  values (me, p_rating, p_key, p_config, p_ranked)
  on conflict (user_id) do update
    set rating = excluded.rating,
        config = excluded.config,
        ranked = excluded.ranked,
        created_at = case when public.mm_queue.config_key = excluded.config_key then public.mm_queue.created_at else now() end,
        config_key = excluded.config_key,
        match_id = null,
        seen_at = now();
  return null;
end $$;

-- Entrar em sala privada pelo código.
create or replace function public.join_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then raise exception 'não autenticado'; end if;
  update public.online_matches
     set player_b = me, status = 'active'
   where code = upper(trim(p_code)) and status = 'waiting' and player_a <> me and player_b is null
  returning id into mid;
  if mid is null then
    select id into mid from public.online_matches
     where code = upper(trim(p_code)) and (player_a = me or player_b = me);
  end if;
  if mid is null then raise exception 'Código inválido ou sala já iniciada'; end if;
  return mid;
end $$;

grant execute on function public.find_match(jsonb, text, integer, integer, boolean) to authenticated;
grant execute on function public.join_invite(text) to authenticated;

-- ============================================================ REALTIME
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'online_matches'
  ) then
    alter publication supabase_realtime add table public.online_matches;
  end if;
end $$;

-- recarrega o cache da API para reconhecer tabelas e funções novas
notify pgrst, 'reload schema';
