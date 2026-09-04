-- ---------------------------------------------------------------------------
-- bootstrap_user_farm: security-definer function that breaks the chicken-and-egg
-- RLS deadlock during first login.
--
-- When a user registers via PIN, handle_new_user creates a profile with
-- farm_id = NULL. Then activateFarm needs to:
--   1. Create the seed farm       → blocked because farms INSERT requires current_farm_id()
--   2. Add user to user_farms     → blocked because the farm doesn't exist yet
--   3. Set profiles.farm_id       → blocked because user_farms membership is missing
--
-- This function runs as the function owner (superuser) bypassing RLS, so it
-- can do all three in one atomic transaction.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

create or replace function public.bootstrap_user_farm(p_user_id uuid, p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  -- 1. Create the farm if it doesn't exist
  insert into public.farms (id, name, location, size_in_hectares, description)
  values (p_farm_id, 'Ma ferme', '', 0, '')
  on conflict (id) do nothing;

  -- 2. Add the user to the farm (ignore if already a member)
  insert into public.user_farms (user_id, farm_id, role)
  values (p_user_id, p_farm_id, 'admin')
  on conflict (user_id, farm_id) do nothing;

  -- 3. Set the user's active farm
  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.bootstrap_user_farm(uuid, uuid) to authenticated;
