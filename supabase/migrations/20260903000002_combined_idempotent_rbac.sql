-- ============================================================================
-- COMBINED IDEMPOTENT MIGRATION — paste into Supabase SQL Editor
-- Safe to re-run. Covers: migrations 12 + 13 + 14 in one shot.
-- ============================================================================

SET check_function_bodies = false;

-- ============================================================================
-- STEP 1: role_permissions table + seed data + helper functions
-- ============================================================================

create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'manager', 'worker')),
  resource text not null,
  action text not null check (action in ('view', 'create', 'edit', 'delete', 'manage_system')),
  primary key (role, resource, action)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select" on public.role_permissions
  for select using (auth.role() = 'authenticated');

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

create or replace function public.has_permission(p_role text, p_resource text, p_action text)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    when p_role is null then false
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = p_role and rp.resource = p_resource and rp.action = p_action
    )
  end;
$$;

create or replace function public.my_farm_role(p_farm_id uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select case
    when public.is_super_admin() then 'admin'
    else coalesce(
      (select role from public.user_farms where user_id = auth.uid() and farm_id = p_farm_id),
      (select role from public.profiles where id = auth.uid())
    )
  end;
$$;

grant execute on function public.has_permission(text, text, text) to authenticated;
grant execute on function public.my_farm_role(uuid) to authenticated;

-- ============================================================================
-- STEP 2: Tenant table RLS policies (farms, plots, crops, contacts, inventory)
-- ============================================================================

drop policy if exists "farms_select_own" on public.farms;
drop policy if exists "farms_insert_own" on public.farms;
drop policy if exists "farms_update_own" on public.farms;
drop policy if exists "farms_delete_own" on public.farms;
drop policy if exists "farms_select_role" on public.farms;
drop policy if exists "farms_insert_role" on public.farms;
drop policy if exists "farms_update_role" on public.farms;
drop policy if exists "farms_delete_role" on public.farms;
create policy "farms_select_role" on public.farms
  for select using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'view'));
create policy "farms_insert_role" on public.farms
  for insert with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'create'));
create policy "farms_update_role" on public.farms
  for update using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'))
  with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'));
create policy "farms_delete_role" on public.farms
  for delete using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'delete'));

drop policy if exists "plots_select_own" on public.plots;
drop policy if exists "plots_insert_own" on public.plots;
drop policy if exists "plots_update_own" on public.plots;
drop policy if exists "plots_delete_own" on public.plots;
drop policy if exists "plots_select_role" on public.plots;
drop policy if exists "plots_insert_role" on public.plots;
drop policy if exists "plots_update_role" on public.plots;
drop policy if exists "plots_delete_role" on public.plots;
create policy "plots_select_role" on public.plots
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'view'));
create policy "plots_insert_role" on public.plots
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'create'));
create policy "plots_update_role" on public.plots
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'));
create policy "plots_delete_role" on public.plots
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'delete'));

drop policy if exists "crops_select_own" on public.crop_cycles;
drop policy if exists "crops_insert_own" on public.crop_cycles;
drop policy if exists "crops_update_own" on public.crop_cycles;
drop policy if exists "crops_delete_own" on public.crop_cycles;
drop policy if exists "crops_select_role" on public.crop_cycles;
drop policy if exists "crops_insert_role" on public.crop_cycles;
drop policy if exists "crops_update_role" on public.crop_cycles;
drop policy if exists "crops_delete_role" on public.crop_cycles;
create policy "crops_select_role" on public.crop_cycles
  for select using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'view'));
create policy "crops_insert_role" on public.crop_cycles
  for insert with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'create'));
create policy "crops_update_role" on public.crop_cycles
  for update using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'))
  with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'));
create policy "crops_delete_role" on public.crop_cycles
  for delete using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'delete'));

drop policy if exists "contacts_select_own" on public.contacts;
drop policy if exists "contacts_insert_own" on public.contacts;
drop policy if exists "contacts_update_own" on public.contacts;
drop policy if exists "contacts_delete_own" on public.contacts;
drop policy if exists "contacts_select_role" on public.contacts;
drop policy if exists "contacts_insert_role" on public.contacts;
drop policy if exists "contacts_update_role" on public.contacts;
drop policy if exists "contacts_delete_role" on public.contacts;
create policy "contacts_select_role" on public.contacts
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'view'));
create policy "contacts_insert_role" on public.contacts
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'create'));
create policy "contacts_update_role" on public.contacts
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'));
create policy "contacts_delete_role" on public.contacts
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'delete'));

