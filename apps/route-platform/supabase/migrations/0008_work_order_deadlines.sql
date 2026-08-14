-- A planning deadline is distinct from a route date and the daily time window.
alter table public.work_orders
  add column if not exists deadline_date date;

create index if not exists work_orders_org_deadline_idx
  on public.work_orders (org_id, deadline_date)
  where deadline_date is not null;
