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