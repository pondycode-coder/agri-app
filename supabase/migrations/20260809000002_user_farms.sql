-- Multi-farm membership: a user can belong to several farms.
-- Farm switching is handled in the app via this join table.

-- ------------------------------------------------------------------
-- user_farms (join: auth user <-> farm)
-- ------------------------------------------------------------------
create table if not exists public.user_farms (
  user_id uuid not null references auth.users (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  role text not null default 'worker'
    check (role in ('admin', 'manager', 'worker')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, farm_id)
);

alter table public.user_farms enable row level security;

create policy "user_farms_select_own" on public.user_farms
  for select using (user_id = auth.uid());
create policy "user_farms_insert_own" on public.user_farms
  for insert with check (user_id = auth.uid());
create policy "user_farms_update_own" on public.user_farms
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_farms_delete_own" on public.user_farms
  for delete using (user_id = auth.uid());

-- Keep profiles.farm_id as the "primary / default" farm in sync.
-- When a row is inserted in user_farms and the profile has no farm yet,
-- make it the default one.
create or replace function public.sync_default_farm_from_membership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set farm_id = coalesce(farm_id, new.farm_id)
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_user_farm_created on public.user_farms;
create trigger on_user_farm_created
  after insert on public.user_farms
  for each row execute procedure public.sync_default_farm_from_membership();

-- Helper: farms the current user belongs to (union of join table rows).
create or replace function public.current_user_farms()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select farm_id from public.user_farms where user_id = auth.uid()
$$;