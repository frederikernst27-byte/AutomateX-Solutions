-- Pilot hardening: normalized skills/sites/assets, a safe worker claim path,
-- and retention helpers. This migration is additive and can be applied after
-- 0001 without changing the demo fallback.

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unique (org_id, name)
);

create table if not exists public.driver_skills (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary key (driver_id, skill_id)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text not null,
  lat double precision,
  lng double precision,
  access_notes text,
  unique (org_id, customer_id, name)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  asset_type text,
  serial_number text,
  metadata jsonb not null default '{}'
);

create table if not exists public.customer_availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  window_start time not null,
  window_end time not null,
  active boolean not null default true,
  check (window_end > window_start)
);

create index if not exists driver_skills_org_idx on public.driver_skills(org_id, driver_id);
create index if not exists sites_customer_idx on public.sites(org_id, customer_id);
create index if not exists assets_site_idx on public.assets(org_id, site_id);
create index if not exists availability_customer_idx on public.customer_availability(org_id, customer_id, weekday);

alter table public.skills enable row level security;
alter table public.driver_skills enable row level security;
alter table public.sites enable row level security;
alter table public.assets enable row level security;
alter table public.customer_availability enable row level security;

create policy skills_admin_all on public.skills for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));
create policy driver_skills_admin_all on public.driver_skills for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));
create policy driver_skills_self_read on public.driver_skills for select using (exists(select 1 from public.drivers d where d.id = driver_skills.driver_id and d.user_id = auth.uid()));
create policy sites_admin_all on public.sites for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));
create policy sites_driver_read on public.sites for select using (exists(select 1 from public.drivers d join public.routes r on r.driver_id = d.id join public.route_stops rs on rs.route_id = r.id join public.work_orders wo on wo.id = rs.work_order_id where wo.customer_id = sites.customer_id and d.user_id = auth.uid()));
create policy assets_admin_all on public.assets for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));
create policy assets_driver_read on public.assets for select using (exists(select 1 from public.sites s join public.drivers d on d.org_id = s.org_id join public.routes r on r.driver_id = d.id join public.route_stops rs on rs.route_id = r.id join public.work_orders wo on wo.id = rs.work_order_id where s.id = assets.site_id and wo.customer_id = s.customer_id and d.user_id = auth.uid()));
create policy availability_admin_all on public.customer_availability for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

-- Cloud Run workers claim one job atomically and can safely run in parallel.
create or replace function public.claim_next_job()
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare claimed public.jobs;
begin
  select * into claimed
  from public.jobs
  where status = 'queued' and available_at <= now()
  order by available_at, created_at
  for update skip locked
  limit 1;
  if claimed.id is null then return null; end if;
  update public.jobs
  set status = 'running', locked_at = now(), attempts = attempts + 1
  where id = claimed.id
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.claim_next_job() from public, anon, authenticated;
grant execute on function public.claim_next_job() to service_role;

create or replace function public.purge_route_retention()
returns void language sql security definer set search_path = public as $$
  delete from public.driver_locations where recorded_at < now() - interval '30 days';
  update public.portal_tokens set revoked_at = coalesce(revoked_at, now()) where expires_at < now() and revoked_at is null;
$$;
revoke all on function public.purge_route_retention() from public, anon, authenticated;
grant execute on function public.purge_route_retention() to service_role;
