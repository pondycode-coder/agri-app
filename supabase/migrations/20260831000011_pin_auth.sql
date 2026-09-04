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

-- crypt()/gen_salt() live in the pgcrypto extension. Supabase installs it in
-- the `extensions` schema, which is NOT on the default search_path — so the
-- functions below MUST include it explicitly.
create extension if not exists pgcrypto with schema extensions;

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

-- Return true when a PIN is already in use (its derived email exists in
-- auth.users for a DIFFERENT account). Used to block registration before
-- creating the auth user, since supabase.auth.signUp can silently "succeed"
-- for an existing email without surfacing an error.
create or replace function public.pin_taken(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text;
begin
  if p_pin is null or not (p_pin ~ '^\d{4}$') then
    return false;
  end if;
  v_email := p_pin || '@local.agri';
  return exists (
    select 1 from auth.users where email = v_email
  );
end;
$$;

-- A user may set (or change) their own PIN at registration / from their profile.
-- Keeps the Supabase account password AND email in sync so the PIN remains
-- valid for password-auth sign-in (the app derives email = <pin>@local.agri).
create or replace function public.set_my_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_email text;
begin
  if p_pin is null or not (p_pin ~ '^\d{4}$') then
    raise exception 'INVALID_PIN_FORMAT';
  end if;
  v_email := p_pin || '@local.agri';

  -- Two users sharing the same PIN would clash on the derived email. Reject it.
  if exists (
    select 1 from auth.users where email = v_email and id <> auth.uid()
  ) then
    raise exception 'PIN_ALREADY_TAKEN';
  end if;

  update public.profiles
  set pin = p_pin, email = v_email, updated_at = now()
  where id = auth.uid();
  update auth.users
  set encrypted_password = crypt('agri-app-pin-' || p_pin, gen_salt('bf')),
      updated_at = now()
  where id = auth.uid();
end;
$$;

-- Super-admin can set/reset any user's PIN. Also resets the Supabase password
-- and re-keys the account email to the derived value so the user can sign in
-- with just the PIN.
create or replace function public.admin_set_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_email text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_pin is null or not (p_pin ~ '^\d{4}$') then
    raise exception 'INVALID_PIN_FORMAT';
  end if;
  v_email := p_pin || '@local.agri';

  -- Two users sharing the same PIN would clash on the derived email. Reject it.
  if exists (
    select 1 from auth.users
    where email = v_email and id <> p_user_id
  ) then
    raise exception 'PIN_ALREADY_TAKEN';
  end if;

  update auth.users
  set email = v_email,
      encrypted_password = crypt('agri-app-pin-' || p_pin, gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;

  update public.profiles
  set email = v_email, pin = p_pin, updated_at = now()
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
grant execute on function public.pin_taken(text) to authenticated;
