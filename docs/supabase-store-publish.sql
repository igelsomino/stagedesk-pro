-- Abilita la pubblicazione dal copione attivo nello Store.
-- Eseguire dopo docs/supabase-store.sql.

drop policy if exists "store_packages_catalog_owner_insert" on storage.objects;
create policy "store_packages_catalog_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'store-packages'
  and exists (
    select 1
    from public.store_scripts s
    where s.package_path = name
      and s.author_id = auth.uid()
  )
);

drop policy if exists "store_packages_catalog_owner_update" on storage.objects;
create policy "store_packages_catalog_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'store-packages'
  and exists (
    select 1
    from public.store_scripts s
    where s.package_path = name
      and s.author_id = auth.uid()
  )
)
with check (
  bucket_id = 'store-packages'
  and exists (
    select 1
    from public.store_scripts s
    where s.package_path = name
      and s.author_id = auth.uid()
  )
);
