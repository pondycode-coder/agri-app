-- Add crop_cycle_id link to financial_records for harvest revenue sync
-- ------------------------------------------------------------------
alter table public.financial_records
  add column if not exists crop_cycle_id uuid references public.crop_cycles (id) on delete set null;

-- ------------------------------------------------------------------