-- Salary advances on tasks.
--
-- Workers may receive part of their wage up front ("avance"). Track that per
-- worker so the salary expense recorded for the task can be the NET amount
-- (wage - advance), while the advance itself is recorded as its own expense
-- ("Avance Salaire") when it is given.

alter table public.farm_tasks
  add column if not exists worker_advances jsonb not null default '{}'::jsonb,
  add column if not exists advance_amount numeric not null default 0;