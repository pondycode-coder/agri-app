-- ---------------------------------------------------------------------------
-- Role-based access on the DATABASE, not just the UI (#4 of the RBAC plan).
--
-- Since the app now carries per-farm roles (user_farms.role) and a data-driven
-- permission matrix on its side (src/utils/rbac.ts), this migration mirrors
-- that matrix into Postgres and wires it into every tenant-table RLS policy so
-- a client cannot read/write what its role forbids — even by calling the API
-- directly.
--
-- Policy pattern (e.g. farm_tasks):
--   farm_id = current_farm_id()
--   AND has_permission(my_farm_role(current_farm_id()), 'tasks', 'view')
--
-- Resource names mirror the frontend (rbac.ts): farms, plots, crops,
-- inventory, workers, tasks, financials, contacts, investments, profile, dashboard.
-- ---------------------------------------------------------------------------

-- Super-admin has already been declared in pin_auth; helper functions below
-- reference it, so defer body validation to runtime.
SET check_function_bodies = false;

-- ------------------------------------------------------------------
-- role_permissions (the authoritative matrix, mirrors src/utils/rbac.ts)
-- ------------------------------------------------------------------
create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'manager', 'worker')),
  resource text not null,
  action text not null check (action in ('view', 'create', 'edit', 'delete', 'manage_system')),
  primary key (role, resource, action)
);

alter table public.role_permissions enable row level security;

-- The matrix is non-sensitive, read-only metadata: any signed-in user may read
-- it (also the basis for a future SaaS-Admin permissions editor).
create policy "role_permissions_select" on public.role_permissions
  for select using (auth.role() = 'authenticated');

insert into public.role_permissions (role, resource, action)
select r.role, r.resource, r.action
from (values
  -- manager: full CRUD on operational resources ...
  ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
  ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
  ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
  ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
  ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
  ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
  ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
  -- ... read-only finance & investments ...
  ('manager','financials','view'),
  ('manager','investments','view'),
  ('manager','profile','view'),('manager','profile','edit'),
  ('manager','dashboard','view'),
  -- worker: read operational state, may update (not delete) their tasks
  ('worker','farms','view'),
  ('worker','plots','view'),
  ('worker','crops','view'),
  ('worker','inventory','view'),
  ('worker','tasks','view'),('worker','tasks','edit'),
  ('worker','profile','view'),
  ('worker','dashboard','view')
) as r(role, resource, action)
on conflict (role, resource, action) do nothing;

-- ------------------------------------------------------------------
-- has_permission(p_role, p_resource, p_action)
-- Pure matrix lookup. admin is implicit (everything). Null/unknown role -> false.
-- ------------------------------------------------------------------
create or replace function public.has_permission(p_role text, p_resource text, p_action text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    when p_role is null then false
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = p_role
        and rp.resource = p_resource
        and rp.action = p_action
    )
  end;
$$;

-- ------------------------------------------------------------------
-- my_farm_role(p_farm_id)
-- The current user's role ON A GIVEN FARM (user_farms), with the profile
-- role as fallback, and super-admins treated as admin everywhere.
-- ------------------------------------------------------------------
create or replace function public.my_farm_role(p_farm_id uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
    when public.is_super_admin() then 'admin'
    else coalesce(
      (select role from public.user_farms
        where user_id = auth.uid() and farm_id = p_farm_id),
      (select role from public.profiles where id = auth.uid())
    )
  end;
$$;

grant execute on function public.has_permission(text, text, text) to authenticated;
grant execute on function public.my_farm_role(uuid) to authenticated;

-- ------------------------------------------------------------------
-- Re-gate every tenant table's policies on the role matrix.
-- Previous farm-only policies are DROPPED (they would otherwise be OR-ed in
-- and defeat the whole point), then re-created with role checks.
-- ------------------------------------------------------------------

-- farms ------------------------------------------------------------
drop policy if exists "farms_select_own" on public.farms;
drop policy if exists "farms_insert_own" on public.farms;
drop policy if exists "farms_update_own" on public.farms;
drop policy if exists "farms_delete_own" on public.farms;
create policy "farms_select_role" on public.farms
  for select using (
    id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(id), 'farms', 'view')
  );
create policy "farms_insert_role" on public.farms
  for insert with check (
    id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(id), 'farms', 'create')
  );
create policy "farms_update_role" on public.farms
  for update using (
    id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(id), 'farms', 'edit')
  ) with check (
    id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(id), 'farms', 'edit')
  );
create policy "farms_delete_role" on public.farms
  for delete using (
    id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(id), 'farms', 'delete')
  );

-- plots ------------------------------------------------------------
drop policy if exists "plots_select_own" on public.plots;
drop policy if exists "plots_insert_own" on public.plots;
drop policy if exists "plots_update_own" on public.plots;
drop policy if exists "plots_delete_own" on public.plots;
create policy "plots_select_role" on public.plots
  for select using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'plots', 'view')
  );
create policy "plots_insert_role" on public.plots
  for insert with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'plots', 'create')
  );
create policy "plots_update_role" on public.plots
  for update using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit')
  ) with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit')
  );
