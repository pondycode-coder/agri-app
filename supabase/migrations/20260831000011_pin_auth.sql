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

-- Sign-in: verify email + PIN and return the profile row.
-- Returns no rows / raises when the account is unknown or the PIN is wrong.
create or replace function public.sign_in_with_pin(p_email text, p_pin text)
returns table (
  id uuid,
  email text,
  name text,
  role text,
  farm_id uuid,
  is_superadmin boolean
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where lower(email) = lower(p_email)
  ) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.profiles
    where lower(email) = lower(p_email)
    and pin is not null
    and pin = p_pin
  ) then
    raise exception 'INVALID_PIN';
  end if;

  return query
    select
      p.id,
      p.email,
      p.name,
      p.role,
      p.farm_id,
      p.is_superadmin
    from public.profiles p
    where lower(p.email) = lower(p_email);
end;
$$;

-- A user may set (or change) their own PIN at registration / from their profile.
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
end;
$$;

-- Super-admin can set/reset any user's PIN.
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

grant execute on function public.sign_in_with_pin(text, text) to authenticated;
grant execute on function public.set_my_pin(text) to authenticated;
grant execute on function public.admin_set_pin(uuid, text) to authenticated;
