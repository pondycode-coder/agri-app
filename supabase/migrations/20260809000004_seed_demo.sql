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
    'Bafoussam, Région de l''Ouest',
    3,
    18.5,
    'Exploitation mixte café, cacao et cultures maraîchères dans les Hauts-Plateaux.'
  );

  -- ---------------------------------------------------------------
  -- plots
  -- ---------------------------------------------------------------
  insert into public.plots (id, farm_id, name, size_in_hectares, soil_type, status) values
    ('00000000-0000-4000-8000-000000000101', v_farm, 'Parcelle A - Cacao & Café Arabica', 6.5, 'Volcanique', 'active'),
    ('00000000-0000-4000-8000-000000000102', v_farm, 'Parcelle B - Maraîchage & Tomate',    4.0, 'Ferrallitique', 'active'),
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
     'Campagne Maraîchère Bafoussam', '2024-11-01', '2025-02-28', '2025-02-25', 8500, 'harvested', 600000, 2550000),
    ('00000000-0000-4000-8000-000000000203',
     '00000000-0000-4000-8000-000000000103', 'Plantain', 'Batard / Big Ebanga',
     'Saison 2024', '2024-05-10', '2025-06-15', null, null, 'planted', 450000, 1800000);

  -- ---------------------------------------------------------------
  -- contacts
  -- ---------------------------------------------------------------
  insert into public.contacts (id, name, type, phone, email, address, farm_id, notes) values
    ('00000000-0000-4000-8000-000000000301',
     'Société Coopérative des Planteurs du Mungo (SOCOPMU)', 'customer',
     '+237 6 99 12 34 56', 'achats@socopmu.cm', 'Kumba - Penja Highway, Région du Sud-Ouest', v_farm,
     'Acheteur principal de fèves de cacao marchandes certifiées.'),
    ('00000000-0000-4000-8000-000000000302',
     'AgriTech Group SARL (Engrais & Intrants)', 'supplier',
     '+237 6 77 88 99 00', 'contact@agritech.cm', 'Bastos, Yaoundé', v_farm,
     'Fournisseur d''engrais NPK 20-10-10 et pulvérisateurs.');

  -- ---------------------------------------------------------------
  -- inventory_items
  -- ---------------------------------------------------------------
  insert into public.inventory_items
    (id, farm_id, name, category, quantity, unit, price_per_unit, supplier_id, expiry_date)
  values
    ('00000000-0000-4000-8000-000000000401', v_farm, 'Engrais NPK 20-10-10 (Sacs 50kg)',
     'input', 35, 'sacs', 28500, '00000000-0000-4000-8000-000000000302', '2026-12-31'),
    ('00000000-0000-4000-8000-000000000402', v_farm, 'Fungicide Nordox 75 WG (Antifongique Cacao)',
     'pesticide', 8, 'boîtes 1kg', 14500, '00000000-0000-4000-8000-000000000302', '2025-08-15'),
    ('00000000-0000-4000-8000-000000000403', v_farm, 'Pulvérisateur à Dos Solo 15L',
     'tool', 5, 'unités', 38000, '00000000-0000-4000-8000-000000000302', null),
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
     'Émondage et désherbage parcelle Cacao A',
     'Nettoyer les pieds de cacaoyers et éliminer les rejets parasitaires.',
     'in_progress', '2025-02-20', '2025-02-28', null, 12500,
     '{"00000000-0000-4000-8000-000000000501": 12500}'::jsonb, false,
     'Priorité avant le début des premières pluies.'),
    ('00000000-0000-4000-8000-000000000602', v_farm,
     '00000000-0000-4000-8000-000000000502', '["00000000-0000-4000-8000-000000000502"]'::jsonb,
     '00000000-0000-4000-8000-000000000101',
     'Traitement phytosanitaire fongicide Nordox',
     'Traitement préventif contre la pourriture brune des cabosses de cacao.',
     'pending', '2025-03-01', '2025-03-05', null, 6500,
     '{"00000000-0000-4000-8000-000000000502": 6500}'::jsonb, false, null),
    ('00000000-0000-4000-8000-000000000603', v_farm,
     '00000000-0000-4000-8000-000000000501',
     '["00000000-0000-4000-8000-000000000501","00000000-0000-4000-8000-000000000502","00000000-0000-4000-8000-000000000503"]'::jsonb,
     '00000000-0000-4000-8000-000000000102',
     'Récolte et conditionnement des tomates Cobra F1',
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
     'Vente récolte Tomates Cobra (170 cagettes)', 'Vente Récolte', null, 'orange_money',
     '00000000-0000-4000-8000-000000000301'),
    ('00000000-0000-4000-8000-000000000702', v_farm, 'expense', 427500, 'XAF', '2025-02-10',
     'Achat de 15 sacs engrais NPK 20-10-10', 'Achat Intrants', null, 'mtn_momo',
     '00000000-0000-4000-8000-000000000302'),
    ('00000000-0000-4000-8000-000000000703', v_farm, 'expense', 105000, 'XAF', '2025-02-24',
     'Paiement salaires hebdomadaires ouvriers agricoles', 'Salaires Ouvriers',
     '00000000-0000-4000-8000-000000000501', 'cash', null),
    ('00000000-0000-4000-8000-000000000704', v_farm, 'income', 4800000, 'XAF', '2024-11-15',
     'Vente 1.6 Tonnes de fèves de Cacao marchandes', 'Vente Récolte', null, 'bank_transfer',
     '00000000-0000-4000-8000-000000000301');

  -- ---------------------------------------------------------------
  -- investments
  -- ---------------------------------------------------------------
  insert into public.investments
    (id, farm_id, name, type, amount, date, description, expected_return, return_date, status)
  values
    ('00000000-0000-4000-8000-000000000801', v_farm,
     'Système d''Irrigation Goutte-à-Goutte Solaire', 'irrigation',
     3500000, '2024-09-10',
     'Installation de pompage solaire et tuyauterie pour la parcelle de tomate et maraîchage.',
     6000000, '2026-09-10', 'active'),
    ('00000000-0000-4000-8000-000000000802', v_farm,
     'Séchoir Solaire Hybride pour Cacao & Café', 'infrastructure',
     2200000, '2024-06-15',
     'Shed de séchage protégé améliorant la qualité marchandise du cacao (grade 1).',
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
