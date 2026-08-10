-- AgriApp multi-tenant schema + Row Level Security
-- Tenant = Farm. Every resource row is scoped to a farm_id.
-- Users see only rows belonging to their farm (Profiles.farm_id).
-- Apply via Supabase CLI:  supabase db push   (or paste in SQL Editor)

-- Helpers (e.g. current_farm_id()) reference tables created later in this
-- file; defer body validation to runtime so order of definition is free.
SET check_function_bodies = false;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Helper: the farm_id of the currently authenticated user
-- ------------------------------------------------------------------
create or replace function public.current_farm_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select farm_id
  from public.profiles
  where id = auth.uid()
$$;

-- ------------------------------------------------------------------
-- farms (top-level tenant)
-- ------------------------------------------------------------------
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null default '',
  plots integer not null default 0,
  size_in_hectares numeric not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farms enable row level security;

create policy "farms_select_own" on public.farms
  for select using (id = public.current_farm_id());
create policy "farms_insert_own" on public.farms
  for insert with check (id = public.current_farm_id());
create policy "farms_update_own" on public.farms
  for update using (id = public.current_farm_id()) with check (id = public.current_farm_id());
create policy "farms_delete_own" on public.farms
  for delete using (id = public.current_farm_id());

-- ------------------------------------------------------------------
-- profiles (linked 1:1 to auth.users, carries farm_id + role)
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  avatar_url text,
  role text not null default 'worker'
    check (role in ('admin', 'manager', 'worker')),
  farm_id uuid references public.farms (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------
-- plots
-- ------------------------------------------------------------------
create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null default '',
  size_in_hectares numeric not null default 0,
  soil_type text not null default 'Volcanique',
  status text not null default 'active'
    check (status in ('active', 'fallow', 'preparing', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plots enable row level security;

create policy "plots_select_own" on public.plots
  for select using (farm_id = public.current_farm_id());
create policy "plots_insert_own" on public.plots
  for insert with check (farm_id = public.current_farm_id());
create policy "plots_update_own" on public.plots
  for update using (farm_id = public.current_farm_id()) with check (farm_id = public.current_farm_id());
create policy "plots_delete_own" on public.plots
  for delete using (farm_id = public.current_farm_id());

-- ------------------------------------------------------------------
-- crop_cycles (scoped through their plot; plot_id also kept)
-- ------------------------------------------------------------------
create table if not exists public.crop_cycles (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  crop_name text not null default '',
  variety text not null default '',
  season text not null default '',
  planting_date date,
  expected_harvest_date date,
  actual_harvest_date date,
  yield_in_kg numeric,
  status text not null default 'planted'
    check (status in ('planted', 'growing', 'harvested', 'failed')),
  estimated_cost_fcfa numeric not null default 0,
  revenue_fcfa numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crop_cycles enable row level security;

create policy "crops_select_own" on public.crop_cycles
  for select using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
  );
create policy "crops_insert_own" on public.crop_cycles
  for insert with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
  );
create policy "crops_update_own" on public.crop_cycles
  for update using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
  ) with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
  );
create policy "crops_delete_own" on public.crop_cycles
  for delete using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
  );