create policy "plots_delete_role" on public.plots
  for delete using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'plots', 'delete')
  );

-- crop_cycles (scoped via plot_id -> plots.farm_id) ---------------
drop policy if exists "crops_select_own" on public.crop_cycles;
drop policy if exists "crops_insert_own" on public.crop_cycles;
drop policy if exists "crops_update_own" on public.crop_cycles;
drop policy if exists "crops_delete_own" on public.crop_cycles;
create policy "crops_select_role" on public.crop_cycles
  for select using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'crops', 'view')
  );
create policy "crops_insert_role" on public.crop_cycles
  for insert with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'crops', 'create')
  );
create policy "crops_update_role" on public.crop_cycles
  for update using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'crops', 'edit')
  ) with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'crops', 'edit')
  );
create policy "crops_delete_role" on public.crop_cycles
  for delete using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'crops', 'delete')
  );

-- contacts (farm_id optional) --------------------------------------
drop policy if exists "contacts_select_own" on public.contacts;
drop policy if exists "contacts_insert_own" on public.contacts;
drop policy if exists "contacts_update_own" on public.contacts;
drop policy if exists "contacts_delete_own" on public.contacts;
create policy "contacts_select_role" on public.contacts
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'contacts', 'view')
  );
create policy "contacts_insert_role" on public.contacts
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'contacts', 'create')
  );
create policy "contacts_update_role" on public.contacts
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'contacts', 'edit')
  ) with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'contacts', 'edit')
  );
create policy "contacts_delete_role" on public.contacts
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'contacts', 'delete')
  );

-- inventory_items --------------------------------------------------
drop policy if exists "inventory_select_own" on public.inventory_items;
drop policy if exists "inventory_insert_own" on public.inventory_items;
drop policy if exists "inventory_update_own" on public.inventory_items;
drop policy if exists "inventory_delete_own" on public.inventory_items;
create policy "inventory_select_role" on public.inventory_items
  for select using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'view')
  );
create policy "inventory_insert_role" on public.inventory_items
  for insert with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'create')
  );
create policy "inventory_update_role" on public.inventory_items
  for update using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit')
  ) with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit')
  );
create policy "inventory_delete_role" on public.inventory_items
  for delete using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'delete')
  );

-- workers ----------------------------------------------------------
drop policy if exists "workers_select_own" on public.workers;
drop policy if exists "workers_insert_own" on public.workers;
drop policy if exists "workers_update_own" on public.workers;
drop policy if exists "workers_delete_own" on public.workers;
create policy "workers_select_role" on public.workers
  for select using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'workers', 'view')
  );
create policy "workers_insert_role" on public.workers
  for insert with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'workers', 'create')
  );
create policy "workers_update_role" on public.workers
  for update using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit')
  ) with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit')
  );
create policy "workers_delete_role" on public.workers
  for delete using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'workers', 'delete')
  );

-- farm_tasks -------------------------------------------------------
drop policy if exists "tasks_select_own" on public.farm_tasks;
drop policy if exists "tasks_insert_own" on public.farm_tasks;
drop policy if exists "tasks_update_own" on public.farm_tasks;
drop policy if exists "tasks_delete_own" on public.farm_tasks;
create policy "tasks_select_role" on public.farm_tasks
  for select using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'view')
  );
create policy "tasks_insert_role" on public.farm_tasks
  for insert with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'create')
  );
create policy "tasks_update_role" on public.farm_tasks
  for update using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit')
  ) with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit')
  );
create policy "tasks_delete_role" on public.farm_tasks
  for delete using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'delete')
  );

-- financial_records ------------------------------------------------
drop policy if exists "financials_select_own" on public.financial_records;
drop policy if exists "financials_insert_own" on public.financial_records;
drop policy if exists "financials_update_own" on public.financial_records;
drop policy if exists "financials_delete_own" on public.financial_records;
create policy "financials_select_role" on public.financial_records
  for select using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'financials', 'view')
  );
create policy "financials_insert_role" on public.financial_records
  for insert with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'financials', 'create')
  );
create policy "financials_update_role" on public.financial_records
  for update using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit')
  ) with check (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit')
  );
create policy "financials_delete_role" on public.financial_records
  for delete using (
    farm_id = public.current_farm_id()
    and public.has_permission(public.my_farm_role(farm_id), 'financials', 'delete')
  );

-- investments (farm_id optional) -----------------------------------
drop policy if exists "investments_select_own" on public.investments;
drop policy if exists "investments_insert_own" on public.investments;
drop policy if exists "investments_update_own" on public.investments;
drop policy if exists "investments_delete_own" on public.investments;
create policy "investments_select_role" on public.investments
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'investments', 'view')
  );
create policy "investments_insert_role" on public.investments
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'investments', 'create')
  );
create policy "investments_update_role" on public.investments
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'investments', 'edit')
  ) with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'investments', 'edit')
  );
create policy "investments_delete_role" on public.investments
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(
      public.my_farm_role(public.current_farm_id()), 'investments', 'delete')
  );