drop policy if exists "inventory_select_own" on public.inventory_items;
drop policy if exists "inventory_insert_own" on public.inventory_items;
drop policy if exists "inventory_update_own" on public.inventory_items;
drop policy if exists "inventory_delete_own" on public.inventory_items;
drop policy if exists "inventory_select_role" on public.inventory_items;
drop policy if exists "inventory_insert_role" on public.inventory_items;
drop policy if exists "inventory_update_role" on public.inventory_items;
drop policy if exists "inventory_delete_role" on public.inventory_items;
create policy "inventory_select_role" on public.inventory_items
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'view'));
create policy "inventory_insert_role" on public.inventory_items
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'create'));
create policy "inventory_update_role" on public.inventory_items
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'));
create policy "inventory_delete_role" on public.inventory_items
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'delete'));

-- ============================================================================
-- STEP 3: Tenant table RLS policies (workers, tasks, financials, investments)
-- ============================================================================

drop policy if exists "workers_select_own" on public.workers;
drop policy if exists "workers_insert_own" on public.workers;
drop policy if exists "workers_update_own" on public.workers;
drop policy if exists "workers_delete_own" on public.workers;
drop policy if exists "workers_select_role" on public.workers;
drop policy if exists "workers_insert_role" on public.workers;
drop policy if exists "workers_update_role" on public.workers;
drop policy if exists "workers_delete_role" on public.workers;
create policy "workers_select_role" on public.workers
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'view'));
create policy "workers_insert_role" on public.workers
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'create'));
create policy "workers_update_role" on public.workers
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'));
create policy "workers_delete_role" on public.workers
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'delete'));

drop policy if exists "tasks_select_own" on public.farm_tasks;
drop policy if exists "tasks_insert_own" on public.farm_tasks;
drop policy if exists "tasks_update_own" on public.farm_tasks;
drop policy if exists "tasks_delete_own" on public.farm_tasks;
drop policy if exists "tasks_select_role" on public.farm_tasks;
drop policy if exists "tasks_insert_role" on public.farm_tasks;
drop policy if exists "tasks_update_role" on public.farm_tasks;
drop policy if exists "tasks_delete_role" on public.farm_tasks;
create policy "tasks_select_role" on public.farm_tasks
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'view'));
create policy "tasks_insert_role" on public.farm_tasks
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'create'));
create policy "tasks_update_role" on public.farm_tasks
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'));
create policy "tasks_delete_role" on public.farm_tasks
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'delete'));

drop policy if exists "financials_select_own" on public.financial_records;
drop policy if exists "financials_insert_own" on public.financial_records;
drop policy if exists "financials_update_own" on public.financial_records;
drop policy if exists "financials_delete_own" on public.financial_records;
drop policy if exists "financials_select_role" on public.financial_records;
drop policy if exists "financials_insert_role" on public.financial_records;
drop policy if exists "financials_update_role" on public.financial_records;
drop policy if exists "financials_delete_role" on public.financial_records;
create policy "financials_select_role" on public.financial_records
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'view'));
create policy "financials_insert_role" on public.financial_records
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'create'));
create policy "financials_update_role" on public.financial_records
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'));
create policy "financials_delete_role" on public.financial_records
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'delete'));

drop policy if exists "investments_select_own" on public.investments;
drop policy if exists "investments_insert_own" on public.investments;
drop policy if exists "investments_update_own" on public.investments;
drop policy if exists "investments_delete_own" on public.investments;
drop policy if exists "investments_select_role" on public.investments;
drop policy if exists "investments_insert_role" on public.investments;
drop policy if exists "investments_update_role" on public.investments;
drop policy if exists "investments_delete_role" on public.investments;
create policy "investments_select_role" on public.investments
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'view'));
create policy "investments_insert_role" on public.investments
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'create'));
create policy "investments_update_role" on public.investments
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'));
create policy "investments_delete_role" on public.investments
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'delete'));

-- ============================================================================
-- STEP 4: set_active_farm + admin permission RPCs
-- ============================================================================

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

-- ============================================================================
-- STEP 5: bootstrap_user_farm — breaks the RLS deadlock for new users
-- ============================================================================

create or replace function public.bootstrap_user_farm(p_user_id uuid, p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.farms (id, name, location, size_in_hectares, description)
  values (p_farm_id, 'Ma ferme', '', 0, '')
  on conflict (id) do nothing;

  insert into public.user_farms (user_id, farm_id, role)
  values (p_user_id, p_farm_id, 'admin')
  on conflict (user_id, farm_id) do nothing;

  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.bootstrap_user_farm(uuid, uuid) to authenticated;

-- ============================================================================
-- DONE. If you see "Success", all migrations are applied.
-- ============================================================================
