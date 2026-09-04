-- ---------------------------------------------------------------------------
-- Fix 1: admin_list_permissions return type
-- `returns setof` causes PostgREST / supabase-js to return no data
-- (silent empty array). Change to `returns table(...)` for compatibility.
--
-- Fix 2: admin_set_permission / admin_reset_permissions are void-returning
-- PL/pgSQL functions. PostgREST can return an empty body for void functions,
-- but supabase-js expects a 200 with data. No code change needed here;
-- the issue is purely on the list function.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

-- Replace the setof-returning version with a table-returning one.
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
