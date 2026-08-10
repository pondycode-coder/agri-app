-- Create / join farm flows for the in-app farm switcher.
--
-- A brand-new farm cannot satisfy `farms_insert_own` (which requires
-- id = current_farm_id()), so we provide security-definer RPCs that create
-- the farm row, add the caller to user_farms, and flip the profile's default
-- farm — all in one transaction.

-- ------------------------------------------------------------------
-- create_farm_and_join(name, location, size_in_hectares, description)
-- Creates a farm owned (admin) by the caller and makes it their default.
-- ------------------------------------------------------------------
create or replace function public.create_farm_and_join(
  p_name text,
  p_location text,
  p_size_in_hectares numeric,
  p_description text default null
)
returns public.farms
language plpgsql
security definer set search_path = public
as $$
declare
  new_farm public.farms;
begin
  if trim(p_name) = '' then
    raise exception 'farm name required';
  end if;

  insert into public.farms (name, location, size_in_hectares, description)
  values (p_name, p_location, coalesce(p_size_in_hectares, 0), p_description)
  returning * into new_farm;

  insert into public.user_farms (user_id, farm_id, role)
  values (auth.uid(), new_farm.id, 'admin');

  update public.profiles
  set farm_id = new_farm.id
  where id = auth.uid();

  return new_farm;
end;
$$;

-- ------------------------------------------------------------------
-- join_farm_by_id(farm_id)
-- Adds the caller as a worker of an existing farm and makes it the
-- default. Returns null when the farm does not exist.
-- ------------------------------------------------------------------
create or replace function public.join_farm_by_id(
  p_farm_id uuid
)
returns public.farms
language plpgsql
security definer set search_path = public
as $$
declare
  target public.farms;
begin
  select * into target from public.farms where id = p_farm_id;
  if not found then
    return null;
  end if;

  insert into public.user_farms (user_id, farm_id, role)
  values (auth.uid(), p_farm_id, 'worker')
  on conflict (user_id, farm_id) do nothing;

  update public.profiles
  set farm_id = p_farm_id
  where id = auth.uid();

  return target;
end;
$$;

-- Callers need execute on these RPCs.
grant execute on function public.create_farm_and_join(text, text, numeric, text) to authenticated;
grant execute on function public.join_farm_by_id(uuid) to authenticated;
