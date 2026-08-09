export type AppRole = 'admin' | 'manager' | 'worker';

export interface Farm {
  id: string;
  name: string;
  location: string;
  plots: number;
  size_in_hectares: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: AppRole;
  farm_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  size_in_hectares: number;
  soil_type: string; // 'Volcanic', 'Ferrallitic', 'Clay', 'Sandy', 'Alluvial'
  status: 'active' | 'fallow' | 'preparing' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CropCycle {
  id: string;
  plot_id: string;
  crop_name: string; // 'Cocoa', 'Coffee', 'Maize', 'Cassava', 'Plantain', 'Oil Palm', 'Tomato'
  variety: string;
  season: string;
  planting_date: string;
  expected_harvest_date: string;
  actual_harvest_date?: string | null;
  yield_in_kg?: number | null;
  status: 'planted' | 'growing' | 'harvested' | 'failed';
  estimated_cost_fcfa: number;
  revenue_fcfa?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'partner';
  phone: string;
  email?: string;
  address?: string;
  farm_id?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'input' | 'pesticide' | 'tool' | 'equipment' | 'fuel' | 'packaging';
  quantity: number;
  unit: string; // 'kg', 'liters', 'bags', 'units', 'boxes'
  price_per_unit: number; // in FCFA
  farm_id: string;
  supplier_id?: string | null;
  expiry_date?: string | null;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  name: string;
  role: 'field_worker' | 'agronomist' | 'machine_operator' | 'supervisor';
  phone_number: string;
  daily_wage: number; // in FCFA
  farm_id: string;
  is_active: boolean;
  total_tasks_completed: number;
  productivity_score: number; // 1 to 5 or percentage
  created_at: string;
  updated_at: string;
}

export interface FarmTask {
  id: string;
  worker_id?: string | null;
  title: string;
  description?: string;
  farm_id: string;
  plot_id?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_date: string;
  due_date: string;
  completed_date?: string | null;
  wage_amount?: number | null;
  wage_paid: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number; // in FCFA
  currency: 'XAF';
  date: string;
  description: string;
  category: string; // 'Crop Sales', 'Worker Wage', 'Fertilizer Purchase', 'Fuel', 'Equipment', 'Other'
  farm_id: string;
  worker_id?: string | null;
  task_id?: string | null;
  payment_method: 'cash' | 'orange_money' | 'mtn_momo' | 'bank_transfer';
  receipt_url?: string;
  related_contact_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  name: string;
  type: 'equipment' | 'infrastructure' | 'irrigation' | 'land' | 'other';
  amount: number; // in FCFA
  date: string;
  description?: string;
  farm_id?: string | null;
  expected_return?: number | null; // in FCFA
  return_date?: string | null;
  status: 'active' | 'matured' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/** Utility function to format monetary amounts in Cameroonian FCFA / XAF */
export function formatFCFA(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 FCFA';
  return new Intl.NumberFormat('fr-CM', {
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}
