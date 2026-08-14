-- Publish a complete VROOM result atomically. Any invalid driver, order or
-- stop rolls the whole transaction back, so drivers never see a partial plan.
create or replace function public.publish_vroom_plan(
  p_org_id uuid,
  p_planning_run_id uuid,
  p_actor_id uuid,
  p_result jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  version_id uuid;
  route_row jsonb;
  stop_row jsonb;
  route_id uuid;
begin
  select status into current_status
  from public.planning_runs
  where id = p_planning_run_id and org_id = p_org_id
  for update;
  if current_status is null then raise exception 'Planungslauf nicht gefunden'; end if;
  if current_status = 'published' then
    select id into version_id from public.plan_versions where planning_run_id = p_planning_run_id and status = 'published' order by version desc limit 1;
    return version_id;
  end if;
  if current_status <> 'completed' then raise exception 'Planungslauf ist nicht veröffentlichbar'; end if;

  insert into public.plan_versions (org_id, planning_run_id, version, status, published_at, created_by)
  values (p_org_id, p_planning_run_id, 1, 'published', now(), p_actor_id)
  returning id into version_id;

  for route_row in select value from jsonb_array_elements(coalesce(p_result->'routes', '[]'::jsonb)) loop
    insert into public.routes (org_id, plan_version_id, driver_id, route_date, status, distance_km, travel_minutes, service_minutes)
    values (p_org_id, version_id, (route_row->>'driverId')::uuid, (route_row->>'date')::date, 'published', coalesce((route_row->>'distanceKm')::numeric, 0), coalesce((route_row->>'travelMinutes')::integer, 0), coalesce((route_row->>'serviceMinutes')::integer, 0))
    returning id into route_id;

    for stop_row in select value from jsonb_array_elements(coalesce(route_row->'stops', '[]'::jsonb)) loop
      insert into public.route_stops (org_id, route_id, work_order_id, stop_order, eta, distance_from_previous_km, drive_minutes_from_previous, explanation)
      values (p_org_id, route_id, (stop_row->>'workOrderId')::uuid, (stop_row->>'order')::integer, (stop_row->>'eta')::time, coalesce((stop_row->>'distanceFromPreviousKm')::numeric, 0), coalesce((stop_row->>'driveMinutesFromPrevious')::integer, 0), stop_row->>'explanation');
      update public.work_orders set assigned_driver_id = (route_row->>'driverId')::uuid, scheduled_date = (route_row->>'date')::date, status = 'planned'
      where id = (stop_row->>'workOrderId')::uuid and org_id = p_org_id;
      if not found then raise exception 'Auftrag gehört nicht zur Organisation'; end if;
    end loop;
  end loop;

  update public.planning_runs set status = 'published', result = p_result where id = p_planning_run_id and org_id = p_org_id;
  insert into public.audit_events (org_id, actor_id, action, entity_type, entity_id, after_state, reason)
  values (p_org_id, p_actor_id, 'plan.vroom.published', 'planning_run', p_planning_run_id::text, jsonb_build_object('planVersionId', version_id, 'summary', p_result->'summary'), 'VROOM-Plan atomar veröffentlicht');
  return version_id;
end;
$$;

revoke all on function public.publish_vroom_plan(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.publish_vroom_plan(uuid, uuid, uuid, jsonb) to service_role;
