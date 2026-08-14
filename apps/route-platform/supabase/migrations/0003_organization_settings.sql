-- Persisted defaults for every planning run.  The API uses the same shape in
-- the local adapter; the production repository reads this row per org.
create table public.organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  default_max_stops integer not null default 4 check (default_max_stops between 1 and 20),
  default_max_travel_minutes integer not null default 180 check (default_max_travel_minutes between 15 and 720),
  default_max_route_minutes integer not null default 480 check (default_max_route_minutes between 60 and 960),
  auto_confirm boolean not null default false,
  gps_enabled boolean not null default true,
  location_retention_days integer not null default 30 check (location_retention_days between 1 and 365),
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;
create policy organization_settings_admin_read on public.organization_settings for select using (public.has_org_role(org_id, 'admin'));
create policy organization_settings_admin_write on public.organization_settings for all using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

create or replace function public.touch_organization_settings() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger organization_settings_updated before update on public.organization_settings for each row execute function public.touch_organization_settings();
