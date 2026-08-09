import {
  Farm,
  Profile,
  Plot,
  CropCycle,
  Contact,
  InventoryItem,
  Worker,
  FarmTask,
  FinancialRecord,
  Investment,
} from '../types/database';
import {
  INITIAL_FARMS,
  INITIAL_PROFILES,
  INITIAL_PLOTS,
  INITIAL_CROP_CYCLES,
  INITIAL_CONTACTS,
  INITIAL_INVENTORY,
  INITIAL_WORKERS,
  INITIAL_TASKS,
  INITIAL_FINANCIALS,
  INITIAL_INVESTMENTS,
} from './mockData';

type Listener = () => void;

class LocalDatabaseStore {
  private listeners: Set<Listener> = new Set();

  private farms: Farm[] = [];
  private profiles: Profile[] = [];
  private plots: Plot[] = [];
  private cropCycles: CropCycle[] = [];
  private contacts: Contact[] = [];
  private inventory: InventoryItem[] = [];
  private workers: Worker[] = [];
  private tasks: FarmTask[] = [];
  private financials: FinancialRecord[] = [];
  private investments: Investment[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedFarms = localStorage.getItem('agri_farms');
      this.farms = storedFarms ? JSON.parse(storedFarms) : INITIAL_FARMS;

      const storedProfiles = localStorage.getItem('agri_profiles');
      this.profiles = storedProfiles ? JSON.parse(storedProfiles) : INITIAL_PROFILES;

      const storedPlots = localStorage.getItem('agri_plots');
      this.plots = storedPlots ? JSON.parse(storedPlots) : INITIAL_PLOTS;

      const storedCrops = localStorage.getItem('agri_crop_cycles');
      this.cropCycles = storedCrops ? JSON.parse(storedCrops) : INITIAL_CROP_CYCLES;

      const storedContacts = localStorage.getItem('agri_contacts');
      this.contacts = storedContacts ? JSON.parse(storedContacts) : INITIAL_CONTACTS;

      const storedInv = localStorage.getItem('agri_inventory');
      this.inventory = storedInv ? JSON.parse(storedInv) : INITIAL_INVENTORY;

      const storedWorkers = localStorage.getItem('agri_workers');
      this.workers = storedWorkers ? JSON.parse(storedWorkers) : INITIAL_WORKERS;

      const storedTasks = localStorage.getItem('agri_tasks');
      this.tasks = storedTasks ? JSON.parse(storedTasks) : INITIAL_TASKS;

      const storedFin = localStorage.getItem('agri_financials');
      this.financials = storedFin ? JSON.parse(storedFin) : INITIAL_FINANCIALS;

      const storedInvst = localStorage.getItem('agri_investments');
      this.investments = storedInvst ? JSON.parse(storedInvst) : INITIAL_INVESTMENTS;
    } catch (e) {
      console.error('Failed to parse AgriApp local storage', e);
      this.resetToDefaults();
    }
  }

  public resetToDefaults() {
    this.farms = [...INITIAL_FARMS];
    this.profiles = [...INITIAL_PROFILES];
    this.plots = [...INITIAL_PLOTS];
    this.cropCycles = [...INITIAL_CROP_CYCLES];
    this.contacts = [...INITIAL_CONTACTS];
    this.inventory = [...INITIAL_INVENTORY];
    this.workers = [...INITIAL_WORKERS];
    this.tasks = [...INITIAL_TASKS];
    this.financials = [...INITIAL_FINANCIALS];
    this.investments = [...INITIAL_INVESTMENTS];
    this.saveAll();
  }

  private saveAll() {
    localStorage.setItem('agri_farms', JSON.stringify(this.farms));
    localStorage.setItem('agri_profiles', JSON.stringify(this.profiles));
    localStorage.setItem('agri_plots', JSON.stringify(this.plots));
    localStorage.setItem('agri_crop_cycles', JSON.stringify(this.cropCycles));
    localStorage.setItem('agri_contacts', JSON.stringify(this.contacts));
    localStorage.setItem('agri_inventory', JSON.stringify(this.inventory));
    localStorage.setItem('agri_workers', JSON.stringify(this.workers));
    localStorage.setItem('agri_tasks', JSON.stringify(this.tasks));
    localStorage.setItem('agri_financials', JSON.stringify(this.financials));
    localStorage.setItem('agri_investments', JSON.stringify(this.investments));
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // --- FARMS ---
  public getFarms(): Farm[] { return [...this.farms]; }
  public saveFarm(farmData: Partial<Farm> & { id?: string }): Farm {
    const now = new Date().toISOString();
    if (farmData.id) {
      this.farms = this.farms.map((f) => f.id === farmData.id ? { ...f, ...farmData, updated_at: now } : f);
      const updated = this.farms.find((f) => f.id === farmData.id)!;
      this.saveAll();
      return updated;
    } else {
      const newFarm: Farm = {
        id: 'farm-' + Date.now(),
        name: farmData.name || 'Nouvelle Ferme',
        location: farmData.location || 'Cameroun',
        plots: farmData.plots || 0,
        size_in_hectares: farmData.size_in_hectares || 1,
        description: farmData.description || '',
        created_at: now,
        updated_at: now,
      };
      this.farms.push(newFarm);
      this.saveAll();
      return newFarm;
    }
  }
  public deleteFarm(id: string) {
    this.farms = this.farms.filter((f) => f.id !== id);
    this.saveAll();
  }

  // --- PROFILES ---
  public getProfiles(): Profile[] { return [...this.profiles]; }
  public saveProfile(profileData: Partial<Profile> & { id: string }): Profile {
    const now = new Date().toISOString();
    const existingIndex = this.profiles.findIndex((p) => p.id === profileData.id);
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = { ...this.profiles[existingIndex], ...profileData, updated_at: now };
    } else {
      const newProf: Profile = {
        id: profileData.id,
        email: profileData.email || '',
        name: profileData.name || 'Utilisateur Agri',
        role: profileData.role || 'worker',
        farm_id: profileData.farm_id || null,
        created_at: now,
        updated_at: now,
      };
      this.profiles.push(newProf);
    }
    this.saveAll();
    return this.profiles.find((p) => p.id === profileData.id)!;
  }

  // --- PLOTS ---
  public getPlots(farmId?: string): Plot[] {
    if (farmId) return this.plots.filter((p) => p.farm_id === farmId);
    return [...this.plots];
  }
  public savePlot(plotData: Partial<Plot> & { id?: string; farm_id: string }): Plot {
    const now = new Date().toISOString();
    if (plotData.id) {
      this.plots = this.plots.map((p) => p.id === plotData.id ? { ...p, ...plotData, updated_at: now } : p);
      this.saveAll();
      return this.plots.find((p) => p.id === plotData.id)!;
    } else {
      const newPlot: Plot = {
        id: 'plot-' + Date.now(),
        farm_id: plotData.farm_id,
        name: plotData.name || 'Nouvelle Parcelle',
        size_in_hectares: plotData.size_in_hectares || 1,
        soil_type: plotData.soil_type || 'Volcanique',
        status: plotData.status || 'active',
        created_at: now,
        updated_at: now,
      };
      this.plots.push(newPlot);
      // Update farm's plots count
      const farm = this.farms.find((f) => f.id === plotData.farm_id);
      if (farm) {
        farm.plots = this.plots.filter((p) => p.farm_id === farm.id).length;
      }
      this.saveAll();
      return newPlot;
    }
  }
  public deletePlot(id: string) {
    const plot = this.plots.find((p) => p.id === id);
    this.plots = this.plots.filter((p) => p.id !== id);
    if (plot) {
      const farm = this.farms.find((f) => f.id === plot.farm_id);
      if (farm) {
        farm.plots = this.plots.filter((p) => p.farm_id === farm.id).length;
      }
    }
    this.saveAll();
  }

  // --- CROP CYCLES ---
  public getCropCycles(): CropCycle[] { return [...this.cropCycles]; }
  public saveCropCycle(cropData: Partial<CropCycle> & { id?: string; plot_id: string }): CropCycle {
    const now = new Date().toISOString();
    if (cropData.id) {
      this.cropCycles = this.cropCycles.map((c) => c.id === cropData.id ? { ...c, ...cropData, updated_at: now } : c);
      this.saveAll();
      return this.cropCycles.find((c) => c.id === cropData.id)!;
    } else {
      const newCrop: CropCycle = {
        id: 'crop-' + Date.now(),
        plot_id: cropData.plot_id,
        crop_name: cropData.crop_name || 'Cacao',
        variety: cropData.variety || 'Hybride',
        season: cropData.season || 'Saison 2025',
        planting_date: cropData.planting_date || new Date().toISOString().split('T')[0],
        expected_harvest_date: cropData.expected_harvest_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        actual_harvest_date: cropData.actual_harvest_date,
        yield_in_kg: cropData.yield_in_kg,
        status: cropData.status || 'planted',
        estimated_cost_fcfa: cropData.estimated_cost_fcfa || 0,
        revenue_fcfa: cropData.revenue_fcfa || 0,
        created_at: now,
        updated_at: now,
      };
      this.cropCycles.push(newCrop);
      this.saveAll();
      return newCrop;
    }
  }
  public deleteCropCycle(id: string) {
    this.cropCycles = this.cropCycles.filter((c) => c.id !== id);
    this.saveAll();
  }

  // --- CONTACTS ---
  public getContacts(): Contact[] { return [...this.contacts]; }
  public saveContact(contactData: Partial<Contact> & { id?: string }): Contact {
    const now = new Date().toISOString();
    if (contactData.id) {
      this.contacts = this.contacts.map((c) => c.id === contactData.id ? { ...c, ...contactData, updated_at: now } : c);
      this.saveAll();
      return this.contacts.find((c) => c.id === contactData.id)!;
    } else {
      const newContact: Contact = {
        id: 'contact-' + Date.now(),
        name: contactData.name || 'Nouveau Contact',
        type: contactData.type || 'customer',
        phone: contactData.phone || '+237 600000000',
        email: contactData.email || '',
        address: contactData.address || '',
        farm_id: contactData.farm_id || null,
        notes: contactData.notes || '',
        created_at: now,
        updated_at: now,
      };
      this.contacts.push(newContact);
      this.saveAll();
      return newContact;
    }
  }
  public deleteContact(id: string) {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    this.saveAll();
  }

  // --- INVENTORY ---
  public getInventory(): InventoryItem[] { return [...this.inventory]; }
  public saveInventoryItem(invData: Partial<InventoryItem> & { id?: string; farm_id: string }): InventoryItem {
    const now = new Date().toISOString();
    if (invData.id) {
      this.inventory = this.inventory.map((i) => i.id === invData.id ? { ...i, ...invData, updated_at: now } : i);
      this.saveAll();
      return this.inventory.find((i) => i.id === invData.id)!;
    } else {
      const newItem: InventoryItem = {
        id: 'inv-' + Date.now(),
        name: invData.name || 'Article Intrant',
        category: invData.category || 'input',
        quantity: invData.quantity || 1,
        unit: invData.unit || 'sacs',
        price_per_unit: invData.price_per_unit || 0,
        farm_id: invData.farm_id,
        supplier_id: invData.supplier_id || null,
        expiry_date: invData.expiry_date || null,
        created_at: now,
        updated_at: now,
      };
      this.inventory.push(newItem);
      this.saveAll();
      return newItem;
    }
  }
  public deleteInventoryItem(id: string) {
    this.inventory = this.inventory.filter((i) => i.id !== id);
    this.saveAll();
  }

  // --- WORKERS ---
  public getWorkers(): Worker[] { return [...this.workers]; }
  public saveWorker(workerData: Partial<Worker> & { id?: string; farm_id: string }): Worker {
    const now = new Date().toISOString();
    if (workerData.id) {
      this.workers = this.workers.map((w) => w.id === workerData.id ? { ...w, ...workerData, updated_at: now } : w);
      this.saveAll();
      return this.workers.find((w) => w.id === workerData.id)!;
    } else {
      const newWorker: Worker = {
        id: 'wrk-' + Date.now(),
        name: workerData.name || 'Ouvrier Agricole',
        role: workerData.role || 'field_worker',
        phone_number: workerData.phone_number || '+237 600000000',
        daily_wage: workerData.daily_wage || 3500,
        farm_id: workerData.farm_id,
        is_active: workerData.is_active ?? true,
        total_tasks_completed: 0,
        productivity_score: 5.0,
        created_at: now,
        updated_at: now,
      };
      this.workers.push(newWorker);
      this.saveAll();
      return newWorker;
    }
  }
  public deleteWorker(id: string) {
    this.workers = this.workers.filter((w) => w.id !== id);
    this.saveAll();
  }

  // --- TASKS ---
  public getTasks(): FarmTask[] { return [...this.tasks]; }
  public saveTask(taskData: Partial<FarmTask> & { id?: string; farm_id: string }): FarmTask {
    const now = new Date().toISOString();
    const worker = taskData.worker_id ? this.workers.find((w) => w.id === taskData.worker_id) : undefined;
    const wageAmount = taskData.wage_amount ?? worker?.daily_wage ?? 0;
    let savedTask: FarmTask;
    if (taskData.id) {
      this.tasks = this.tasks.map((t) => t.id === taskData.id ? { ...t, ...taskData, wage_amount: wageAmount, updated_at: now } : t);
      savedTask = this.tasks.find((t) => t.id === taskData.id)!;
    } else {
      const newTask: FarmTask = {
        id: 'task-' + Date.now(),
        title: taskData.title || 'Tâche Agricole',
        description: taskData.description || '',
        farm_id: taskData.farm_id,
        plot_id: taskData.plot_id || null,
        worker_id: taskData.worker_id || null,
        status: taskData.status || 'pending',
        assigned_date: taskData.assigned_date || new Date().toISOString().split('T')[0],
        due_date: taskData.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        completed_date: taskData.status === 'completed' ? new Date().toISOString().split('T')[0] : null,
        wage_amount: wageAmount,
        wage_paid: taskData.wage_paid ?? false,
        notes: taskData.notes || '',
        created_at: now,
        updated_at: now,
      };
      this.tasks.push(newTask);
      savedTask = newTask;
    }
    this.syncWageExpense(savedTask);
    this.saveAll();
    return savedTask;
  }
  public deleteTask(id: string) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.financials = this.financials.filter((f) => f.task_id !== id);
    this.saveAll();
  }

  private syncWageExpense(task: FarmTask) {
    if (!task.worker_id || !task.wage_amount) return;
    const worker = this.workers.find((w) => w.id === task.worker_id);
    const wageAmount = task.wage_amount || worker?.daily_wage || 0;
    const existing = this.financials.find((f) => f.task_id === task.id);
    if (task.wage_paid && task.status !== 'cancelled') {
      if (existing) {
        this.financials = this.financials.map((f) => f.task_id === task.id ? { ...f, amount: wageAmount, updated_at: new Date().toISOString() } : f);
      } else {
        const now = new Date().toISOString();
        this.financials.push({
          id: 'fin-task-' + task.id,
          type: 'expense',
          amount: wageAmount,
          currency: 'XAF',
          date: task.completed_date || task.due_date || now.split('T')[0],
          description: `Salaire tâche: ${task.title}`,
          category: 'Salaires Ouvriers',
          farm_id: task.farm_id,
          worker_id: task.worker_id,
          task_id: task.id,
          payment_method: 'cash',
          created_at: now,
          updated_at: now,
        });
      }
    } else if (existing) {
      this.financials = this.financials.filter((f) => f.task_id !== task.id);
    }
  }

  // --- FINANCIALS ---
  public getFinancials(): FinancialRecord[] { return [...this.financials]; }
  public saveFinancialRecord(finData: Partial<FinancialRecord> & { id?: string; farm_id: string }): FinancialRecord {
    const now = new Date().toISOString();
    if (finData.id) {
      this.financials = this.financials.map((f) => f.id === finData.id ? { ...f, ...finData, updated_at: now } : f);
      this.saveAll();
      return this.financials.find((f) => f.id === finData.id)!;
    } else {
      const newFin: FinancialRecord = {
        id: 'fin-' + Date.now(),
        type: finData.type || 'income',
        amount: finData.amount || 0,
        currency: 'XAF',
        date: finData.date || new Date().toISOString().split('T')[0],
        description: finData.description || 'Opération financière',
        category: finData.category || 'Vente Récolte',
        farm_id: finData.farm_id,
        worker_id: finData.worker_id || null,
        payment_method: finData.payment_method || 'orange_money',
        related_contact_id: finData.related_contact_id || null,
        created_at: now,
        updated_at: now,
      };
      this.financials.push(newFin);
      this.saveAll();
      return newFin;
    }
  }
  public deleteFinancialRecord(id: string) {
    this.financials = this.financials.filter((f) => f.id !== id);
    this.saveAll();
  }

  // --- INVESTMENTS ---
  public getInvestments(): Investment[] { return [...this.investments]; }
  public saveInvestment(invstData: Partial<Investment> & { id?: string }): Investment {
    const now = new Date().toISOString();
    if (invstData.id) {
      this.investments = this.investments.map((i) => i.id === invstData.id ? { ...i, ...invstData, updated_at: now } : i);
      this.saveAll();
      return this.investments.find((i) => i.id === invstData.id)!;
    } else {
      const newInvst: Investment = {
        id: 'invst-' + Date.now(),
        name: invstData.name || 'Investissement Équipement',
        type: invstData.type || 'equipment',
        amount: invstData.amount || 0,
        date: invstData.date || new Date().toISOString().split('T')[0],
        description: invstData.description || '',
        farm_id: invstData.farm_id || null,
        expected_return: invstData.expected_return || null,
        return_date: invstData.return_date || null,
        status: invstData.status || 'active',
        created_at: now,
        updated_at: now,
      };
      this.investments.push(newInvst);
      this.saveAll();
      return newInvst;
    }
  }
  public deleteInvestment(id: string) {
    this.investments = this.investments.filter((i) => i.id !== id);
    this.saveAll();
  }
}

export const dbStore = new LocalDatabaseStore();
