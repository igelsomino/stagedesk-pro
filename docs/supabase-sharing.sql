-- Condivisione protetta dei copioni per la pagina /share/[UID].
-- Eseguire dopo docs/supabase-auth.sql nel SQL Editor di Supabase.

create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (id, name, public)
values ('published-scripts', 'published-scripts', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "published_scripts_owner_insert" on storage.objects;
create policy "published_scripts_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "published_scripts_owner_select" on storage.objects;
create policy "published_scripts_owner_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "published_scripts_owner_update" on storage.objects;
create policy "published_scripts_owner_update"
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

drop policy if exists "published_scripts_owner_delete" on storage.objects;
create policy "published_scripts_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'published-scripts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table if not exists public.script_shares (
  uid uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  script_path text not null,
  project_name text not null default '',
  script_name text not null default '',
  storage_path text,
  payload jsonb not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id, script_path)
);

alter table public.script_shares
  add column if not exists storage_path text;

create index if not exists script_shares_owner_lookup
on public.script_shares (owner_id, project_id, script_path);

alter table public.script_shares enable row level security;

drop policy if exists "script_shares_owner_select" on public.script_shares;
create policy "script_shares_owner_select"
on public.script_shares for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "script_shares_owner_insert" on public.script_shares;
create policy "script_shares_owner_insert"
on public.script_shares for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "script_shares_owner_update" on public.script_shares;
create policy "script_shares_owner_update"
on public.script_shares for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "script_shares_owner_delete" on public.script_shares;
create policy "script_shares_owner_delete"
on public.script_shares for delete
to authenticated
using (auth.uid() = owner_id);

drop function if exists public.upsert_script_share(uuid, text, text, text, text, jsonb, text, boolean);

create or replace function public.upsert_script_share(
  p_share_uid uuid,
  p_project_id text,
  p_script_path text,
  p_project_name text,
  p_script_name text,
  p_payload jsonb,
  p_storage_path text default null,
  p_pin text default null,
  p_reset_pin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  share_uid uuid := p_share_uid;
  current_published_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Autenticazione richiesta';
  end if;

  if p_pin is not null and p_pin !~ '^[0-9]{5}$' then
    raise exception 'Il PIN deve contenere esattamente 5 cifre';
  end if;

  if share_uid is null then
    select uid
      into share_uid
      from public.script_shares
     where owner_id = current_user_id
       and project_id = p_project_id
       and script_path = p_script_path;
  else
    if not exists (
      select 1
        from public.script_shares
       where uid = share_uid
         and owner_id = current_user_id
    ) then
      raise exception 'Condivisione non trovata';
    end if;
  end if;

  if share_uid is null then
    if p_pin is null then
      raise exception 'PIN iniziale mancante';
    end if;

    share_uid := gen_random_uuid();
    insert into public.script_shares (
      uid,
      owner_id,
      project_id,
      script_path,
      project_name,
      script_name,
      storage_path,
      payload,
      pin_hash
    ) values (
      share_uid,
      current_user_id,
      p_project_id,
      p_script_path,
      coalesce(p_project_name, ''),
      coalesce(p_script_name, ''),
      p_storage_path,
      p_payload,
      extensions.crypt(p_pin, extensions.gen_salt('bf'))
    )
    returning published_at into current_published_at;
  else
    update public.script_shares
       set project_name = coalesce(p_project_name, ''),
           script_name = coalesce(p_script_name, ''),
           storage_path = coalesce(p_storage_path, storage_path),
           payload = p_payload,
           pin_hash = case
             when p_reset_pin then extensions.crypt(coalesce(p_pin, ''), extensions.gen_salt('bf'))
             else pin_hash
           end,
           published_at = now(),
           updated_at = now()
     where uid = share_uid
       and owner_id = current_user_id
    returning published_at into current_published_at;
  end if;

  return jsonb_build_object(
    'uid', share_uid,
    'publishedAt', current_published_at,
    'storagePath', (select storage_path from public.script_shares where uid = share_uid)
  );
end;
$$;

create or replace function public.verify_script_share(
  p_share_uid uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  share_record public.script_shares;
begin
  if auth.uid() is null then
    raise exception 'Autenticazione richiesta';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{5}$' then
    return jsonb_build_object('ok', false, 'error', 'Inserisci un PIN di 5 cifre');
  end if;

  select *
    into share_record
    from public.script_shares
   where uid = p_share_uid
     and extensions.crypt(p_pin, pin_hash) = pin_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'PIN non valido o condivisione non disponibile');
  end if;

  return jsonb_build_object(
    'ok', true,
    'share', jsonb_build_object(
      'uid', share_record.uid,
      'projectName', share_record.project_name,
      'scriptName', share_record.script_name,
      'publishedAt', share_record.published_at,
      'payload', share_record.payload
    )
  );
end;
$$;

revoke all on function public.upsert_script_share(uuid, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function public.upsert_script_share(uuid, text, text, text, text, jsonb, text, text, boolean) to authenticated;

revoke all on function public.verify_script_share(uuid, text) from public;
grant execute on function public.verify_script_share(uuid, text) to authenticated;

drop trigger if exists script_shares_set_updated_at on public.script_shares;
create trigger script_shares_set_updated_at
before update on public.script_shares
for each row
execute function public.set_updated_at();
