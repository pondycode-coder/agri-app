-- SaaS super-admin layer.
--
-- The FIRST account that ever signs up becomes the platform super-admin
-- (profiles.is_superadmin). Super-admins can see every tenant (farm), every
-- user, global stats, change roles, toggle super-admin status and delete
-- farms. All reads/writes go through security-definer RPCs that first check
-- is_super_admin() — normal RLS still hides other tenants from regular users.

-- ------------------------------------------------------------------
-- 1. is_superadmin flag on profiles
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- ------------------------------------------------------------------
-- 2. Helper: is the current user a super-admin?
-- ------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_superadmin = true
  )
$$;

-- ------------------------------------------------------------------
-- 3. First account that signs up becomes the super-admin.
--    Replaces handle_new_user from earlier migrations; still attaches
--    every new user to the seed farm.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;

  insert into public.profiles (id, email, name, farm_id, is_superadmin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    '00000000-0000-4000-8000-000000000001',
    v_first
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------
-- 4. Admin RPCs (all gated on is_super_admin()).
-- ------------------------------------------------------------------

-- All farms with a member count and financial totals.
create or replace function public.admin_list_farms()
returns table (
  id uuid,
  name text,
  location text,
  plots integer,
  size_in_hectares numeric,
  users_count bigint,
  total_income numeric,
  total_expenses numeric,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    f.id,
    f.name,
    f.location,
    f.plots,
    f.size_in_hectares,
    (select count(*) from public.user_farms uf where uf.farm_id = f.id)::bigint as users_count,
    coalesce((select sum(fr.amount) from public.financial_records fr where fr.farm_id = f.id and fr.type = 'income'), 0)::numeric as total_income,
    coalesce((select sum(fr.amount) from public.financial_records fr where fr.farm_id = f.id and fr.type = 'expense'), 0)::numeric as total_expenses,
    f.created_at
  from public.farms f
  where public.is_super_admin()
  order by f.created_at asc
$$;

-- All users with their farm name.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  farm_id uuid,
  farm_name text,
  is_superadmin boolean,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.email,
    p.name,
    p.role,
    p.farm_id,
    f.name as farm_name,
    p.is_superadmin,
    p.created_at
  from public.profiles p
  left join public.farms f on f.id = p.farm_id
  where public.is_super_admin()
  order by p.created_at asc
$$;

-- Global platform aggregates.
create or replace function public.admin_stats()
returns table (
  total_farms bigint,
  total_users bigint,
  total_plots bigint,
  total_workers bigint,
  total_tasks bigint,
  total_income numeric,
  total_expenses numeric
)
language sql
stable
security definer set search_path = public
as $$
  select
    (select count(*) from public.farms)::bigint,
    (select count(*) from public.profiles)::bigint,
    (select count(*) from public.plots)::bigint,
    (select count(*) from public.workers)::bigint,
    (select count(*) from public.farm_tasks)::bigint,
    coalesce((select sum(amount) from public.financial_records where type = 'income'), 0)::numeric,
    coalesce((select sum(amount) from public.financial_records where type = 'expense'), 0)::numeric
  where public.is_super_admin()
$$;

-- Change a user's role.
create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role text
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
  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;
end;
$$;

-- Grant or revoke super-admin status.
create or replace function public.admin_set_superadmin(
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles
  set is_superadmin = coalesce(p_active, false), updated_at = now()
  where id = p_user_id;
end;
$$;

-- Delete a farm (and, via cascade, everything scoped to it).
create or replace function public.admin_delete_farm(
  p_farm_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.farms where id = p_farm_id;
end;
$$;

-- Move a user to a different farm (their default).
create or replace function public.admin_move_user(
  p_user_id uuid,
  p_farm_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_list_farms() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_superadmin(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_farm(uuid) to authenticated;
grant execute on function public.admin_move_user(uuid, uuid) to authenticated;
