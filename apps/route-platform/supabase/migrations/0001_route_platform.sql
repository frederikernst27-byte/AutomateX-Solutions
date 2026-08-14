-- AutomateX Route Platform - independent EU Supabase project
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'driver');
create type public.work_order_status as enum ('backlog', 'offered', 'confirmed', 'planned', 'en_route', 'on_site', 'completed', 'cancelled', 'needs_followup');
create type public.route_status as enum ('draft', 'published', 'started', 'completed', 'cancelled');

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, timezone text not null default 'Europe/Berlin', created_at timestamptz not null default now());
create table public.memberships (org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null, created_at timestamptz not null default now(), primary key (org_id, user_id));
create table public.drivers (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid references auth.users(id) on delete set null, name text not null, email text not null, phone text, initials text, color text not null default '#18b982', skills text[] not null default '{}', depot text, depot_lat double precision, depot_lng double precision, shift_start time not null default '08:00', shift_end time not null default '17:00', max_stops integer not null default 4, max_travel_minutes integer not null default 180, days_off date[] not null default '{}', active boolean not null default true, created_at timestamptz not null default now());
create table public.customers (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, name text not null, contact text, email text, phone text, site text, address text not null, lat double precision, lng double precision, asset text, speciality text not null default 'Wartung', interval_months integer not null default 12, last_service date, next_due date, sla text not null default 'Standard', notes text, created_at timestamptz not null default now());
create table public.maintenance_rules (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, customer_id uuid not null references public.customers(id) on delete cascade, asset text, interval_months integer not null default 12, preferred_weekdays smallint[] not null default '{}', preferred_window_start time, preferred_window_end time, active boolean not null default true, created_at timestamptz not null default now());
create table public.work_orders (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, customer_id uuid not null references public.customers(id) on delete cascade, title text not null, kind text not null default 'Wartung', status public.work_order_status not null default 'backlog', scheduled_date date, time_from time, time_to time, duration_minutes integer not null default 45, priority smallint not null default 1, speciality text not null default 'Wartung', locked boolean not null default false, assigned_driver_id uuid references public.drivers(id) on delete set null, notes text, created_at timestamptz not null default now());
create table public.planning_runs (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, status text not null default 'queued', mode text not null default 'fallback', constraints jsonb not null default '{}', result jsonb, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), completed_at timestamptz);
create table public.plan_versions (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, planning_run_id uuid references public.planning_runs(id) on delete set null, version integer not null default 1, status text not null default 'draft', published_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now());
create table public.routes (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, plan_version_id uuid references public.plan_versions(id) on delete set null, driver_id uuid not null references public.drivers(id) on delete cascade, route_date date not null, status public.route_status not null default 'draft', distance_km numeric(10,1) not null default 0, travel_minutes integer not null default 0, service_minutes integer not null default 0, current_stop_id uuid, started_at timestamptz, last_location jsonb, created_at timestamptz not null default now());
create table public.route_stops (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, route_id uuid not null references public.routes(id) on delete cascade, work_order_id uuid not null references public.work_orders(id) on delete cascade, stop_order integer not null, eta time, distance_from_previous_km numeric(10,1), drive_minutes_from_previous integer, explanation text, locked boolean not null default false, unique(route_id, stop_order), unique(route_id, work_order_id));
create table public.driver_events (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, driver_id uuid not null references public.drivers(id) on delete cascade, route_id uuid references public.routes(id) on delete cascade, work_order_id uuid references public.work_orders(id) on delete set null, event_type text not null, location jsonb, note text, idempotency_key text, created_at timestamptz not null default now(), unique(org_id, idempotency_key));
create table public.driver_locations (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, driver_id uuid not null references public.drivers(id) on delete cascade, route_id uuid references public.routes(id) on delete cascade, lat double precision not null, lng double precision not null, recorded_at timestamptz not null default now());
create table public.service_reports (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, work_order_id uuid not null references public.work_orders(id) on delete cascade, summary text not null, findings jsonb not null default '[]', follow_up text, urgency text not null default 'normal', confirmed boolean not null default false, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now());
create table public.attachments (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, report_id uuid references public.service_reports(id) on delete cascade, storage_path text not null, mime_type text, created_at timestamptz not null default now());
create table public.portal_tokens (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, work_order_id uuid not null references public.work_orders(id) on delete cascade, token_hash text not null unique, purpose text not null default 'appointment', expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, work_order_id uuid references public.work_orders(id) on delete set null, recipient text not null, channel text not null default 'email', template text not null, status text not null default 'outbox', provider_id text, created_at timestamptz not null default now(), sent_at timestamptz);
create table public.jobs (id uuid primary key default gen_random_uuid(), org_id uuid references public.organizations(id) on delete cascade, kind text not null, payload jsonb not null default '{}', status text not null default 'queued', attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz, last_error text, created_at timestamptz not null default now());
create table public.audit_events (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id text, before_state jsonb, after_state jsonb, reason text, created_at timestamptz not null default now());

