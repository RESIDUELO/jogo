-- ============================================================ SALA DE ESPERA + DESAFIOS
-- Quem abre "Buscar adversário" aparece na sala de espera (lobby). Os outros veem a lista,
-- tocam em "Jogar" e a pessoa desafiada aceita ou recusa. Quem desafia define temas e tempo.
-- Pode ser executado de novo sem problemas (idempotente).

create table if not exists public.lobby (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  name text not null default 'Jogador',
  avatar text not null default '🩺',
  level integer not null default 1,
  rating integer not null default 1000,
  ranked boolean not null default false,
  is_guest boolean not null default false,
  seen_at timestamptz not null default now()
);
alter table public.lobby enable row level security;
drop policy if exists "lobby: todos veem" on public.lobby;
create policy "lobby: todos veem" on public.lobby for select to authenticated using (true);
drop policy if exists "lobby: sai" on public.lobby;
create policy "lobby: sai" on public.lobby for delete using (auth.uid() = user_id);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  from_name text not null,
  from_avatar text not null,
  from_level integer not null,
  from_rating integer not null,
  match_id uuid not null references public.online_matches (id) on delete cascade,
  setup jsonb not null,
  ranked boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists challenges_to on public.challenges (to_id, status);
alter table public.challenges enable row level security;
drop policy if exists "desafios: participantes leem" on public.challenges;
create policy "desafios: participantes leem" on public.challenges for select using (auth.uid() = from_id or auth.uid() = to_id);

-- Entra/continua na sala de espera (chamado a cada poucos segundos).
create or replace function public.lobby_enter(p_name text, p_avatar text, p_level integer, p_rating integer, p_ranked boolean, p_guest boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into public.lobby (user_id, name, avatar, level, rating, ranked, is_guest, seen_at)
  values (auth.uid(), left(p_name, 40), left(p_avatar, 16), p_level, p_rating, p_ranked, p_guest, now())
  on conflict (user_id) do update
    set name = excluded.name, avatar = excluded.avatar, level = excluded.level, rating = excluded.rating,
        ranked = excluded.ranked, is_guest = excluded.is_guest, seen_at = now();
end $$;

-- Quem está disponível agora (visto nos últimos 20 s).
create or replace function public.lobby_list(p_ranked boolean)
returns setof public.lobby language sql stable security definer set search_path = public as $$
  select * from public.lobby
   where ranked = p_ranked and user_id <> auth.uid() and seen_at > now() - interval '20 seconds'
   order by seen_at desc
   limit 50;
$$;

-- Desafia alguém da sala de espera: cria a partida (aguardando) e o convite.
create or replace function public.send_challenge(p_to uuid, p_setup jsonb, p_ranked boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  meinfo public.lobby%rowtype;
  mid uuid;
  cid uuid;
begin
  if me is null then raise exception 'não autenticado'; end if;
  if p_to = me then raise exception 'Escolha outra pessoa'; end if;
  select * into meinfo from public.lobby where user_id = me;
  if not found then raise exception 'Entre na busca de adversário primeiro'; end if;
  if not exists (select 1 from public.lobby where user_id = p_to and seen_at > now() - interval '20 seconds') then
    raise exception 'Essa pessoa não está mais disponível';
  end if;
  -- um convite por vez: cancela os anteriores
  update public.online_matches set status = 'abandoned'
   where id in (select match_id from public.challenges where from_id = me and status = 'pending');
  update public.challenges set status = 'cancelled' where from_id = me and status = 'pending';

  insert into public.online_matches (status, ranked, config, player_a)
  values ('waiting', p_ranked, p_setup, me) returning id into mid;
  insert into public.challenges (from_id, to_id, from_name, from_avatar, from_level, from_rating, match_id, setup, ranked)
  values (me, p_to, meinfo.name, meinfo.avatar, meinfo.level, meinfo.rating, mid, p_setup, p_ranked)
  returning id into cid;
  return cid;
end $$;

-- Convites recebidos ainda válidos (60 s).
create or replace function public.my_challenges()
returns setof public.challenges language sql stable security definer set search_path = public as $$
  select * from public.challenges
   where to_id = auth.uid() and status = 'pending' and created_at > now() - interval '60 seconds'
   order by created_at;
$$;

-- Aceita (entra na partida) ou recusa um convite. Retorna o id da partida ao aceitar.
create or replace function public.answer_challenge(p_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = p_id and to_id = me for update;
  if not found then raise exception 'Convite não encontrado'; end if;
  if c.status <> 'pending' or c.created_at < now() - interval '60 seconds' then
    raise exception 'Esse convite não vale mais';
  end if;
  if not p_accept then
    update public.challenges set status = 'declined' where id = p_id;
    update public.online_matches set status = 'abandoned' where id = c.match_id and status = 'waiting';
    return null;
  end if;
  update public.online_matches set player_b = me, status = 'active'
   where id = c.match_id and status = 'waiting' and player_b is null;
  if not found then raise exception 'Esse convite não vale mais'; end if;
  update public.challenges set status = 'accepted' where id = p_id;
  -- recusa os outros convites pendentes e sai da sala de espera
  update public.online_matches set status = 'abandoned'
   where id in (select match_id from public.challenges where to_id = me and status = 'pending');
  update public.challenges set status = 'declined' where to_id = me and status = 'pending';
  delete from public.lobby where user_id in (me, c.from_id);
  return c.match_id;
end $$;

-- Desiste do convite enviado.
create or replace function public.cancel_challenge(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = p_id and from_id = auth.uid() for update;
  if found and c.status = 'pending' then
    update public.challenges set status = 'cancelled' where id = p_id;
    update public.online_matches set status = 'abandoned' where id = c.match_id and status = 'waiting';
  end if;
end $$;

grant execute on function public.lobby_enter(text, text, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.lobby_list(boolean) to authenticated;
grant execute on function public.send_challenge(uuid, jsonb, boolean) to authenticated;
grant execute on function public.my_challenges() to authenticated;
grant execute on function public.answer_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;

-- recarrega o cache da API para reconhecer tabelas e funções novas
notify pgrst, 'reload schema';