-- ------------------------------------------------------------------
-- contacts
-- ------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  type text not null default 'customer'
    check (type in ('customer', 'supplier', 'partner')),
  phone text not null default '',
  email text,
  address text,
  farm_id uuid references public.farms (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts_select_own" on public.contacts
  for select using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "contacts_insert_own" on public.contacts
  for insert with check (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "contacts_update_own" on public.contacts
  for update using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id())
  with check (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "contacts_delete_own" on public.contacts
  for delete using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());

-- ------------------------------------------------------------------
-- inventory_items
-- ------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null default '',
  category text not null default 'input'
    check (category in ('input', 'pesticide', 'tool', 'equipment', 'fuel', 'packaging')),
  quantity numeric not null default 0,
  unit text not null default 'units',
  price_per_unit numeric not null default 0,
  supplier_id uuid references public.contacts (id) on delete set null,
  expiry_date date,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;

create policy "inventory_select_own" on public.inventory_items
  for select using (farm_id = public.current_farm_id());
create policy "inventory_insert_own" on public.inventory_items
  for insert with check (farm_id = public.current_farm_id());
create policy "inventory_update_own" on public.inventory_items
  for update using (farm_id = public.current_farm_id()) with check (farm_id = public.current_farm_id());
create policy "inventory_delete_own" on public.inventory_items
  for delete using (farm_id = public.current_farm_id());

-- ------------------------------------------------------------------
-- workers
-- ------------------------------------------------------------------
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null default '',
  role text not null default 'field_worker'
    check (role in ('field_worker', 'agronomist', 'machine_operator', 'supervisor')),
  phone_number text not null default '',
  daily_wage numeric not null default 0,
  is_active boolean not null default true,
  total_tasks_completed integer not null default 0,
  productivity_score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workers enable row level security;

create policy "workers_select_own" on public.workers
  for select using (farm_id = public.current_farm_id());
create policy "workers_insert_own" on public.workers
  for insert with check (farm_id = public.current_farm_id());
create policy "workers_update_own" on public.workers
  for update using (farm_id = public.current_farm_id()) with check (farm_id = public.current_farm_id());
create policy "workers_delete_own" on public.workers
  for delete using (farm_id = public.current_farm_id());

-- ------------------------------------------------------------------
-- farm_tasks
-- ------------------------------------------------------------------
create table if not exists public.farm_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete set null,
  plot_id uuid references public.plots (id) on delete set null,
  title text not null default '',
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_date date,
  due_date date,
  completed_date date,
  wage_amount numeric,
  wage_paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farm_tasks enable row level security;

create policy "tasks_select_own" on public.farm_tasks
  for select using (farm_id = public.current_farm_id());
create policy "tasks_insert_own" on public.farm_tasks
  for insert with check (farm_id = public.current_farm_id());
create policy "tasks_update_own" on public.farm_tasks
  for update using (farm_id = public.current_farm_id()) with check (farm_id = public.current_farm_id());
create policy "tasks_delete_own" on public.farm_tasks
  for delete using (farm_id = public.current_farm_id());

-- ------------------------------------------------------------------
-- financial_records
-- ------------------------------------------------------------------
create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null default 'income'
    check (type in ('income', 'expense')),
  amount numeric not null default 0,
  currency text not null default 'XAF',
  date date,
  description text not null default '',
  category text not null default 'Other',
  worker_id uuid references public.workers (id) on delete set null,
  task_id uuid references public.farm_tasks (id) on delete set null,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'orange_money', 'mtn_momo', 'bank_transfer')),
  receipt_url text,
  related_contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_records enable row level security;

create policy "financials_select_own" on public.financial_records
  for select using (farm_id = public.current_farm_id());
create policy "financials_insert_own" on public.financial_records
  for insert with check (farm_id = public.current_farm_id());
create policy "financials_update_own" on public.financial_records
  for update using (farm_id = public.current_farm_id()) with check (farm_id = public.current_farm_id());
create policy "financials_delete_own" on public.financial_records
  for delete using (farm_id = public.current_farm_id());

-- ------------------------------------------------------------------
-- investments
-- ------------------------------------------------------------------
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms (id) on delete cascade,
  name text not null default '',
  type text not null default 'other'
    check (type in ('equipment', 'infrastructure', 'irrigation', 'land', 'other')),
  amount numeric not null default 0,
  date date,
  description text,
  expected_return numeric,
  return_date date,
  status text not null default 'active'
    check (status in ('active', 'matured', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investments enable row level security;

create policy "investments_select_own" on public.investments
  for select using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "investments_insert_own" on public.investments
  for insert with check (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "investments_update_own" on public.investments
  for update using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id())
  with check (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());
create policy "investments_delete_own" on public.investments
  for delete using (coalesce(farm_id, public.current_farm_id()) = public.current_farm_id());

RESET check_function_bodies;