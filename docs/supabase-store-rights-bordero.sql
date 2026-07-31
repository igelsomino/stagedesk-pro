-- Metadati di diritti, cast e prova tecnica del pacchetto pubblicato.
-- Eseguire dopo supabase-store.sql, supabase-store-publication-versions.sql
-- e supabase-store-community.sql.

alter table public.store_scripts
  add column if not exists rights_code text not null default 'unknown',
  add column if not exists rights_holder text not null default '',
  add column if not exists license_url text not null default '',
  add column if not exists setting text not null default '',
  add column if not exists cast_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists age_breakdown jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.store_scripts
    add constraint store_scripts_rights_code_check
    check (rights_code in ('unknown', 'original', 'public-domain', 'creative-commons', 'siae', 'licensed'));
exception
  when duplicate_object then null;
end $$;

create index if not exists store_scripts_rights_code_idx
  on public.store_scripts (rights_code);
create index if not exists store_scripts_setting_idx
  on public.store_scripts (setting);
create index if not exists store_scripts_cast_breakdown_idx
  on public.store_scripts using gin (cast_breakdown);

create or replace function public.update_store_script_metadata(
  p_script_id uuid,
  p_rights_code text,
  p_rights_holder text default '',
  p_license_url text default '',
  p_setting text default '',
  p_cast_breakdown jsonb default '{}'::jsonb,
  p_age_breakdown jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_rights_code text := coalesce(nullif(trim(p_rights_code), ''), 'unknown');
begin
  if current_user_id is null then
    raise exception 'Autenticazione richiesta';
  end if;
  if normalized_rights_code not in ('unknown', 'original', 'public-domain', 'creative-commons', 'siae', 'licensed') then
    raise exception 'Classificazione diritti non valida';
  end if;

  update public.store_scripts
  set rights_code = normalized_rights_code,
      rights_holder = coalesce(trim(p_rights_holder), ''),
      license_url = coalesce(trim(p_license_url), ''),
      setting = coalesce(trim(p_setting), ''),
      cast_breakdown = case when jsonb_typeof(coalesce(p_cast_breakdown, '{}'::jsonb)) = 'object' then coalesce(p_cast_breakdown, '{}'::jsonb) else '{}'::jsonb end,
      age_breakdown = case when jsonb_typeof(coalesce(p_age_breakdown, '{}'::jsonb)) = 'object' then coalesce(p_age_breakdown, '{}'::jsonb) else '{}'::jsonb end,
      updated_at = now()
  where id = p_script_id
    and author_id = current_user_id;

  if not found then
    raise exception 'Copione non trovato o non appartenente all’utente autenticato';
  end if;
end;
$$;

revoke all on function public.update_store_script_metadata(uuid, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.update_store_script_metadata(uuid, text, text, text, text, jsonb, jsonb) to authenticated;

alter table public.store_script_versions
  add column if not exists package_sha256 text not null default '',
  add column if not exists proof_method text not null default '',
  add column if not exists proof_recorded_at timestamptz;

create or replace function public.record_store_script_proof(
  p_script_id uuid,
  p_version_number integer,
  p_package_sha256 text,
  p_proof_method text default 'sha256'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Autenticazione richiesta';
  end if;
  if p_package_sha256 is null or length(trim(p_package_sha256)) <> 64 then
    raise exception 'Hash SHA-256 non valido';
  end if;

  update public.store_script_versions v
  set package_sha256 = lower(trim(p_package_sha256)),
      proof_method = coalesce(nullif(trim(p_proof_method), ''), 'sha256'),
      proof_recorded_at = now()
  from public.store_scripts s
  where v.script_id = p_script_id
    and v.version_number = p_version_number
    and s.id = v.script_id
    and s.author_id = current_user_id;

  if not found then
    raise exception 'Versione non trovata o non appartenente all’utente autenticato';
  end if;
end;
$$;

revoke all on function public.record_store_script_proof(uuid, integer, text, text) from public;
grant execute on function public.record_store_script_proof(uuid, integer, text, text) to authenticated;

alter table public.store_script_productions
  add column if not exists rights_acknowledged boolean not null default false,
  add column if not exists rights_acknowledged_at timestamptz,
  add column if not exists rights_notice text not null default '';

create table if not exists public.store_script_cue_credits (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  cue_type text not null check (cue_type in ('audio', 'music')),
  title text not null default '',
  work_title text not null default '',
  composer text not null default '',
  publisher text not null default '',
  license_label text not null default '',
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_script_cue_credits_script_idx
  on public.store_script_cue_credits (script_id, cue_type, title);

alter table public.store_script_cue_credits enable row level security;

drop policy if exists "store_script_cue_credits_public_read" on public.store_script_cue_credits;
create policy "store_script_cue_credits_public_read"
on public.store_script_cue_credits for select
to anon, authenticated
using (
  exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published = true or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_cue_credits_owner_insert" on public.store_script_cue_credits;
create policy "store_script_cue_credits_owner_insert"
on public.store_script_cue_credits for insert
to authenticated
with check (exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()));

drop policy if exists "store_script_cue_credits_owner_update" on public.store_script_cue_credits;
create policy "store_script_cue_credits_owner_update"
on public.store_script_cue_credits for update
to authenticated
using (exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()))
with check (exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()));

drop policy if exists "store_script_cue_credits_owner_delete" on public.store_script_cue_credits;
create policy "store_script_cue_credits_owner_delete"
on public.store_script_cue_credits for delete
to authenticated
using (exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()));

drop trigger if exists store_script_cue_credits_touch_updated_at on public.store_script_cue_credits;
create trigger store_script_cue_credits_touch_updated_at
before update on public.store_script_cue_credits
for each row execute function public.store_touch_updated_at();
