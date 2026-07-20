-- 냉장고 프로젝트 - Supabase 데이터베이스 설정
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run 한 번이면 끝.

-- 1) 테이블 ----------------------------------------------------------
create table if not exists spaces (
  id      text primary key,
  name    text not null,
  code    text unique,
  kind    text not null default 'shared',   -- personal | shared
  created timestamptz not null default now()
);
create table if not exists members (
  space_id  text not null references spaces(id) on delete cascade,
  user_id   text not null,
  user_name text,
  joined    timestamptz not null default now(),
  primary key (space_id, user_id)
);
create table if not exists items (
  id      text primary key,
  space   text not null,
  payload jsonb not null,
  updated timestamptz not null default now()
);
create table if not exists shopping (
  id      text primary key,
  space   text not null,
  payload jsonb not null,
  updated timestamptz not null default now()
);

-- 2) RLS (테스트용: 익명 접근 전체 허용) ------------------------------
alter table spaces   enable row level security;
alter table members  enable row level security;
alter table items    enable row level security;
alter table shopping enable row level security;

drop policy if exists p_anon_spaces   on spaces;
drop policy if exists p_anon_members  on members;
drop policy if exists p_anon_items    on items;
drop policy if exists p_anon_shopping on shopping;
create policy p_anon_spaces   on spaces   for all to anon using (true) with check (true);
create policy p_anon_members  on members  for all to anon using (true) with check (true);
create policy p_anon_items    on items    for all to anon using (true) with check (true);
create policy p_anon_shopping on shopping for all to anon using (true) with check (true);

-- 3) 공간 관리 함수 ---------------------------------------------------
create or replace function gen_code() returns text language plpgsql as $$
declare v_code text; chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random()*length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from spaces where spaces.code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function ensure_personal(p_user text, p_name text)
returns spaces language plpgsql security definer as $$
declare s spaces;
begin
  select sp.* into s from spaces sp
    join members m on m.space_id = sp.id
    where m.user_id = p_user and sp.kind = 'personal'
    order by sp.created limit 1;
  if found then return s; end if;
  insert into spaces(id, name, kind)
    values ('psp_' || replace(gen_random_uuid()::text, '-', ''), '내 냉장고', 'personal')
    returning * into s;
  insert into members(space_id, user_id, user_name) values (s.id, p_user, p_name);
  return s;
end $$;

create or replace function create_shared(p_user text, p_name text, p_space_name text)
returns spaces language plpgsql security definer as $$
declare s spaces;
begin
  insert into spaces(id, name, code, kind)
    values ('shr_' || replace(gen_random_uuid()::text, '-', ''),
            coalesce(nullif(p_space_name, ''), '공유 냉장고'), gen_code(), 'shared')
    returning * into s;
  insert into members(space_id, user_id, user_name) values (s.id, p_user, p_name);
  return s;
end $$;

create or replace function join_shared(p_user text, p_name text, p_code text)
returns spaces language plpgsql security definer as $$
declare s spaces;
begin
  select * into s from spaces where code = upper(trim(p_code)) and kind = 'shared';
  if not found then return null; end if;
  insert into members(space_id, user_id, user_name) values (s.id, p_user, p_name)
    on conflict (space_id, user_id) do update set user_name = excluded.user_name;
  return s;
end $$;

create or replace function list_spaces(p_user text)
returns table(id text, name text, code text, kind text, members bigint)
language sql security definer as $$
  select s.id, s.name, s.code, s.kind,
         (select count(*) from members mm where mm.space_id = s.id) as members
  from spaces s join members m on m.space_id = s.id
  where m.user_id = p_user
  order by (s.kind = 'personal') desc, s.created;
$$;

create or replace function leave_space(p_user text, p_space text)
returns void language sql security definer as $$
  delete from members where user_id = p_user and space_id = p_space;
$$;

grant execute on function ensure_personal(text,text)      to anon;
grant execute on function create_shared(text,text,text)   to anon;
grant execute on function join_shared(text,text,text)     to anon;
grant execute on function list_spaces(text)               to anon;
grant execute on function leave_space(text,text)          to anon;
