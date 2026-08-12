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
