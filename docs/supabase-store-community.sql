-- Community features for scripts imported from StageDesk Store.
-- Run after supabase-store.sql and supabase-store-publication-versions.sql.

create table if not exists public.store_script_comments (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_script_reports (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('dialogue-error', 'inaccuracy')),
  dialogue_number integer,
  character_name text not null default '',
  original_text text not null default '',
  corrected_text text not null default '',
  act_number integer,
  scene_number integer,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_script_productions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.store_scripts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  poster_url text not null default '',
  video_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_script_comments_script_idx on public.store_script_comments(script_id, created_at);
create index if not exists store_script_reports_script_idx on public.store_script_reports(script_id, created_at);
create index if not exists store_script_productions_script_idx on public.store_script_productions(script_id, created_at desc);

alter table public.store_script_comments enable row level security;
alter table public.store_script_reports enable row level security;
alter table public.store_script_productions enable row level security;

drop policy if exists "store_script_comments_read" on public.store_script_comments;
create policy "store_script_comments_read"
on public.store_script_comments for select
to authenticated
using (
  exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_comments_insert" on public.store_script_comments;
create policy "store_script_comments_insert"
on public.store_script_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_comments_update" on public.store_script_comments;
create policy "store_script_comments_update"
on public.store_script_comments for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "store_script_comments_delete" on public.store_script_comments;
create policy "store_script_comments_delete"
on public.store_script_comments for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "store_script_reports_read" on public.store_script_reports;
create policy "store_script_reports_read"
on public.store_script_reports for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.store_scripts s
    where s.id = script_id and s.author_id = auth.uid()
  )
);

drop policy if exists "store_script_reports_insert" on public.store_script_reports;
create policy "store_script_reports_insert"
on public.store_script_reports for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_reports_update" on public.store_script_reports;
create policy "store_script_reports_update"
on public.store_script_reports for update
to authenticated
using (user_id = auth.uid() or exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()))
with check (user_id = auth.uid() or exists (select 1 from public.store_scripts s where s.id = script_id and s.author_id = auth.uid()));

drop policy if exists "store_script_productions_read" on public.store_script_productions;
create policy "store_script_productions_read"
on public.store_script_productions for select
to authenticated
using (
  exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_productions_insert" on public.store_script_productions;
create policy "store_script_productions_insert"
on public.store_script_productions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.store_scripts s
    where s.id = script_id and (s.is_published or s.author_id = auth.uid())
  )
);

drop policy if exists "store_script_productions_update" on public.store_script_productions;
create policy "store_script_productions_update"
on public.store_script_productions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "store_script_productions_delete" on public.store_script_productions;
create policy "store_script_productions_delete"
on public.store_script_productions for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists store_script_comments_touch_updated_at on public.store_script_comments;
create trigger store_script_comments_touch_updated_at
before update on public.store_script_comments
for each row execute function public.store_touch_updated_at();

drop trigger if exists store_script_reports_touch_updated_at on public.store_script_reports;
create trigger store_script_reports_touch_updated_at
before update on public.store_script_reports
for each row execute function public.store_touch_updated_at();

drop trigger if exists store_script_productions_touch_updated_at on public.store_script_productions;
create trigger store_script_productions_touch_updated_at
before update on public.store_script_productions
for each row execute function public.store_touch_updated_at();
