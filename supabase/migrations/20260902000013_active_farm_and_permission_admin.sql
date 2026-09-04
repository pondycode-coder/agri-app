-- ---------------------------------------------------------------------------
-- Active-farm switching + SaaS-admin permission editor. Fully idempotent.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

-- set_active_farm
create or replace function public.set_active_farm(p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_farms
    where user_id = auth.uid() and farm_id = p_farm_id
  ) then
    return false;
  end if;
  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.set_active_farm(uuid) to authenticated;

-- admin_list_permissions (table return for PostgREST compatibility)
create or replace function public.admin_list_permissions()
returns table(role text, resource text, action text)
language sql
stable
security definer set search_path = public
as $$
  select rp.role, rp.resource, rp.action
  from public.role_permissions rp
  where public.is_super_admin()
$$;

-- admin_set_permission
create or replace function public.admin_set_permission(
  p_role text,
  p_resource text,
  p_action text,
  p_allowed boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_role not in ('admin', 'manager', 'worker') then
    raise exception 'invalid role';
  end if;
  if p_role = 'admin' then
    raise exception 'admin permissions are implicit';
  end if;
  if p_allowed then
    insert into public.role_permissions (role, resource, action)
    values (p_role, p_resource, p_action)
    on conflict (role, resource, action) do nothing;
  else
    delete from public.role_permissions
    where role = p_role and resource = p_resource and action = p_action;
  end if;
end;
$$;

-- admin_reset_permissions
create or replace function public.admin_reset_permissions()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.role_permissions where role in ('manager', 'worker');
  insert into public.role_permissions (role, resource, action)
  select r.role, r.resource, r.action
  from (values
    ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
    ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
    ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
    ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
    ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
    ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
    ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
    ('manager','financials','view'),
    ('manager','investments','view'),
    ('manager','profile','view'),('manager','profile','edit'),
    ('manager','dashboard','view'),
    ('worker','farms','view'),
    ('worker','plots','view'),
    ('worker','crops','view'),
    ('worker','inventory','view'),
    ('worker','tasks','view'),('worker','tasks','edit'),
    ('worker','profile','view'),
    ('worker','dashboard','view')
  ) as r(role, resource, action)
  on conflict (role, resource, action) do nothing;
end;
$$;

grant execute on function public.admin_list_permissions() to authenticated;
grant execute on function public.admin_set_permission(text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_permissions() to authenticated;
