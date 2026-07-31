-- Dati di luogo e data per le rappresentazioni pubblicate nella scheda sociale.
-- Eseguire una volta sugli ambienti dove `store_script_productions` esiste gia.

alter table public.store_script_productions
  add column if not exists performance_date date,
  add column if not exists venue text not null default '';
