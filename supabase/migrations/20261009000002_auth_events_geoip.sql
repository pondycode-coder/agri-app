-- Add geo-location tracking to auth_events
-- ------------------------------------------------------------------
alter table public.auth_events
  add column if not exists ip_address inet,
  add column if not exists country_code char(2),
  add column if not exists country_name text;

-- Update record_auth_event to accept IP and country
create or replace function public.record_auth_event(
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_farm_id uuid,
  p_event_type text,
  p_ip_address inet default null,
  p_country_code char(2) default null,
  p_country_name text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.auth_events (user_id, user_email, user_name, farm_id, event_type, ip_address, country_code, country_name)
  values (p_user_id, p_user_email, p_user_name, p_farm_id, p_event_type, p_ip_address, p_country_code, p_country_name);
end;
$$;

grant execute on function public.record_auth_event(uuid, text, text, uuid, text, inet, char(2), text) to authenticated;

-- Update admin_list_auth_events to return geo fields
create or replace function public.admin_list_auth_events(p_limit integer default 100)
returns table (
  id uuid,
  user_email text,
  user_name text,
  farm_name text,
  event_type text,
  ip_address inet,
  country_code char(2),
  country_name text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.user_email, e.user_name, f.name as farm_name, e.event_type,
         e.ip_address, e.country_code, e.country_name, e.created_at
  from public.auth_events e
  left join public.farms f on f.id = e.farm_id
  where public.is_super_admin()
  order by e.created_at desc
  limit greatest(1, p_limit);
$$;

grant execute on function public.admin_list_auth_events(integer) to authenticated;
-- ------------------------------------------------------------------