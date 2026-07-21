-- Catalogo pubblico dei copioni StageDesk Store.
-- Eseguire dopo docs/supabase-auth.sql. Non contiene chiavi o credenziali.

create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (id, name, public)
values
  ('store-packages', 'store-packages', true),
  ('store-covers', 'store-covers', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "store_packages_public_read" on storage.objects;
create policy "store_packages_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'store-packages');

drop policy if exists "store_packages_owner_insert" on storage.objects;
create policy "store_packages_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'store-packages'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "store_packages_owner_update" on storage.objects;
create policy "store_packages_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'store-packages' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'store-packages' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "store_packages_owner_delete" on storage.objects;
create policy "store_packages_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'store-packages' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "store_covers_public_read" on storage.objects;
create policy "store_covers_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'store-covers');

drop policy if exists "store_covers_owner_insert" on storage.objects;
create policy "store_covers_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'store-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "store_covers_owner_update" on storage.objects;
create policy "store_covers_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'store-covers' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'store-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "store_covers_owner_delete" on storage.objects;
create policy "store_covers_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'store-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.store_scripts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  author_name text not null default '',
  language text not null default 'Italiano',
  genre text not null default 'Teatro',
  rights_label text not null default 'Testo originale',
  tags text[] not null default array[]::text[],
  actor_count integer not null default 0 check (actor_count >= 0),
  act_count integer not null default 0 check (act_count >= 0),
  scene_count integer not null default 0 check (scene_count >= 0),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  cover_path text,
  package_path text not null,
  package_name text not null default '',
  format_version text not null default '1',
  download_count bigint not null default 0 check (download_count >= 0),
  average_rating numeric(2,1) not null default 0 check (average_rating >= 0 and average_rating <= 5),
  rating_count bigint not null default 0 check (rating_count >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_scripts enable row level security;

drop policy if exists "store_scripts_public_read" on public.store_scripts;
create policy "store_scripts_public_read"
on public.store_scripts for select
to anon, authenticated
using (is_published = true or auth.uid() = author_id);

drop policy if exists "store_scripts_owner_insert" on public.store_scripts;
create policy "store_scripts_owner_insert"
on public.store_scripts for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "store_scripts_owner_update" on public.store_scripts;
create policy "store_scripts_owner_update"
on public.store_scripts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "store_scripts_owner_delete" on public.store_scripts;
create policy "store_scripts_owner_delete"
on public.store_scripts for delete
to authenticated
using (auth.uid() = author_id);

create table if not exists public.store_ratings (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (script_id, user_id)
);

alter table public.store_ratings enable row level security;

drop policy if exists "store_ratings_owner_read" on public.store_ratings;
create policy "store_ratings_owner_read"
on public.store_ratings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "store_ratings_owner_insert" on public.store_ratings;
create policy "store_ratings_owner_insert"
on public.store_ratings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "store_ratings_owner_update" on public.store_ratings;
create policy "store_ratings_owner_update"
on public.store_ratings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "store_ratings_owner_delete" on public.store_ratings;
create policy "store_ratings_owner_delete"
on public.store_ratings for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists store_scripts_catalog_index
on public.store_scripts (is_published, created_at desc, download_count desc);

create index if not exists store_scripts_search_index
on public.store_scripts using gin (to_tsvector('simple', title || ' ' || author_name || ' ' || description));

create or replace function public.store_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists store_scripts_touch_updated_at on public.store_scripts;
create trigger store_scripts_touch_updated_at
before update on public.store_scripts
for each row execute function public.store_touch_updated_at();

drop trigger if exists store_ratings_touch_updated_at on public.store_ratings;
create trigger store_ratings_touch_updated_at
before update on public.store_ratings
for each row execute function public.store_touch_updated_at();

create or replace function public.increment_store_download(p_script_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  update public.store_scripts
     set download_count = download_count + 1
   where id = p_script_id
     and is_published = true
   returning download_count into next_count;
  if next_count is null then
    raise exception 'Copione non disponibile';
  end if;
  return next_count;
end;
$$;

revoke all on function public.increment_store_download(uuid) from public;
grant execute on function public.increment_store_download(uuid) to anon, authenticated;

create or replace function public.rate_store_script(
  p_script_id uuid,
  p_score integer,
  p_comment text default ''
)
returns public.store_scripts
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result public.store_scripts;
begin
  if current_user_id is null then
    raise exception 'Autenticazione richiesta';
  end if;
  if p_score < 1 or p_score > 5 then
    raise exception 'La valutazione deve essere compresa tra 1 e 5';
  end if;
  insert into public.store_ratings (script_id, user_id, score, comment)
  values (p_script_id, current_user_id, p_score, coalesce(p_comment, ''))
  on conflict (script_id, user_id) do update
    set score = excluded.score, comment = excluded.comment, updated_at = now();
  update public.store_scripts s
     set average_rating = coalesce((select round(avg(score)::numeric, 1) from public.store_ratings where script_id = s.id), 0),
         rating_count = (select count(*) from public.store_ratings where script_id = s.id)
   where s.id = p_script_id
  returning s.* into result;
  return result;
end;
$$;

revoke all on function public.rate_store_script(uuid, integer, text) from public;
grant execute on function public.rate_store_script(uuid, integer, text) to authenticated;
