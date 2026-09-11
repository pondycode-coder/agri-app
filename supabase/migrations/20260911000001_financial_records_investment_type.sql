-- Allow investor cash injections in the financial ledger.
-- The 'investment' type is cash coming IN (investor capital), counted in
-- cash balance / net cash flow but excluded from income (recettes) and profit.

alter table public.financial_records
  drop constraint if exists financial_records_type_check;

alter table public.financial_records
  add constraint financial_records_type_check
  check (type in ('income', 'expense', 'investment'));