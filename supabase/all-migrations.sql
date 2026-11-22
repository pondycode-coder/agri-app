-- AgriApp: every Supabase migration in apply order.
-- Concatenation of supabase/migrations/*.sql - run top to bottom on a fresh project
-- (or use supabase db push).

-- ===== 20260809000000_init.sql =====
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

-- ===== 20260809000002_user_farms.sql =====
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

-- ===== 20260809000003_create_join_farm.sql =====
-- Create / join farm flows for the in-app farm switcher.
--
-- A brand-new farm cannot satisfy `farms_insert_own` (which requires
-- id = current_farm_id()), so we provide security-definer RPCs that create
-- the farm row, add the caller to user_farms, and flip the profile's default
-- farm â€” all in one transaction.

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


-- ===== 20260809000004_seed_demo.sql =====
-- AgriApp demo data seed.
-- Preloads a realistic Cameroonian farm with plots, crops, contacts,
-- inventory, workers, tasks, financials and investments so a fresh project
-- is never empty. Idempotent (on conflict do nothing).
--
-- New sign-ups are attached to this seed farm by handle_new_user (redefined
-- below), so registration lands on a populated tenant.

-- Fixed UUIDs keep the seed stable and referenceable across tables.

-- The farm_tasks columns for multi-worker assignment + per-worker wages are
-- defined by a later migration; ensure they exist before seeding tasks.
alter table public.farm_tasks
  add column if not exists worker_ids jsonb not null default '[]'::jsonb,
  add column if not exists worker_wages jsonb not null default '{}'::jsonb;

do $$
declare
  v_farm uuid := '00000000-0000-4000-8000-000000000001';
begin
  -- Guard: only seed when there are no farms yet.
  if exists (select 1 from public.farms limit 1) then
    return;
  end if;

  -- ---------------------------------------------------------------
  -- farms
  -- ---------------------------------------------------------------
  insert into public.farms (id, name, location, plots, size_in_hectares, description)
  values (
    v_farm,
    'Plantation Agro-Ouest Bafoussam',
    'Bafoussam, RÃ©gion de l''Ouest',
    3,
    18.5,
    'Exploitation mixte cafÃ©, cacao et cultures maraÃ®chÃ¨res dans les Hauts-Plateaux.'
  );

  -- ---------------------------------------------------------------
  -- plots
  -- ---------------------------------------------------------------
  insert into public.plots (id, farm_id, name, size_in_hectares, soil_type, status) values
    ('00000000-0000-4000-8000-000000000101', v_farm, 'Parcelle A - Cacao & CafÃ© Arabica', 6.5, 'Volcanique', 'active'),
    ('00000000-0000-4000-8000-000000000102', v_farm, 'Parcelle B - MaraÃ®chage & Tomate',    4.0, 'Ferrallitique', 'active'),
    ('00000000-0000-4000-8000-000000000103', v_farm, 'Parcelle C - Plantain & Haricot',     5.0, 'Argilo-limoneux', 'active');

  -- ---------------------------------------------------------------
  -- crop_cycles
  -- ---------------------------------------------------------------
  insert into public.crop_cycles
    (id, plot_id, crop_name, variety, season, planting_date, expected_harvest_date,
     actual_harvest_date, yield_in_kg, status, estimated_cost_fcfa, revenue_fcfa)
  values
    ('00000000-0000-4000-8000-000000000201',
     '00000000-0000-4000-8000-000000000101', 'Cacao', 'Mercedes / Hybride IRAD',
     'Saison des pluies 2024-2025', '2024-04-15', '2025-10-30', null, 3200, 'growing', 850000, 4800000),
    ('00000000-0000-4000-8000-000000000202',
     '00000000-0000-4000-8000-000000000102', 'Tomate', 'Cobra F1',
     'Campagne MaraÃ®chÃ¨re Bafoussam', '2024-11-01', '2025-02-28', '2025-02-25', 8500, 'harvested', 600000, 2550000),
    ('00000000-0000-4000-8000-000000000203',
     '00000000-0000-4000-8000-000000000103', 'Plantain', 'Batard / Big Ebanga',
     'Saison 2024', '2024-05-10', '2025-06-15', null, null, 'planted', 450000, 1800000);

  -- ---------------------------------------------------------------
  -- contacts
  -- ---------------------------------------------------------------
  insert into public.contacts (id, name, type, phone, email, address, farm_id, notes) values
    ('00000000-0000-4000-8000-000000000301',
     'SociÃ©tÃ© CoopÃ©rative des Planteurs du Mungo (SOCOPMU)', 'customer',
     '+237 6 99 12 34 56', 'achats@socopmu.cm', 'Kumba - Penja Highway, RÃ©gion du Sud-Ouest', v_farm,
     'Acheteur principal de fÃ¨ves de cacao marchandes certifiÃ©es.'),
    ('00000000-0000-4000-8000-000000000302',
     'AgriTech Group SARL (Engrais & Intrants)', 'supplier',
     '+237 6 77 88 99 00', 'contact@agritech.cm', 'Bastos, YaoundÃ©', v_farm,
     'Fournisseur d''engrais NPK 20-10-10 et pulvÃ©risateurs.');

  -- ---------------------------------------------------------------
  -- inventory_items
  -- ---------------------------------------------------------------
  insert into public.inventory_items
    (id, farm_id, name, category, quantity, unit, price_per_unit, supplier_id, expiry_date)
  values
    ('00000000-0000-4000-8000-000000000401', v_farm, 'Engrais NPK 20-10-10 (Sacs 50kg)',
     'input', 35, 'sacs', 28500, '00000000-0000-4000-8000-000000000302', '2026-12-31'),
    ('00000000-0000-4000-8000-000000000402', v_farm, 'Fungicide Nordox 75 WG (Antifongique Cacao)',
     'pesticide', 8, 'boÃ®tes 1kg', 14500, '00000000-0000-4000-8000-000000000302', '2025-08-15'),
    ('00000000-0000-4000-8000-000000000403', v_farm, 'PulvÃ©risateur Ã  Dos Solo 15L',
     'tool', 5, 'unitÃ©s', 38000, '00000000-0000-4000-8000-000000000302', null),
    ('00000000-0000-4000-8000-000000000404', v_farm, 'Semences Hybrides Tomate Cobra F1',
     'input', 12, 'sachets 100g', 18000, '00000000-0000-4000-8000-000000000302', '2025-11-20');

  -- ---------------------------------------------------------------
  -- workers
  -- ---------------------------------------------------------------
  insert into public.workers
    (id, farm_id, name, role, phone_number, daily_wage, is_active, total_tasks_completed, productivity_score)
  values
    ('00000000-0000-4000-8000-000000000501', v_farm, 'Samuel Mvondo', 'field_worker',   '+237 6 91 22 33 44', 3500, true, 42, 4.8),
    ('00000000-0000-4000-8000-000000000502', v_farm, 'Emmanuel Talla', 'agronomist',     '+237 6 74 55 66 77', 4000, true, 31, 4.9),
    ('00000000-0000-4000-8000-000000000503', v_farm, 'Christelle Nguema', 'supervisor',  '+237 6 95 11 22 33', 3000, true, 28, 4.6);

  -- ---------------------------------------------------------------
  -- farm_tasks
  -- ---------------------------------------------------------------
  insert into public.farm_tasks
    (id, farm_id, worker_id, worker_ids, plot_id, title, description, status, assigned_date, due_date,
     completed_date, wage_amount, worker_wages, wage_paid, notes)
  values
    ('00000000-0000-4000-8000-000000000601', v_farm,
     '00000000-0000-4000-8000-000000000501', '["00000000-0000-4000-8000-000000000501"]'::jsonb,
     '00000000-0000-4000-8000-000000000101',
     'Ã‰mondage et dÃ©sherbage parcelle Cacao A',
     'Nettoyer les pieds de cacaoyers et Ã©liminer les rejets parasitaires.',
     'in_progress', '2025-02-20', '2025-02-28', null, 12500,
     '{"00000000-0000-4000-8000-000000000501": 12500}'::jsonb, false,
     'PrioritÃ© avant le dÃ©but des premiÃ¨res pluies.'),
    ('00000000-0000-4000-8000-000000000602', v_farm,
     '00000000-0000-4000-8000-000000000502', '["00000000-0000-4000-8000-000000000502"]'::jsonb,
     '00000000-0000-4000-8000-000000000101',
     'Traitement phytosanitaire fongicide Nordox',
     'Traitement prÃ©ventif contre la pourriture brune des cabosses de cacao.',
     'pending', '2025-03-01', '2025-03-05', null, 6500,
     '{"00000000-0000-4000-8000-000000000502": 6500}'::jsonb, false, null),
    ('00000000-0000-4000-8000-000000000603', v_farm,
     '00000000-0000-4000-8000-000000000501',
     '["00000000-0000-4000-8000-000000000501","00000000-0000-4000-8000-000000000502","00000000-0000-4000-8000-000000000503"]'::jsonb,
     '00000000-0000-4000-8000-000000000102',
     'RÃ©colte et conditionnement des tomates Cobra F1',
     'Tri selon le calibre A/B/C et mise en cagettes.',
     'completed', '2025-02-22', '2025-02-25', '2025-02-24', 22000,
     '{"00000000-0000-4000-8000-000000000501": 8000,"00000000-0000-4000-8000-000000000502": 7000,"00000000-0000-4000-8000-000000000503": 7000}'::jsonb,
     true, null);

  -- ---------------------------------------------------------------
  -- financial_records
  -- ---------------------------------------------------------------
  insert into public.financial_records
    (id, farm_id, type, amount, currency, date, description, category, worker_id, payment_method, related_contact_id)
  values
    ('00000000-0000-4000-8000-000000000701', v_farm, 'income', 2550000, 'XAF', '2025-02-25',
     'Vente rÃ©colte Tomates Cobra (170 cagettes)', 'Vente RÃ©colte', null, 'orange_money',
     '00000000-0000-4000-8000-000000000301'),
    ('00000000-0000-4000-8000-000000000702', v_farm, 'expense', 427500, 'XAF', '2025-02-10',
     'Achat de 15 sacs engrais NPK 20-10-10', 'Achat Intrants', null, 'mtn_momo',
     '00000000-0000-4000-8000-000000000302'),
    ('00000000-0000-4000-8000-000000000703', v_farm, 'expense', 105000, 'XAF', '2025-02-24',
     'Paiement salaires hebdomadaires ouvriers agricoles', 'Salaires Ouvriers',
     '00000000-0000-4000-8000-000000000501', 'cash', null),
    ('00000000-0000-4000-8000-000000000704', v_farm, 'income', 4800000, 'XAF', '2024-11-15',
     'Vente 1.6 Tonnes de fÃ¨ves de Cacao marchandes', 'Vente RÃ©colte', null, 'bank_transfer',
     '00000000-0000-4000-8000-000000000301');

  -- ---------------------------------------------------------------
  -- investments
  -- ---------------------------------------------------------------
  insert into public.investments
    (id, farm_id, name, type, amount, date, description, expected_return, return_date, status)
  values
    ('00000000-0000-4000-8000-000000000801', v_farm,
     'SystÃ¨me d''Irrigation Goutte-Ã -Goutte Solaire', 'irrigation',
     3500000, '2024-09-10',
     'Installation de pompage solaire et tuyauterie pour la parcelle de tomate et maraÃ®chage.',
     6000000, '2026-09-10', 'active'),
    ('00000000-0000-4000-8000-000000000802', v_farm,
     'SÃ©choir Solaire Hybride pour Cacao & CafÃ©', 'infrastructure',
     2200000, '2024-06-15',
     'Shed de sÃ©chage protÃ©gÃ© amÃ©liorant la qualitÃ© marchandise du cacao (grade 1).',
     4500000, '2025-12-31', 'active');
end $$;

-- ------------------------------------------------------------------
-- Attach new sign-ups to the seed farm so a fresh account is populated.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, farm_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    '00000000-0000-4000-8000-000000000001'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ===== 20260809000005_superadmin.sql =====
-- SaaS super-admin layer.
--
-- The FIRST account that ever signs up becomes the platform super-admin
-- (profiles.is_superadmin). Super-admins can see every tenant (farm), every
-- user, global stats, change roles, toggle super-admin status and delete
-- farms. All reads/writes go through security-definer RPCs that first check
-- is_super_admin() â€” normal RLS still hides other tenants from regular users.

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
-- Applies to the profile AND to the user's memberships (user_farms), so the
-- role is consistent everywhere the app reads it (profiles.role fallback and
-- per-farm user_farms.role).
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
  update public.user_farms
  set role = p_role, updated_at = now()
  where user_id = p_user_id;
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


-- ===== 20260809000006_task_worker_wages.sql =====
-- Per-worker wages for tasks + missing worker_ids column.
--
-- The app assigns multiple workers per task (FarmTask.worker_ids) and now
-- tracks an individual wage per worker (FarmTask.worker_wages, keyed by
-- worker id). The original schema only had a single worker_id + wage_amount,
-- so sync of multi-worker tasks silently failed. Add both JSONB columns and
-- backfill worker_ids from worker_id.

alter table public.farm_tasks
  add column if not exists worker_ids jsonb not null default '[]'::jsonb,
  add column if not exists worker_wages jsonb not null default '{}'::jsonb;

-- Backfill worker_ids from the legacy single-worker column.
update public.farm_tasks
set worker_ids = jsonb_build_array(worker_id)
where worker_id is not null
  and (worker_ids is null or worker_ids = '[]'::jsonb);


-- ===== 20260809000007_ensure_profile.sql =====
-- Re-provision a profile row on sign-in when it is missing.
--
-- After a database reset (or manual wipe of public.profiles), existing auth
-- users have no profile row. The signup trigger only fires on NEW sign-ups,
-- so those users get locked out. This security-definer function recreates the
-- row on login â€” mirroring handle_new_user (seed farm attach + first-account
-- becomes super-admin) â€” so sign-in is self-healing.

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

-- ===== 20260809000008_ensure_profile_idempotent.sql =====
-- Make ensure_profile idempotent under concurrent sign-in.
--
-- On login, applySession can run twice (getSession() + onAuthStateChange
-- SIGNED_IN). Both used to call ensure_profile, and the second call raced the
-- first INSERT â†’ "duplicate key value violates unique constraint profiles_pkey".
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

-- ===== 20260809000009_task_advances.sql =====
-- Salary advances on tasks.
--
-- Workers may receive part of their wage up front ("avance"). Track that per
-- worker so the salary expense recorded for the task can be the NET amount
-- (wage - advance), while the advance itself is recorded as its own expense
-- ("Avance Salaire") when it is given.

alter table public.farm_tasks
  add column if not exists worker_advances jsonb not null default '{}'::jsonb,
  add column if not exists advance_amount numeric not null default 0;

-- ===== 20260816000010_auth_events.sql =====
-- Auth activity log: record every user login/logout so super admins can
-- review who was in the platform and when.
create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text not null default '',
  user_name text not null default '',
  farm_id uuid references public.farms (id) on delete set null,
  event_type text not null check (event_type in ('login', 'logout')),
  created_at timestamptz not null default now()
);

alter table public.auth_events enable row level security;

-- Anyone may INSERT a login/logout event (fire-and-forget reporting from the client).
drop policy if exists "auth_events_insert" on public.auth_events;
create policy "auth_events_insert" on public.auth_events
  for insert with check (true);

-- Only super admins may read the activity log.
drop policy if exists "auth_events_select_superadmin" on public.auth_events;
create policy "auth_events_select_superadmin" on public.auth_events
  for select using (public.is_super_admin());

-- Insert a single auth event. Security-definer so any authenticated client can
-- report its own login/logout regardless of RLS on the table.
create or replace function public.record_auth_event(
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_farm_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.auth_events (user_id, user_email, user_name, farm_id, event_type)
  values (p_user_id, p_user_email, p_user_name, p_farm_id, p_event_type);
end;
$$;

grant execute on function public.record_auth_event(uuid, text, text, uuid, text) to authenticated;

-- Super-admin read API.
create or replace function public.admin_list_auth_events(p_limit integer default 100)
returns table (
  id uuid,
  user_email text,
  user_name text,
  farm_name text,
  event_type text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.user_email, e.user_name, f.name as farm_name, e.event_type, e.created_at
  from public.auth_events e
  left join public.farms f on f.id = e.farm_id
  where public.is_super_admin()
  order by e.created_at desc
  limit greatest(1, p_limit);
$$;

grant execute on function public.admin_list_auth_events(integer) to authenticated;


-- ===== 20260831000011_pin_auth.sql =====
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
-- the `extensions` schema, which is NOT on the default search_path â€” so the
-- functions below MUST include it explicitly.
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists pin text;

-- The PIN doubles as the Supabase account password so that sign-in creates a
-- real session (auth.uid()) and RLS lets the app read the user's data. This
-- function is no longer used by the app â€” sign-in is supabase.auth password
-- auth with the PIN â€” but it is kept for reference. Drop it to keep things tidy.
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


-- ===== 20260902000012_rls_role_permissions.sql =====
-- ---------------------------------------------------------------------------
-- Role-based access on the DATABASE (RBAC). Fully idempotent â€” safe to
-- re-run even if partially applied.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

-- ------------------------------------------------------------------
-- role_permissions table + seed data
-- ------------------------------------------------------------------
create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'manager', 'worker')),
  resource text not null,
  action text not null check (action in ('view', 'create', 'edit', 'delete', 'manage_system')),
  primary key (role, resource, action)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select" on public.role_permissions
  for select using (auth.role() = 'authenticated');

insert into public.role_permissions (role, resource, action)
select r.role, r.resource, r.action
from (values
  ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
  ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
  ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
  ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
  ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
  ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
  ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
  ('manager','financials','view'),('manager','financials','create'),('manager','financials','edit'),('manager','financials','delete'),
  ('manager','investments','view'),('manager','investments','create'),('manager','investments','edit'),('manager','investments','delete'),
  ('manager','profile','view'),('manager','profile','edit'),
  ('manager','dashboard','view'),
  ('worker','farms','view'),
  ('worker','plots','view'),
  ('worker','crops','view'),
  ('worker','inventory','view'),
  ('worker','tasks','view'),('worker','tasks','edit'),
  ('worker','profile','view'),
  ('worker','dashboard','view')
) as r(role, resource, action)
on conflict (role, resource, action) do nothing;

-- ------------------------------------------------------------------
-- has_permission / my_farm_role functions
-- ------------------------------------------------------------------
create or replace function public.has_permission(p_role text, p_resource text, p_action text)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    when p_role is null then false
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = p_role and rp.resource = p_resource and rp.action = p_action
    )
  end;
$$;

create or replace function public.my_farm_role(p_farm_id uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select case
    when public.is_super_admin() then 'admin'
    else coalesce(
      (select role from public.user_farms where user_id = auth.uid() and farm_id = p_farm_id),
      (select role from public.profiles where id = auth.uid())
    )
  end;
$$;

grant execute on function public.has_permission(text, text, text) to authenticated;
grant execute on function public.my_farm_role(uuid) to authenticated;

-- ------------------------------------------------------------------
-- Tenant table RLS policies (drop old, create new â€” idempotent)
-- ------------------------------------------------------------------

-- farms
drop policy if exists "farms_select_own" on public.farms;
drop policy if exists "farms_insert_own" on public.farms;
drop policy if exists "farms_update_own" on public.farms;
drop policy if exists "farms_delete_own" on public.farms;
drop policy if exists "farms_select_role" on public.farms;
drop policy if exists "farms_insert_role" on public.farms;
drop policy if exists "farms_update_role" on public.farms;
drop policy if exists "farms_delete_role" on public.farms;
create policy "farms_select_role" on public.farms
  for select using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'view'));
create policy "farms_insert_role" on public.farms
  for insert with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'create'));
create policy "farms_update_role" on public.farms
  for update using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'))
  with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'));
create policy "farms_delete_role" on public.farms
  for delete using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'delete'));

-- plots
drop policy if exists "plots_select_own" on public.plots;
drop policy if exists "plots_insert_own" on public.plots;
drop policy if exists "plots_update_own" on public.plots;
drop policy if exists "plots_delete_own" on public.plots;
drop policy if exists "plots_select_role" on public.plots;
drop policy if exists "plots_insert_role" on public.plots;
drop policy if exists "plots_update_role" on public.plots;
drop policy if exists "plots_delete_role" on public.plots;
create policy "plots_select_role" on public.plots
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'view'));
create policy "plots_insert_role" on public.plots
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'create'));
create policy "plots_update_role" on public.plots
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'));
create policy "plots_delete_role" on public.plots
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'delete'));

-- crop_cycles (scoped via plot_id -> plots.farm_id)
drop policy if exists "crops_select_own" on public.crop_cycles;
drop policy if exists "crops_insert_own" on public.crop_cycles;
drop policy if exists "crops_update_own" on public.crop_cycles;
drop policy if exists "crops_delete_own" on public.crop_cycles;
drop policy if exists "crops_select_role" on public.crop_cycles;
drop policy if exists "crops_insert_role" on public.crop_cycles;
drop policy if exists "crops_update_role" on public.crop_cycles;
drop policy if exists "crops_delete_role" on public.crop_cycles;
create policy "crops_select_role" on public.crop_cycles
  for select using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'view'));
create policy "crops_insert_role" on public.crop_cycles
  for insert with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'create'));
create policy "crops_update_role" on public.crop_cycles
  for update using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'))
  with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'));
create policy "crops_delete_role" on public.crop_cycles
  for delete using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'delete'));

-- contacts (farm_id optional)
drop policy if exists "contacts_select_own" on public.contacts;
drop policy if exists "contacts_insert_own" on public.contacts;
drop policy if exists "contacts_update_own" on public.contacts;
drop policy if exists "contacts_delete_own" on public.contacts;
drop policy if exists "contacts_select_role" on public.contacts;
drop policy if exists "contacts_insert_role" on public.contacts;
drop policy if exists "contacts_update_role" on public.contacts;
drop policy if exists "contacts_delete_role" on public.contacts;
create policy "contacts_select_role" on public.contacts
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'view'));
create policy "contacts_insert_role" on public.contacts
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'create'));
create policy "contacts_update_role" on public.contacts
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'));
create policy "contacts_delete_role" on public.contacts
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'delete'));

-- inventory_items
drop policy if exists "inventory_select_own" on public.inventory_items;
drop policy if exists "inventory_insert_own" on public.inventory_items;
drop policy if exists "inventory_update_own" on public.inventory_items;
drop policy if exists "inventory_delete_own" on public.inventory_items;
drop policy if exists "inventory_select_role" on public.inventory_items;
drop policy if exists "inventory_insert_role" on public.inventory_items;
drop policy if exists "inventory_update_role" on public.inventory_items;
drop policy if exists "inventory_delete_role" on public.inventory_items;
create policy "inventory_select_role" on public.inventory_items
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'view'));
create policy "inventory_insert_role" on public.inventory_items
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'create'));
create policy "inventory_update_role" on public.inventory_items
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'));
create policy "inventory_delete_role" on public.inventory_items
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'delete'));

-- workers
drop policy if exists "workers_select_own" on public.workers;
drop policy if exists "workers_insert_own" on public.workers;
drop policy if exists "workers_update_own" on public.workers;
drop policy if exists "workers_delete_own" on public.workers;
drop policy if exists "workers_select_role" on public.workers;
drop policy if exists "workers_insert_role" on public.workers;
drop policy if exists "workers_update_role" on public.workers;
drop policy if exists "workers_delete_role" on public.workers;
create policy "workers_select_role" on public.workers
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'view'));
create policy "workers_insert_role" on public.workers
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'create'));
create policy "workers_update_role" on public.workers
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'));
create policy "workers_delete_role" on public.workers
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'delete'));

-- farm_tasks
drop policy if exists "tasks_select_own" on public.farm_tasks;
drop policy if exists "tasks_insert_own" on public.farm_tasks;
drop policy if exists "tasks_update_own" on public.farm_tasks;
drop policy if exists "tasks_delete_own" on public.farm_tasks;
drop policy if exists "tasks_select_role" on public.farm_tasks;
drop policy if exists "tasks_insert_role" on public.farm_tasks;
drop policy if exists "tasks_update_role" on public.farm_tasks;
drop policy if exists "tasks_delete_role" on public.farm_tasks;
create policy "tasks_select_role" on public.farm_tasks
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'view'));
create policy "tasks_insert_role" on public.farm_tasks
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'create'));
create policy "tasks_update_role" on public.farm_tasks
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'));
create policy "tasks_delete_role" on public.farm_tasks
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'delete'));

-- financial_records
drop policy if exists "financials_select_own" on public.financial_records;
drop policy if exists "financials_insert_own" on public.financial_records;
drop policy if exists "financials_update_own" on public.financial_records;
drop policy if exists "financials_delete_own" on public.financial_records;
drop policy if exists "financials_select_role" on public.financial_records;
drop policy if exists "financials_insert_role" on public.financial_records;
drop policy if exists "financials_update_role" on public.financial_records;
drop policy if exists "financials_delete_role" on public.financial_records;
create policy "financials_select_role" on public.financial_records
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'view'));
create policy "financials_insert_role" on public.financial_records
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'create'));
create policy "financials_update_role" on public.financial_records
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'));
create policy "financials_delete_role" on public.financial_records
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'delete'));

-- investments (farm_id optional)
drop policy if exists "investments_select_own" on public.investments;
drop policy if exists "investments_insert_own" on public.investments;
drop policy if exists "investments_update_own" on public.investments;
drop policy if exists "investments_delete_own" on public.investments;
drop policy if exists "investments_select_role" on public.investments;
drop policy if exists "investments_insert_role" on public.investments;
drop policy if exists "investments_update_role" on public.investments;
drop policy if exists "investments_delete_role" on public.investments;
create policy "investments_select_role" on public.investments
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'view'));
create policy "investments_insert_role" on public.investments
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'create'));
create policy "investments_update_role" on public.investments
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'));
create policy "investments_delete_role" on public.investments
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'delete'));


-- ===== 20260902000013_active_farm_and_permission_admin.sql =====
-- ---------------------------------------------------------------------------
-- Active-farm switching + SaaS-admin permission editor. Fully idempotent.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

-- set_active_farm
create or replace function public.set_active_farm(p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_farms
    where user_id = auth.uid() and farm_id = p_farm_id
  ) then
    return false;
  end if;
  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.set_active_farm(uuid) to authenticated;

-- admin_list_permissions (table return for PostgREST compatibility)
create or replace function public.admin_list_permissions()
returns table(role text, resource text, action text)
language sql
stable
security definer set search_path = public
as $$
  select rp.role, rp.resource, rp.action
  from public.role_permissions rp
  where public.is_super_admin()
$$;

-- admin_set_permission
create or replace function public.admin_set_permission(
  p_role text,
  p_resource text,
  p_action text,
  p_allowed boolean
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
  if p_role = 'admin' then
    raise exception 'admin permissions are implicit';
  end if;
  if p_allowed then
    insert into public.role_permissions (role, resource, action)
    values (p_role, p_resource, p_action)
    on conflict (role, resource, action) do nothing;
  else
    delete from public.role_permissions
    where role = p_role and resource = p_resource and action = p_action;
  end if;
end;
$$;

-- admin_reset_permissions
create or replace function public.admin_reset_permissions()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.role_permissions where role in ('manager', 'worker');
  insert into public.role_permissions (role, resource, action)
  select r.role, r.resource, r.action
  from (values
    ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
    ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
    ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
    ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
    ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
    ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
    ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
    ('manager','financials','view'),('manager','financials','create'),('manager','financials','edit'),('manager','financials','delete'),
    ('manager','investments','view'),('manager','investments','create'),('manager','investments','edit'),('manager','investments','delete'),
    ('manager','profile','view'),('manager','profile','edit'),
    ('manager','dashboard','view'),
    ('worker','farms','view'),
    ('worker','plots','view'),
    ('worker','crops','view'),
    ('worker','inventory','view'),
    ('worker','tasks','view'),('worker','tasks','edit'),
    ('worker','profile','view'),
    ('worker','dashboard','view')
  ) as r(role, resource, action)
  on conflict (role, resource, action) do nothing;
end;
$$;

grant execute on function public.admin_list_permissions() to authenticated;
grant execute on function public.admin_set_permission(text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_permissions() to authenticated;


-- ===== 20260903000001_fix_rls_and_rpc_compat.sql =====
-- ---------------------------------------------------------------------------
-- Fix 1: admin_list_permissions return type
-- `returns setof` causes PostgREST / supabase-js to return no data
-- (silent empty array). Change to `returns table(...)` for compatibility.
--
-- Fix 2: admin_set_permission / admin_reset_permissions are void-returning
-- PL/pgSQL functions. PostgREST can return an empty body for void functions,
-- but supabase-js expects a 200 with data. No code change needed here;
-- the issue is purely on the list function.
-- ---------------------------------------------------------------------------

SET check_function_bodies = false;

-- Replace the setof-returning version with a table-returning one.
create or replace function public.admin_list_permissions()
returns table(role text, resource text, action text)
language sql
stable
security definer set search_path = public
as $$
  select rp.role, rp.resource, rp.action
  from public.role_permissions rp
  where public.is_super_admin()
$$;


-- ===== 20260903000002_combined_idempotent_rbac.sql =====
-- ============================================================================
-- COMBINED IDEMPOTENT MIGRATION â€” paste into Supabase SQL Editor
-- Safe to re-run. Covers: migrations 12 + 13 + 14 in one shot.
-- ============================================================================

SET check_function_bodies = false;

-- ============================================================================
-- STEP 1: role_permissions table + seed data + helper functions
-- ============================================================================

create table if not exists public.role_permissions (
  role text not null check (role in ('admin', 'manager', 'worker')),
  resource text not null,
  action text not null check (action in ('view', 'create', 'edit', 'delete', 'manage_system')),
  primary key (role, resource, action)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select" on public.role_permissions
  for select using (auth.role() = 'authenticated');

insert into public.role_permissions (role, resource, action)
select r.role, r.resource, r.action
from (values
  ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
  ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
  ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
  ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
  ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
  ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
  ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
  ('manager','financials','view'),('manager','financials','create'),('manager','financials','edit'),('manager','financials','delete'),
  ('manager','investments','view'),('manager','investments','create'),('manager','investments','edit'),('manager','investments','delete'),
  ('manager','profile','view'),('manager','profile','edit'),
  ('manager','dashboard','view'),
  ('worker','farms','view'),
  ('worker','plots','view'),
  ('worker','crops','view'),
  ('worker','inventory','view'),
  ('worker','tasks','view'),('worker','tasks','edit'),
  ('worker','profile','view'),
  ('worker','dashboard','view')
) as r(role, resource, action)
on conflict (role, resource, action) do nothing;

create or replace function public.has_permission(p_role text, p_resource text, p_action text)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    when p_role is null then false
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = p_role and rp.resource = p_resource and rp.action = p_action
    )
  end;
$$;

create or replace function public.my_farm_role(p_farm_id uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select case
    when public.is_super_admin() then 'admin'
    else coalesce(
      (select role from public.user_farms where user_id = auth.uid() and farm_id = p_farm_id),
      (select role from public.profiles where id = auth.uid())
    )
  end;
$$;

grant execute on function public.has_permission(text, text, text) to authenticated;
grant execute on function public.my_farm_role(uuid) to authenticated;

-- ============================================================================
-- STEP 2: Tenant table RLS policies (farms, plots, crops, contacts, inventory)
-- ============================================================================

drop policy if exists "farms_select_own" on public.farms;
drop policy if exists "farms_insert_own" on public.farms;
drop policy if exists "farms_update_own" on public.farms;
drop policy if exists "farms_delete_own" on public.farms;
drop policy if exists "farms_select_role" on public.farms;
drop policy if exists "farms_insert_role" on public.farms;
drop policy if exists "farms_update_role" on public.farms;
drop policy if exists "farms_delete_role" on public.farms;
create policy "farms_select_role" on public.farms
  for select using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'view'));
create policy "farms_insert_role" on public.farms
  for insert with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'create'));
create policy "farms_update_role" on public.farms
  for update using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'))
  with check (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'edit'));
create policy "farms_delete_role" on public.farms
  for delete using (id = public.current_farm_id() and public.has_permission(public.my_farm_role(id), 'farms', 'delete'));

drop policy if exists "plots_select_own" on public.plots;
drop policy if exists "plots_insert_own" on public.plots;
drop policy if exists "plots_update_own" on public.plots;
drop policy if exists "plots_delete_own" on public.plots;
drop policy if exists "plots_select_role" on public.plots;
drop policy if exists "plots_insert_role" on public.plots;
drop policy if exists "plots_update_role" on public.plots;
drop policy if exists "plots_delete_role" on public.plots;
create policy "plots_select_role" on public.plots
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'view'));
create policy "plots_insert_role" on public.plots
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'create'));
create policy "plots_update_role" on public.plots
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'edit'));
create policy "plots_delete_role" on public.plots
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'plots', 'delete'));

drop policy if exists "crops_select_own" on public.crop_cycles;
drop policy if exists "crops_insert_own" on public.crop_cycles;
drop policy if exists "crops_update_own" on public.crop_cycles;
drop policy if exists "crops_delete_own" on public.crop_cycles;
drop policy if exists "crops_select_role" on public.crop_cycles;
drop policy if exists "crops_insert_role" on public.crop_cycles;
drop policy if exists "crops_update_role" on public.crop_cycles;
drop policy if exists "crops_delete_role" on public.crop_cycles;
create policy "crops_select_role" on public.crop_cycles
  for select using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'view'));
create policy "crops_insert_role" on public.crop_cycles
  for insert with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'create'));
create policy "crops_update_role" on public.crop_cycles
  for update using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'))
  with check (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'));
create policy "crops_delete_role" on public.crop_cycles
  for delete using (
    plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'delete'));

drop policy if exists "contacts_select_own" on public.contacts;
drop policy if exists "contacts_insert_own" on public.contacts;
drop policy if exists "contacts_update_own" on public.contacts;
drop policy if exists "contacts_delete_own" on public.contacts;
drop policy if exists "contacts_select_role" on public.contacts;
drop policy if exists "contacts_insert_role" on public.contacts;
drop policy if exists "contacts_update_role" on public.contacts;
drop policy if exists "contacts_delete_role" on public.contacts;
create policy "contacts_select_role" on public.contacts
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'view'));
create policy "contacts_insert_role" on public.contacts
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'create'));
create policy "contacts_update_role" on public.contacts
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'edit'));
create policy "contacts_delete_role" on public.contacts
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'contacts', 'delete'));

drop policy if exists "inventory_select_own" on public.inventory_items;
drop policy if exists "inventory_insert_own" on public.inventory_items;
drop policy if exists "inventory_update_own" on public.inventory_items;
drop policy if exists "inventory_delete_own" on public.inventory_items;
drop policy if exists "inventory_select_role" on public.inventory_items;
drop policy if exists "inventory_insert_role" on public.inventory_items;
drop policy if exists "inventory_update_role" on public.inventory_items;
drop policy if exists "inventory_delete_role" on public.inventory_items;
create policy "inventory_select_role" on public.inventory_items
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'view'));
create policy "inventory_insert_role" on public.inventory_items
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'create'));
create policy "inventory_update_role" on public.inventory_items
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'edit'));
create policy "inventory_delete_role" on public.inventory_items
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'inventory', 'delete'));

-- ============================================================================
-- STEP 3: Tenant table RLS policies (workers, tasks, financials, investments)
-- ============================================================================

drop policy if exists "workers_select_own" on public.workers;
drop policy if exists "workers_insert_own" on public.workers;
drop policy if exists "workers_update_own" on public.workers;
drop policy if exists "workers_delete_own" on public.workers;
drop policy if exists "workers_select_role" on public.workers;
drop policy if exists "workers_insert_role" on public.workers;
drop policy if exists "workers_update_role" on public.workers;
drop policy if exists "workers_delete_role" on public.workers;
create policy "workers_select_role" on public.workers
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'view'));
create policy "workers_insert_role" on public.workers
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'create'));
create policy "workers_update_role" on public.workers
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'edit'));
create policy "workers_delete_role" on public.workers
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'workers', 'delete'));

drop policy if exists "tasks_select_own" on public.farm_tasks;
drop policy if exists "tasks_insert_own" on public.farm_tasks;
drop policy if exists "tasks_update_own" on public.farm_tasks;
drop policy if exists "tasks_delete_own" on public.farm_tasks;
drop policy if exists "tasks_select_role" on public.farm_tasks;
drop policy if exists "tasks_insert_role" on public.farm_tasks;
drop policy if exists "tasks_update_role" on public.farm_tasks;
drop policy if exists "tasks_delete_role" on public.farm_tasks;
create policy "tasks_select_role" on public.farm_tasks
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'view'));
create policy "tasks_insert_role" on public.farm_tasks
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'create'));
create policy "tasks_update_role" on public.farm_tasks
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'edit'));
create policy "tasks_delete_role" on public.farm_tasks
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'tasks', 'delete'));

drop policy if exists "financials_select_own" on public.financial_records;
drop policy if exists "financials_insert_own" on public.financial_records;
drop policy if exists "financials_update_own" on public.financial_records;
drop policy if exists "financials_delete_own" on public.financial_records;
drop policy if exists "financials_select_role" on public.financial_records;
drop policy if exists "financials_insert_role" on public.financial_records;
drop policy if exists "financials_update_role" on public.financial_records;
drop policy if exists "financials_delete_role" on public.financial_records;
create policy "financials_select_role" on public.financial_records
  for select using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'view'));
create policy "financials_insert_role" on public.financial_records
  for insert with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'create'));
create policy "financials_update_role" on public.financial_records
  for update using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'))
  with check (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'edit'));
create policy "financials_delete_role" on public.financial_records
  for delete using (farm_id = public.current_farm_id() and public.has_permission(public.my_farm_role(farm_id), 'financials', 'delete'));

drop policy if exists "investments_select_own" on public.investments;
drop policy if exists "investments_insert_own" on public.investments;
drop policy if exists "investments_update_own" on public.investments;
drop policy if exists "investments_delete_own" on public.investments;
drop policy if exists "investments_select_role" on public.investments;
drop policy if exists "investments_insert_role" on public.investments;
drop policy if exists "investments_update_role" on public.investments;
drop policy if exists "investments_delete_role" on public.investments;
create policy "investments_select_role" on public.investments
  for select using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'view'));
create policy "investments_insert_role" on public.investments
  for insert with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'create'));
create policy "investments_update_role" on public.investments
  for update using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'))
  with check (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'edit'));
create policy "investments_delete_role" on public.investments
  for delete using (
    coalesce(farm_id, public.current_farm_id()) = public.current_farm_id()
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'investments', 'delete'));

-- ============================================================================
-- STEP 4: set_active_farm + admin permission RPCs
-- ============================================================================

create or replace function public.set_active_farm(p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_farms
    where user_id = auth.uid() and farm_id = p_farm_id
  ) then
    return false;
  end if;
  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.set_active_farm(uuid) to authenticated;

create or replace function public.admin_list_permissions()
returns table(role text, resource text, action text)
language sql
stable
security definer set search_path = public
as $$
  select rp.role, rp.resource, rp.action
  from public.role_permissions rp
  where public.is_super_admin()
$$;

create or replace function public.admin_set_permission(
  p_role text,
  p_resource text,
  p_action text,
  p_allowed boolean
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
  if p_role = 'admin' then
    raise exception 'admin permissions are implicit';
  end if;
  if p_allowed then
    insert into public.role_permissions (role, resource, action)
    values (p_role, p_resource, p_action)
    on conflict (role, resource, action) do nothing;
  else
    delete from public.role_permissions
    where role = p_role and resource = p_resource and action = p_action;
  end if;
end;
$$;

create or replace function public.admin_reset_permissions()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.role_permissions where role in ('manager', 'worker');
  insert into public.role_permissions (role, resource, action)
  select r.role, r.resource, r.action
  from (values
    ('manager','farms','view'),('manager','farms','create'),('manager','farms','edit'),('manager','farms','delete'),
    ('manager','plots','view'),('manager','plots','create'),('manager','plots','edit'),('manager','plots','delete'),
    ('manager','crops','view'),('manager','crops','create'),('manager','crops','edit'),('manager','crops','delete'),
    ('manager','inventory','view'),('manager','inventory','create'),('manager','inventory','edit'),('manager','inventory','delete'),
    ('manager','workers','view'),('manager','workers','create'),('manager','workers','edit'),('manager','workers','delete'),
    ('manager','tasks','view'),('manager','tasks','create'),('manager','tasks','edit'),('manager','tasks','delete'),
    ('manager','contacts','view'),('manager','contacts','create'),('manager','contacts','edit'),('manager','contacts','delete'),
    ('manager','financials','view'),('manager','financials','create'),('manager','financials','edit'),('manager','financials','delete'),
    ('manager','investments','view'),('manager','investments','create'),('manager','investments','edit'),('manager','investments','delete'),
    ('manager','profile','view'),('manager','profile','edit'),
    ('manager','dashboard','view'),
    ('worker','farms','view'),
    ('worker','plots','view'),
    ('worker','crops','view'),
    ('worker','inventory','view'),
    ('worker','tasks','view'),('worker','tasks','edit'),
    ('worker','profile','view'),
    ('worker','dashboard','view')
  ) as r(role, resource, action)
  on conflict (role, resource, action) do nothing;
end;
$$;

grant execute on function public.admin_list_permissions() to authenticated;
grant execute on function public.admin_set_permission(text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_permissions() to authenticated;

-- ============================================================================
-- STEP 5: bootstrap_user_farm â€” breaks the RLS deadlock for new users
-- ============================================================================

create or replace function public.bootstrap_user_farm(p_user_id uuid, p_farm_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.farms (id, name, location, size_in_hectares, description)
  values (p_farm_id, 'Ma ferme', '', 0, '')
  on conflict (id) do nothing;

  insert into public.user_farms (user_id, farm_id, role)
  values (p_user_id, p_farm_id, 'admin')
  on conflict (user_id, farm_id) do nothing;

  update public.profiles
  set farm_id = p_farm_id, updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.bootstrap_user_farm(uuid, uuid) to authenticated;

-- ============================================================================
-- DONE. If you see "Success", all migrations are applied.
-- ============================================================================


-- ===== 20260903000003_bootstrap_user_farm.sql =====
-- ---------------------------------------------------------------------------
-- bootstrap_user_farm: security-definer function that breaks the chicken-and-egg
-- RLS deadlock during first login.
--
-- When a user registers via PIN, handle_new_user creates a profile with
-- farm_id = NULL. Then activateFarm needs to:
--   1. Create the seed farm       â†’ blocked because farms INSERT requires current_farm_id()
--   2. Add user to user_farms     â†’ blocked because the farm doesn't exist yet
--   3. Set profiles.farm_id       â†’ blocked because user_farms membership is missing
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


-- ===== 20260905000014_crop_yield_unit.sql =====
-- Crop yield units: RÃ©gimes (bunch), Sacs (bag).
alter table public.crop_cycles
  add column if not exists yield_unit text not null default 'bunch'
  check (yield_unit in ('bunch', 'bag'));

-- ===== 20260905000016_harvests.sql =====
-- Multiple harvest batches per crop cycle (e.g. cocoa picked weekly,
-- tomato over weeks, plantain whole window). Scoped via
-- crop_cycle_id -> crop_cycles.plot_id -> plots.farm_id.
create table if not exists public.harvests (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.crop_cycles (id) on delete cascade,
  harvest_date date not null default current_date,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 'bunch' check (unit in ('bunch', 'bag')),
  revenue_fcfa numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.harvests enable row level security;

drop policy if exists "harvests_select_role" on public.harvests;
drop policy if exists "harvests_insert_role" on public.harvests;
drop policy if exists "harvests_update_role" on public.harvests;
drop policy if exists "harvests_delete_role" on public.harvests;

create policy "harvests_select_role" on public.harvests
  for select using (
    crop_cycle_id in (
      select cc.id from public.crop_cycles cc
      where cc.plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    )
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'view'));

create policy "harvests_insert_role" on public.harvests
  for insert with check (
    crop_cycle_id in (
      select cc.id from public.crop_cycles cc
      where cc.plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    )
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'create'));

create policy "harvests_update_role" on public.harvests
  for update using (
    crop_cycle_id in (
      select cc.id from public.crop_cycles cc
      where cc.plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    )
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'))
  with check (
    crop_cycle_id in (
      select cc.id from public.crop_cycles cc
      where cc.plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    )
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'edit'));

create policy "harvests_delete_role" on public.harvests
  for delete using (
    crop_cycle_id in (
      select cc.id from public.crop_cycles cc
      where cc.plot_id in (select id from public.plots where farm_id = public.current_farm_id())
    )
    and public.has_permission(public.my_farm_role(public.current_farm_id()), 'crops', 'delete'));

-- ===== 20260911000001_financial_records_investment_type.sql =====
-- Allow investor cash injections in the financial ledger.
-- The 'investment' type is cash coming IN (investor capital), counted in
-- cash balance / net cash flow but excluded from income (recettes) and profit.

alter table public.financial_records
  drop constraint if exists financial_records_type_check;

alter table public.financial_records
  add constraint financial_records_type_check
  check (type in ('income', 'expense', 'investment'));

-- ===== 20260911000002_rbac_manager_financials.sql =====
-- Patch: grant manager full CRUD on financials + investments.
-- The original RBAC seed only granted 'view' to manager for these two resources,
-- which blocked upserts and caused "Ã‰chec de synchronisation" in the app.

-- Remove the view-only rows so ON CONFLICT doesn't silently no-op.
delete from public.role_permissions
where role = 'manager'
  and resource in ('financials', 'investments')
  and action = 'view';

-- Insert full CRUD permissions.
insert into public.role_permissions (role, resource, action)
values
  ('manager', 'financials', 'view'),
  ('manager', 'financials', 'create'),
  ('manager', 'financials', 'edit'),
  ('manager', 'financials', 'delete'),
  ('manager', 'investments', 'view'),
  ('manager', 'investments', 'create'),
  ('manager', 'investments', 'edit'),
  ('manager', 'investments', 'delete')
on conflict (role, resource, action) do nothing;

-- ===== 20260911000003_task_advance_batches.sql =====
-- Multiple dated advance batches per task.
--
-- Workers may receive several advances on different dates. Each batch is a
-- JSON object { id, date, amounts: { worker_id: amount } } stored in the
-- new advance_batches column. advance_amount (total) and worker_advances
-- (per-worker total) stay as derived running totals for backward compat.

alter table public.farm_tasks
  add column if not exists advance_batches jsonb not null default '[]'::jsonb;

-- Backfill batches from the legacy per-worker advances for existing tasks.
update public.farm_tasks
set advance_batches = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-' || id::text,
    'date', coalesce(nullif(assigned_date::text, ''), current_date::text),
    'amounts', case
      when worker_advances is not null and worker_advances <> '{}'::jsonb
        then worker_advances
      else jsonb_build_object(coalesce(worker_id::text, ''), advance_amount)
    end
  )
)
where advance_batches = '[]'::jsonb
  and advance_amount > 0;

-- ===== 20261009000001_financial_records_crop_cycle_link.sql =====
-- Add crop_cycle_id link to financial_records for harvest revenue sync
-- ------------------------------------------------------------------
alter table public.financial_records
  add column if not exists crop_cycle_id uuid references public.crop_cycles (id) on delete set null;

-- ------------------------------------------------------------------

-- ===== 20261009000002_auth_events_geoip.sql =====
-- Add geo-location tracking to auth_events
-- ------------------------------------------------------------------
alter table public.auth_events
  add column if not exists ip_address inet,
  add column if not exists country_code char(2),
  add column if not exists country_name text;

-- Update record_auth_event to accept IP and country
create or replace function public.record_auth_event(
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_farm_id uuid,
  p_event_type text,
  p_ip_address inet default null,
  p_country_code char(2) default null,
  p_country_name text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.auth_events (user_id, user_email, user_name, farm_id, event_type, ip_address, country_code, country_name)
  values (p_user_id, p_user_email, p_user_name, p_farm_id, p_event_type, p_ip_address, p_country_code, p_country_name);
end;
$$;

grant execute on function public.record_auth_event(uuid, text, text, uuid, text, inet, char(2), text) to authenticated;

-- Update admin_list_auth_events to return geo fields
drop function if exists public.admin_list_auth_events(integer);

create function public.admin_list_auth_events(p_limit integer default 100)
returns table (
  id uuid,
  user_email text,
  user_name text,
  farm_name text,
  event_type text,
  ip_address inet,
  country_code char(2),
  country_name text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.user_email, e.user_name, f.name as farm_name, e.event_type,
         e.ip_address, e.country_code, e.country_name, e.created_at
  from public.auth_events e
  left join public.farms f on f.id = e.farm_id
  where public.is_super_admin()
  order by e.created_at desc
  limit greatest(1, p_limit);
$$;

grant execute on function public.admin_list_auth_events(integer) to authenticated;
-- ------------------------------------------------------------------


