-- ---------------------------------------------------------------------------
-- PIN-based login layer.
--
-- Profiles store a plaintext 4-digit PIN so that super-admins can view and
-- reset it for any user (see admin_list_users / admin_set_pin below) and so a
-- worker/manager can sign in with just their email + PIN (sign_in_with_pin).
--
-- The PIN is deliberately plaintext: this is a small-farm access code, not a
-- credential, and the admin needs to be able to read it back and hand it to
-- the user.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists pin text;

-- The PIN doubles as the Supabase account password so that sign-in creates a
-- real session (auth.uid()) and RLS lets the app read the user's data. This
-- function is no longer used by the app — sign-in is supabase.auth password
-- auth with the PIN — but it is kept for reference. Drop it to keep things tidy.
drop function if exists public.sign_in_with_pin(text, text);

-- Return the complementary helper used by sign-in flows.
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

-- A user may set (or change) their own PIN at registration / from their profile.
-- Keeps the Supabase account password in sync so the PIN remains valid for
-- password-auth sign-in. Supabase needs >=6 char passwords, so the stored
-- password is derived from the 4-digit PIN (frontend uses the same prefix).
create or replace function public.set_my_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_pin is null or not (p_pin ~ '^\d{4}$') then
    raise exception 'INVALID_PIN_FORMAT';
  end if;
  update public.profiles
  set pin = p_pin, updated_at = now()
  where id = auth.uid();
  update auth.users
  set encrypted_password = crypt('agri-app-pin-' || p_pin, gen_salt('bf'))
  where id = auth.uid();
end;
$$;

-- Super-admin can set/reset any user's PIN. Also resets the Supabase password
-- to the derived value so the user can sign in with the PIN.
create or replace function public.admin_set_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_pin is null or not (p_pin ~ '^\d{4}$') then
    raise exception 'INVALID_PIN_FORMAT';
  end if;
  update public.profiles
  set pin = p_pin, updated_at = now()
  where id = p_user_id;
  update auth.users
  set encrypted_password = crypt('agri-app-pin-' || p_pin, gen_salt('bf'))
  where id = p_user_id;
end;
$$;

-- Extend the super-admin user list to expose each user's PIN.
-- DROP first: the original (from 20260809000005) has a different return type,
-- and CREATE OR REPLACE cannot change the OUT-parameter row type.
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  farm_id uuid,
  farm_name text,
  is_superadmin boolean,
  pin text,
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
    p.pin,
    p.created_at
  from public.profiles p
  left join public.farms f on f.id = p.farm_id
  where public.is_super_admin()
  order by p.created_at asc
$$;

grant execute on function public.set_my_pin(text) to authenticated;
grant execute on function public.admin_set_pin(uuid, text) to authenticated;
