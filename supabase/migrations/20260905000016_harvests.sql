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