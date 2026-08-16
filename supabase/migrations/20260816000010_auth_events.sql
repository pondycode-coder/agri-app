-- Auth activity log: record every user login/logout so super admins can
-- review who was in the platform and when.
create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text not null default '',
  user_name text not null default '',
  farm_id uuid references public.farms (id) on delete set null,
  event_type text not null check (event_type in ('login', 'logout')),
  created_at timestamptz not null default now()
);

alter table public.auth_events enable row level security;

-- Anyone may INSERT a login/logout event (fire-and-forget reporting from the client).
drop policy if exists "auth_events_insert" on public.auth_events;
create policy "auth_events_insert" on public.auth_events
  for insert with check (true);

-- Only super admins may read the activity log.
drop policy if exists "auth_events_select_superadmin" on public.auth_events;
create policy "auth_events_select_superadmin" on public.auth_events
  for select using (public.is_super_admin());

-- Insert a single auth event. Security-definer so any authenticated client can
-- report its own login/logout regardless of RLS on the table.
create or replace function public.record_auth_event(
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_farm_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.auth_events (user_id, user_email, user_name, farm_id, event_type)
  values (p_user_id, p_user_email, p_user_name, p_farm_id, p_event_type);
end;
$$;

grant execute on function public.record_auth_event(uuid, text, text, uuid, text) to authenticated;

-- Super-admin read API.
create or replace function public.admin_list_auth_events(p_limit integer default 100)
returns table (
  id uuid,
  user_email text,
  user_name text,
  farm_name text,
  event_type text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.user_email, e.user_name, f.name as farm_name, e.event_type, e.created_at
  from public.auth_events e
  left join public.farms f on f.id = e.farm_id
  where public.is_super_admin()
  order by e.created_at desc
  limit greatest(1, p_limit);
$$;

grant execute on function public.admin_list_auth_events(integer) to authenticated;
