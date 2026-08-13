-- Make ensure_profile idempotent under concurrent sign-in.
--
-- On login, applySession can run twice (getSession() + onAuthStateChange
-- SIGNED_IN). Both used to call ensure_profile, and the second call raced the
-- first INSERT → "duplicate key value violates unique constraint profiles_pkey".
-- ON CONFLICT makes it safe: it returns the existing/updated row.

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
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        farm_id = coalesce(public.profiles.farm_id, excluded.farm_id),
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.ensure_profile(uuid, text, text) to authenticated;