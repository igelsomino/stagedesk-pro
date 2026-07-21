create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  first_name text not null,
  last_name text not null,
  phone text not null,
  user_type text not null check (user_type in ('regista', 'autore', 'attore', 'altro')),
  user_types text[] not null default array['regista']::text[],
  privacy_accepted_at timestamptz not null,
  terms_accepted_at timestamptz,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists user_types text[];

update public.profiles
set user_types = array[user_type]
where user_types is null or cardinality(user_types) = 0;

alter table public.profiles
alter column user_types set default array['regista']::text[];

alter table public.profiles
alter column user_types set not null;

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles
add constraint profiles_user_type_check
check (user_type in ('regista', 'autore', 'attore', 'altro'));

alter table public.profiles drop constraint if exists profiles_user_types_check;
alter table public.profiles
add constraint profiles_user_types_check
check (
  cardinality(user_types) > 0
  and user_types <@ array['regista', 'autore', 'attore', 'altro']::text[]
);

create or replace function public.profile_user_types_from_metadata(metadata jsonb)
returns text[]
language plpgsql
immutable
as $$
declare
  selected_types text[];
  legacy_type text;
begin
  select coalesce(array_agg(value), array[]::text[])
  into selected_types
  from jsonb_array_elements_text(coalesce(metadata -> 'user_types', '[]'::jsonb)) as value
  where value in ('regista', 'autore', 'attore', 'altro');

  if cardinality(selected_types) > 0 then
    return selected_types;
  end if;

  legacy_type := metadata ->> 'user_type';
  if legacy_type in ('regista', 'autore', 'attore', 'altro') then
    return array[legacy_type];
  end if;

  return array['regista']::text[];
end;
$$;

create or replace function public.normalize_profile_user_types()
returns trigger
language plpgsql
as $$
declare
  normalized_types text[];
begin
  select coalesce(array_agg(value order by first_position), array[]::text[])
  into normalized_types
  from (
    select value, min(position) as first_position
    from unnest(coalesce(new.user_types, array[]::text[])) with ordinality as profile_type(value, position)
    where value in ('regista', 'autore', 'attore', 'altro')
    group by value
  ) selected;

  if cardinality(normalized_types) = 0 and new.user_type in ('regista', 'autore', 'attore', 'altro') then
    normalized_types := array[new.user_type];
  end if;

  if cardinality(normalized_types) = 0 then
    normalized_types := array['regista']::text[];
  end if;

  new.user_types := normalized_types;
  new.user_type := normalized_types[1];
  return new;
end;
$$;

drop trigger if exists profiles_normalize_user_types on public.profiles;
create trigger profiles_normalize_user_types
before insert or update on public.profiles
for each row
execute function public.normalize_profile_user_types();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_types text[];
begin
  selected_types := public.profile_user_types_from_metadata(new.raw_user_meta_data);

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    user_type,
    user_types,
    privacy_accepted_at,
    terms_accepted_at,
    marketing_consent_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), ''),
    selected_types[1],
    selected_types,
    coalesce((new.raw_user_meta_data ->> 'privacy_accepted_at')::timestamptz, now()),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    nullif(new.raw_user_meta_data ->> 'marketing_consent_at', '')::timestamptz
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    user_type = excluded.user_type,
    user_types = excluded.user_types;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

update public.profiles as profile
set
  user_types = public.profile_user_types_from_metadata(auth_user.raw_user_meta_data),
  user_type = (public.profile_user_types_from_metadata(auth_user.raw_user_meta_data))[1]
from auth.users as auth_user
where profile.id = auth_user.id
  and jsonb_typeof(auth_user.raw_user_meta_data -> 'user_types') = 'array'
  and cardinality(public.profile_user_types_from_metadata(auth_user.raw_user_meta_data)) > 0;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Storage per la condivisione copioni.
-- Eseguire anche se il bucket è già stato creato dalla dashboard:
-- le policy RLS su storage.objects sono necessarie per upload, aggiornamento e rimozione.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'published-scripts',
  'published-scripts',
  true,
  5242880,
  array['application/json']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "published_scripts_public_read" on storage.objects;
create policy "published_scripts_public_read"
on storage.objects for select
to public
using (bucket_id = 'published-scripts');

drop policy if exists "published_scripts_insert_own" on storage.objects;
create policy "published_scripts_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "published_scripts_update_own" on storage.objects;
create policy "published_scripts_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "published_scripts_delete_own" on storage.objects;
create policy "published_scripts_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
