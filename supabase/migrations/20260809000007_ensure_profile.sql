-- Re-provision a profile row on sign-in when it is missing.
--
-- After a database reset (or manual wipe of public.profiles), existing auth
-- users have no profile row. The signup trigger only fires on NEW sign-ups,
-- so those users get locked out. This security-definer function recreates the
-- row on login — mirroring handle_new_user (seed farm attach + first-account
-- becomes super-admin) — so sign-in is self-healing.

create or replace function public.ensure_profile(p_user_id uuid, p_email text, p_name text)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_farm_id uuid;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if found then
    return v_profile;
  end if;

  -- Attach to the seed farm when present, otherwise the oldest farm.
  select f.id into v_farm_id
  from public.farms f
  order by (f.id = '00000000-0000-4000-8000-000000000001') desc, f.created_at asc
  limit 1;

  insert into public.profiles (id, email, name, farm_id, is_superadmin)
  values (
    p_user_id,
    coalesce(p_email, ''),
    coalesce(p_name, ''),
    v_farm_id,
    not exists (select 1 from public.profiles)
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.ensure_profile(uuid, text, text) to authenticated;