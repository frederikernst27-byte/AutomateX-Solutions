-- Persisted planning drafts use optimistic locking. Test data receives one
-- shared batch id so it can be removed without touching operational records.
alter table public.planning_runs
  add column if not exists revision integer not null default 1;

alter table public.customers
  add column if not exists test_batch_id uuid;

alter table public.work_orders
  add column if not exists test_batch_id uuid;

alter table public.drivers
  add column if not exists test_batch_id uuid;

create index if not exists customers_org_test_batch_idx
  on public.customers (org_id, test_batch_id)
  where test_batch_id is not null;

create index if not exists work_orders_org_test_batch_idx
  on public.work_orders (org_id, test_batch_id)
  where test_batch_id is not null;

create index if not exists drivers_org_test_batch_idx
  on public.drivers (org_id, test_batch_id)
  where test_batch_id is not null;
