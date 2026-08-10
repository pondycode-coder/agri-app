import { AppRole, Profile } from '@/types/database';

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

/**
 * Checks if a given user role has permission to perform an action on a resource.
 */
export function hasPermission(
  role: AppRole | undefined,
  action: PermissionAction,
  resource: Resource
): boolean {
  if (!role) return false;

  // Admin has full control over everything
  if (role === 'admin') return true;

  // Manager privileges
  if (role === 'manager') {
    if (resource === 'investments' || resource === 'financials') {
      // Manager can view financials & investments, but cannot delete or manage high level system settings
      return action === 'view';
    }
    if (resource === 'profile') {
      return action === 'view' || action === 'edit';
    }
    // Managers can view, create, edit, and delete operational resources (farms, plots, crops, inventory, workers, tasks, contacts)
    return true;
  }

  // Worker privileges
  if (role === 'worker') {
    if (resource === 'dashboard') {
      return action === 'view';
    }
    if (resource === 'tasks') {
      // Worker can view tasks, edit task progress/status, but cannot delete tasks
      return action === 'view' || action === 'edit';
    }
    if (resource === 'crops' || resource === 'plots' || resource === 'inventory' || resource === 'farms') {
      // Workers can view operational status
      return action === 'view';
    }
    if (resource === 'profile') {
      return action === 'view';
    }
    // Workers cannot access or alter financials, investments, workers management
    return false;
  }

  return false;
}

export const canManageFarms = (role?: AppRole) => hasPermission(role, 'create', 'farms');
export const canManageWorkers = (role?: AppRole) => hasPermission(role, 'create', 'workers');
export const canManageFinancials = (role?: AppRole) => hasPermission(role, 'create', 'financials');
export const canDeleteFinancials = (role?: AppRole) => hasPermission(role, 'delete', 'financials');
export const canManageInvestments = (role?: AppRole) => hasPermission(role, 'create', 'investments');
export const canCreateTask = (role?: AppRole) => hasPermission(role, 'create', 'tasks');
export const canDeleteTask = (role?: AppRole) => hasPermission(role, 'delete', 'tasks');
export const canUpdateTaskStatus = (role?: AppRole) => hasPermission(role, 'edit', 'tasks');
