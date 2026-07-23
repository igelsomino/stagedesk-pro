-- Versioni pubblicate nello StageDesk Store.
-- Eseguire dopo docs/supabase-store.sql. La migrazione è idempotente.

alter table public.store_scripts
  add column if not exists current_version integer not null default 0,
  add column if not exists published_at timestamptz,
  add column if not exists last_published_by uuid references auth.users(id) on delete set null;

create table if not exists public.store_script_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  author_id uuid references auth.users(id) on delete set null,
  package_path text not null,
  package_name text not null default '',
  format_version text not null default '1',
  release_notes text not null default '',
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  unique (script_id, version_number)
);

alter table public.store_script_versions enable row level security;

drop policy if exists "store_script_versions_public_read" on public.store_script_versions;
create policy "store_script_versions_public_read"
on public.store_script_versions for select
to anon, authenticated
using (
  exists (
    select 1
    from public.store_scripts s
    where s.id = script_id
      and (s.is_published = true or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_versions_owner_insert" on public.store_script_versions;
create policy "store_script_versions_owner_insert"
on public.store_script_versions for insert
to authenticated
with check (auth.uid() = author_id and auth.uid() = published_by);

drop policy if exists "store_script_versions_owner_update" on public.store_script_versions;
create policy "store_script_versions_owner_update"
on public.store_script_versions for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "store_script_versions_owner_delete" on public.store_script_versions;
create policy "store_script_versions_owner_delete"
on public.store_script_versions for delete
to authenticated
using (auth.uid() = author_id);

create index if not exists store_script_versions_script_index
on public.store_script_versions (script_id, version_number desc);

create or replace function public.store_initialize_script_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published = true and new.author_id is not null and new.current_version > 0 then
    insert into public.store_script_versions (
      script_id,
      version_number,
      author_id,
      package_path,
      package_name,
      format_version,
      published_at,
      published_by
    ) values (
      new.id,
      new.current_version,
      new.author_id,
      new.package_path,
      new.package_name,
      new.format_version,
      coalesce(new.published_at, now()),
      new.author_id
    ) on conflict (script_id, version_number) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists store_scripts_initialize_version on public.store_scripts;
create trigger store_scripts_initialize_version
after insert on public.store_scripts
for each row execute function public.store_initialize_script_version();

-- I record già pubblicati vengono considerati la versione iniziale dello storico.
update public.store_scripts
set current_version = 1,
    published_at = coalesce(published_at, updated_at)
where is_published = true
  and current_version = 0;

insert into public.store_script_versions (
  script_id,
  version_number,
  author_id,
  package_path,
  package_name,
  format_version,
  published_at,
  published_by
)
select
  s.id,
  s.current_version,
  s.author_id,
  s.package_path,
  s.package_name,
  s.format_version,
  coalesce(s.published_at, s.updated_at, now()),
  s.author_id
from public.store_scripts s
where s.is_published = true
  and s.current_version > 0
  and s.author_id is not null
  and not exists (
    select 1
    from public.store_script_versions v
    where v.script_id = s.id
      and v.version_number = s.current_version
  );

alter table public.store_scripts
  alter column current_version set default 1;

create or replace function public.publish_store_script(
  p_script_id uuid,
  p_package_path text,
  p_package_name text,
  p_release_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  script_row public.store_scripts;
  next_version integer;
  publication_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Autenticazione richiesta';
  end if;
  if nullif(trim(coalesce(p_package_path, '')), '') is null then
    raise exception 'Percorso del pacchetto mancante';
  end if;
  if split_part(p_package_path, '/', 1) <> current_user_id::text then
    raise exception 'Il pacchetto deve appartenere all’utente autenticato';
  end if;

  select * into script_row
  from public.store_scripts
  where id = p_script_id
    and author_id = current_user_id
  for update;

  if not found then
    raise exception 'Il copione non appartiene all’utente autenticato';
  end if;

  next_version := greatest(coalesce(script_row.current_version, 0), 0) + 1;

  insert into public.store_script_versions (
    script_id,
    version_number,
    author_id,
    package_path,
    package_name,
    format_version,
    release_notes,
    published_at,
    published_by
  ) values (
    script_row.id,
    next_version,
    current_user_id,
    p_package_path,
    coalesce(p_package_name, ''),
    coalesce(script_row.format_version, '1'),
    coalesce(p_release_notes, ''),
    publication_time,
    current_user_id
  );

  update public.store_scripts
  set package_path = p_package_path,
      package_name = coalesce(p_package_name, package_name),
      current_version = next_version,
      published_at = publication_time,
      last_published_by = current_user_id,
      is_published = true
  where id = script_row.id;

  return jsonb_build_object(
    'script_id', script_row.id,
    'version_number', next_version,
    'published_at', publication_time,
    'package_path', p_package_path,
    'package_name', coalesce(p_package_name, '')
  );
end;
$$;

revoke all on function public.publish_store_script(uuid, text, text, text) from public;
grant execute on function public.publish_store_script(uuid, text, text, text) to authenticated;
