-- Soft archive: archived customers remain available for history and can be restored.
alter table public.customers
  add column if not exists archived_at timestamptz;

create index if not exists customers_org_archive_idx
  on public.customers (org_id, archived_at, name);
