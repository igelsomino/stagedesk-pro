-- Rimuove le policy SELECT generiche che consentono ai client di elencare
-- tutti gli oggetti dei bucket pubblici. Gli URL pubblici continuano a
-- funzionare senza una policy SELECT su storage.objects.

drop policy if exists "store_packages_public_read" on storage.objects;
drop policy if exists "store_covers_public_read" on storage.objects;
drop policy if exists "published_scripts_public_read" on storage.objects;
