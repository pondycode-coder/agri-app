import type {
  Contact,
  CropCycle,
  Farm,
  FarmTask,
  FinancialRecord,
  Harvest,
  InventoryItem,
  Investment,
  Plot,
  Profile,
  Worker,
} from '../types/database';

/** Version of the backup file format produced by the app. */
export const BACKUP_VERSION = 1;

/** A complete snapshot of every data repository the app uses. */
export interface BackupData {
  version: number;
  app: 'agri-app';
  exported_at: string;
  data: {
    profiles: Profile[];
    farms: Farm[];
    plots: Plot[];
    crop_cycles: CropCycle[];
    harvests: Harvest[];
    contacts: Contact[];
    inventory: InventoryItem[];
    workers: Worker[];
    tasks: FarmTask[];
    financials: FinancialRecord[];
    investments: Investment[];
  };
}

/** Build a BackupData envelope around the given tables. */
export const buildBackup = (data: BackupData['data']): BackupData => ({
  version: BACKUP_VERSION,
  app: 'agri-app',
  exported_at: new Date().toISOString(),
  data: {
    profiles: [...data.profiles],
    farms: [...data.farms],
    plots: [...data.plots],
    crop_cycles: [...data.crop_cycles],
    harvests: [...data.harvests],
    contacts: [...data.contacts],
    inventory: [...data.inventory],
    workers: [...data.workers],
    tasks: [...data.tasks],
    financials: [...data.financials],
    investments: [...data.investments],
  },
});

const BACKUP_TABLES = [
  'profiles',
  'farms',
  'plots',
  'crop_cycles',
  'harvests',
  'contacts',
  'inventory',
  'workers',
  'tasks',
  'financials',
  'investments',
] as const;

/**
 * Structural check for a backup file: right version/app marker and every
 * expected table present as an array.
 */
export const isBackupData = (value: unknown): value is BackupData => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as { version?: unknown; app?: unknown; exported_at?: unknown; data?: unknown };
  if (raw.version !== BACKUP_VERSION || raw.app !== 'agri-app') return false;
  if (typeof raw.exported_at !== 'string') return false;
  if (!raw.data || typeof raw.data !== 'object') return false;
  return BACKUP_TABLES.every((table) => Array.isArray((raw.data as Record<string, unknown>)[table]));
};

const fileNameSafe = (value: string) =>
  value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'data';

/** Trigger a browser download of the backup as a JSON file. */
export const downloadBackup = (data: BackupData, userName = 'data'): void => {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `agri-app-backup-${fileNameSafe(userName)}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
