import { AppRole } from '@/types/database';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage_system';

export type Resource =
  | 'farms'
  | 'plots'
  | 'crops'
  | 'inventory'
  | 'workers'
  | 'tasks'
  | 'financials'
  | 'contacts'
  | 'investments'
  | 'profile'
  | 'dashboard';

export const ALL_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'manage_system'];

export const ALL_RESOURCES: Resource[] = [
  'farms',
  'plots',
  'crops',
  'inventory',
  'workers',
  'tasks',
  'financials',
  'contacts',
  'investments',
  'profile',
  'dashboard',
];

/** Resource -> actions allowed for a role (admin is implicit: everything). */
export type RoleMatrix = Partial<Record<Resource, readonly PermissionAction[]>>;

/**
 * Data-driven permission matrix. Entries are additive: a missing resource means
 * no permission on it (except admin, which is unlocked on everything via
 * hasPermission). Used by the app, and the future basis for a SaaS-Admin
 * permissions editor.
 */
export const PERMISSIONS: Record<Exclude<AppRole, 'admin'>, RoleMatrix> = {
  // Operational control: full CRUD on day-to-day resources, read-only on
  // finance & investments, and no platform-level manage_system.
  manager: {
    farms: ['view', 'create', 'edit', 'delete'],
    plots: ['view', 'create', 'edit', 'delete'],
    crops: ['view', 'create', 'edit', 'delete'],
    inventory: ['view', 'create', 'edit', 'delete'],
    workers: ['view', 'create', 'edit', 'delete'],
    tasks: ['view', 'create', 'edit', 'delete'],
    contacts: ['view', 'create', 'edit', 'delete'],
    financials: ['view'],
    investments: ['view'],
    profile: ['view', 'edit'],
    dashboard: ['view'],
  },
  // Field worker: view operational state, and may update their own tasks.
  worker: {
    farms: ['view'],
    plots: ['view'],
    crops: ['view'],
    inventory: ['view'],
    tasks: ['view', 'edit'],
    profile: ['view'],
    dashboard: ['view'],
  },
};

/**
 * Checks if a given user role has permission to perform an action on a resource.
 */
export function hasPermission(
  role: AppRole | undefined,
  action: PermissionAction,
  resource: Resource,
): boolean {
  if (!role) return false;

  // Admin has full control over everything (including manage_system).
  if (role === 'admin') return true;

  return (PERMISSIONS[role]?.[resource]?.includes(action) ?? false);
}

export const canManageFarms = (role?: AppRole) => hasPermission(role, 'create', 'farms');
export const canManageWorkers = (role?: AppRole) => hasPermission(role, 'create', 'workers');
export const canManageFinancials = (role?: AppRole) => hasPermission(role, 'create', 'financials');
export const canDeleteFinancials = (role?: AppRole) => hasPermission(role, 'delete', 'financials');
export const canManageInvestments = (role?: AppRole) => hasPermission(role, 'create', 'investments');
export const canCreateTask = (role?: AppRole) => hasPermission(role, 'create', 'tasks');
export const canDeleteTask = (role?: AppRole) => hasPermission(role, 'delete', 'tasks');
export const canUpdateTaskStatus = (role?: AppRole) => hasPermission(role, 'edit', 'tasks');