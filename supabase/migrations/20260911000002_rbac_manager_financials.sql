-- Patch: grant manager full CRUD on financials + investments.
-- The original RBAC seed only granted 'view' to manager for these two resources,
-- which blocked upserts and caused "Échec de synchronisation" in the app.

-- Remove the view-only rows so ON CONFLICT doesn't silently no-op.
delete from public.role_permissions
where role = 'manager'
  and resource in ('financials', 'investments')
  and action = 'view';

-- Insert full CRUD permissions.
insert into public.role_permissions (role, resource, action)
values
  ('manager', 'financials', 'view'),
  ('manager', 'financials', 'create'),
  ('manager', 'financials', 'edit'),
  ('manager', 'financials', 'delete'),
  ('manager', 'investments', 'view'),
  ('manager', 'investments', 'create'),
  ('manager', 'investments', 'edit'),
  ('manager', 'investments', 'delete')
on conflict (role, resource, action) do nothing;