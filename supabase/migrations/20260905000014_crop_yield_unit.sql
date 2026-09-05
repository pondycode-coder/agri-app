-- Crop yield units: Régimes (bunch), Sacs (bag).
alter table public.crop_cycles
  add column if not exists yield_unit text not null default 'bunch'
  check (yield_unit in ('bunch', 'bag'));