create index customers_org_due_idx on public.customers(org_id, next_due);
create index work_orders_org_date_idx on public.work_orders(org_id, scheduled_date, status);
create index routes_org_date_idx on public.routes(org_id, route_date, status);
create index jobs_queue_idx on public.jobs(status, available_at);

create or replace function public.current_org_ids() returns setof uuid language sql stable security definer set search_path = public as $$ select org_id from public.memberships where user_id = auth.uid(); $$;
create or replace function public.has_org_role(target_org uuid, target_role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.memberships where org_id = target_org and user_id = auth.uid() and role = target_role); $$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.drivers enable row level security;
alter table public.customers enable row level security;
alter table public.maintenance_rules enable row level security;
alter table public.work_orders enable row level security;
alter table public.planning_runs enable row level security;
alter table public.plan_versions enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.driver_events enable row level security;
alter table public.driver_locations enable row level security;
alter table public.service_reports enable row level security;
alter table public.attachments enable row level security;
alter table public.portal_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_events enable row level security;

create policy org_member_read on public.organizations for select using (id in (select public.current_org_ids()));
create policy membership_self_read on public.memberships for select using (user_id = auth.uid() or public.has_org_role(org_id, 'admin'));

-- Do not use one broad "org member read" policy here. PostgreSQL combines
-- permissive policies with OR; the old policy therefore made the more
-- restrictive driver policies ineffective and exposed every customer/route.
create policy drivers_admin_read on public.drivers for select using (public.has_org_role(org_id, 'admin'));
create policy drivers_self_read on public.drivers for select using (user_id = auth.uid());
create policy customers_admin_read on public.customers for select using (public.has_org_role(org_id, 'admin'));
create policy customers_driver_read on public.customers for select using (
  exists (
    select 1 from public.work_orders wo
    join public.route_stops rs on rs.work_order_id = wo.id
    join public.routes r on r.id = rs.route_id
    join public.drivers d on d.id = r.driver_id
    where wo.customer_id = customers.id and d.user_id = auth.uid()
  )
);
create policy maintenance_rules_admin_read on public.maintenance_rules for select using (public.has_org_role(org_id, 'admin'));
create policy work_orders_admin_read on public.work_orders for select using (public.has_org_role(org_id, 'admin'));
create policy work_orders_driver_read on public.work_orders for select using (
  exists (
    select 1 from public.route_stops rs
    join public.routes r on r.id = rs.route_id
    join public.drivers d on d.id = r.driver_id
    where rs.work_order_id = work_orders.id and d.user_id = auth.uid()
  )
);
create policy planning_runs_admin_read on public.planning_runs for select using (public.has_org_role(org_id, 'admin'));
create policy plan_versions_admin_read on public.plan_versions for select using (public.has_org_role(org_id, 'admin'));
create policy routes_admin_read on public.routes for select using (public.has_org_role(org_id, 'admin'));
create policy routes_driver_read on public.routes for select using (exists(select 1 from public.drivers d where d.id = routes.driver_id and d.user_id = auth.uid()));
create policy route_stops_admin_read on public.route_stops for select using (public.has_org_role(org_id, 'admin'));
create policy route_stops_driver_read on public.route_stops for select using (exists(select 1 from public.routes r join public.drivers d on d.id = r.driver_id where r.id = route_stops.route_id and d.user_id = auth.uid()));
create policy driver_events_admin_read on public.driver_events for select using (public.has_org_role(org_id, 'admin'));
create policy driver_events_self_read on public.driver_events for select using (exists(select 1 from public.drivers d where d.id = driver_events.driver_id and d.user_id = auth.uid()));
create policy driver_event_insert on public.driver_events for insert with check (exists(select 1 from public.drivers d where d.id = driver_id and d.org_id = driver_events.org_id and d.user_id = auth.uid()));
create policy driver_locations_admin_read on public.driver_locations for select using (public.has_org_role(org_id, 'admin'));
create policy driver_locations_self_read on public.driver_locations for select using (exists(select 1 from public.drivers d where d.id = driver_locations.driver_id and d.user_id = auth.uid()));
create policy driver_location_insert on public.driver_locations for insert with check (exists(select 1 from public.drivers d where d.id = driver_id and d.org_id = driver_locations.org_id and d.user_id = auth.uid()));
create policy service_reports_admin_read on public.service_reports for select using (public.has_org_role(org_id, 'admin'));
create policy service_reports_driver_read on public.service_reports for select using (exists(select 1 from public.work_orders wo join public.route_stops rs on rs.work_order_id = wo.id join public.routes r on r.id = rs.route_id join public.drivers d on d.id = r.driver_id where wo.id = service_reports.work_order_id and d.user_id = auth.uid()));
create policy service_reports_driver_insert on public.service_reports for insert with check (exists(select 1 from public.work_orders wo join public.route_stops rs on rs.work_order_id = wo.id join public.routes r on r.id = rs.route_id join public.drivers d on d.id = r.driver_id where wo.id = work_order_id and wo.org_id = service_reports.org_id and d.user_id = auth.uid()));
create policy attachments_admin_read on public.attachments for select using (public.has_org_role(org_id, 'admin'));
create policy attachments_driver_read on public.attachments for select using (exists(select 1 from public.service_reports sr join public.work_orders wo on wo.id = sr.work_order_id join public.route_stops rs on rs.work_order_id = wo.id join public.routes r on r.id = rs.route_id join public.drivers d on d.id = r.driver_id where sr.id = attachments.report_id and d.user_id = auth.uid()));
-- Raw portal tokens are never exposed to drivers or anonymous clients.
create policy portal_tokens_admin_read on public.portal_tokens for select using (public.has_org_role(org_id, 'admin'));
create policy notifications_admin_read on public.notifications for select using (public.has_org_role(org_id, 'admin'));
create policy jobs_admin_read on public.jobs for select using (public.has_org_role(org_id, 'admin'));
create policy audit_events_admin_read on public.audit_events for select using (public.has_org_role(org_id, 'admin'));

-- Admin mutations. Driver writes are limited to their own event/location/report
-- policies above; all other state transitions go through the server API.
do $$ declare t text; begin
  for t in select unnest(array['drivers','customers','maintenance_rules','work_orders','planning_runs','plan_versions','routes','route_stops','service_reports','attachments','portal_tokens','notifications','jobs']) loop
    execute format('create policy %1$s_admin_write on public.%1$s for all using (public.has_org_role(org_id, ''admin'')) with check (public.has_org_role(org_id, ''admin''));', t);
  end loop;
end $$;

-- Portal API uses a server-side hashed token lookup; no anonymous table policy is granted.
