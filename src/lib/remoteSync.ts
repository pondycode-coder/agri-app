import { SupabaseBackend } from './supabaseBackend';
import { dbStore } from '../services/store';
import { Profile, Farm, AdminFarm, AdminUser, AdminStats, AppRole, AuthEvent } from '../types/database';
import {
  INITIAL_FARMS,
  INITIAL_PLOTS,
} from '../services/mockData';

let activeBackend: SupabaseBackend | null = null;
let activeUser: Profile | null = null;

/**
 * Activate the Supabase tenant for a signed-in user.
 * - attaches the remote mirror to the local cache store
 * - seeds the tenant's first farm if none exists yet
 * - adds the user to that farm (user_farms) if needed
 * - hydrates the cache with the farm's live data
 *
 * Falls back gracefully (no-op) when Supabase is not configured.
 */
export async function activateFarm(profile: Profile): Promise<void> {
  if (!profile.farm_id) return;

  const backend = new SupabaseBackend(profile.farm_id);
  activeBackend = backend;
  activeUser = profile;

  if (backend.isConfigured()) {
    const firstFarm = INITIAL_FARMS[0];
    await backend.seedFarmIfEmpty(firstFarm, INITIAL_PLOTS.filter((p) => p.farm_id === firstFarm.id));
    await backend.ensureMembership(profile.id, profile.farm_id);
    await backend.bindProfileToFarm(profile);
  }

  dbStore.attachRemote(backend);
  if (backend.isConfigured()) {
    await dbStore.hydrateFromRemote(profile.farm_id);
  }
}

export async function listUserFarms(): Promise<Farm[]> {
  if (!activeBackend?.isConfigured()) return [];
  return activeBackend.listMyFarms();
}

/** Fetch the signed-in user's real profile row (farm_id, role) from Supabase. */
export async function getMyProfile(): Promise<Profile | null> {
  // Must NOT depend on activeBackend: it is only set by activateFarm(), which
  // runs AFTER profile resolution — using it here is a chicken-and-egg deadlock.
  const backend = activeBackend ?? new SupabaseBackend('');
  if (!backend.isConfigured()) return null;
  return backend.getMyProfile();
}

/** Re-create the profile row when it is missing (e.g. after a DB reset). */
export async function ensureMyProfile(name: string, email: string): Promise<Profile | null> {
  const backend = activeBackend ?? new SupabaseBackend('');
  if (!backend.isConfigured()) return null;
  return backend.ensureMyProfile(name, email);
}

/** Create a farm owned by the current user and switch to it. */
export async function createFarmAndSwitch(
  data: { name: string; location?: string; size_in_hectares?: number; description?: string },
): Promise<Farm | null> {
  if (!activeUser) return null;

  if (activeBackend?.isConfigured()) {
    const created = await activeBackend.createFarm(data);
    if (!created) return null;
    await switchFarm(created.id);
    return created;
  }

  // Local/demo mode: persist through the cache store.
  const created = dbStore.saveFarm({
    name: data.name,
    location: data.location || 'Cameroun',
    size_in_hectares: data.size_in_hectares || 1,
    description: data.description || '',
  });
  await switchFarm(created.id);
  return created;
}

/** Join an existing farm by id and switch to it. Returns null if not found. */
export async function joinFarmAndSwitch(farmId: string): Promise<Farm | null> {
  if (!activeUser) return null;

  if (activeBackend?.isConfigured()) {
    const joined = await activeBackend.joinFarm(farmId);
    if (!joined) return null;
    await switchFarm(joined.id);
    return joined;
  }

  // Local/demo mode: look the farm up in the cache store.
  const target = dbStore.getFarms().find((f) => f.id === farmId);
  if (!target) return null;
  await switchFarm(target.id);
  return target;
}

/** Switch the active tenant; re-hydrates the cache for the chosen farm. */
export async function switchFarm(farmId: string): Promise<void> {
  if (!activeBackend || !activeUser) return;
  activeBackend.farmId = farmId;
  if (activeBackend.isConfigured()) {
    await dbStore.hydrateFromRemote(farmId);
  } else {
    dbStore.hydrateLocal(farmId);
  }
  await activeBackend.ensureMembership(activeUser.id, farmId);
}

export function detachFarm(): void {
  activeBackend = null;
  activeUser = null;
  dbStore.attachRemote(null);
}

export function getActiveBackend(): SupabaseBackend | null {
  return activeBackend;
}

// --- SaaS super-admin helpers -------------------------------------
// All delegate to Supabase RPCs that gate on is_super_admin() server-side.

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.isSuperAdmin();
}

export async function adminListFarms(): Promise<AdminFarm[]> {
  if (!activeBackend?.isConfigured()) return [];
  return activeBackend.adminListFarms();
}

export async function adminListUsers(): Promise<AdminUser[]> {
  if (!activeBackend?.isConfigured()) return [];
  return activeBackend.adminListUsers();
}

export async function adminStats(): Promise<AdminStats | null> {
  if (!activeBackend?.isConfigured()) return null;
  return activeBackend.adminStats();
}

export async function adminSetRole(userId: string, role: AppRole): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.adminSetRole(userId, role);
}

export async function adminSetSuperadmin(userId: string, active: boolean): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.adminSetSuperadmin(userId, active);
}

export async function adminDeleteFarm(farmId: string): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.adminDeleteFarm(farmId);
}

export async function adminMoveUser(userId: string, farmId: string): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.adminMoveUser(userId, farmId);
}

// --- PIN auth -----------------------------------------------------

/** Set or change the signed-in user's own PIN (Supabase only). */
export async function setMyPin(pin: string): Promise<boolean> {
  const backend = activeBackend ?? new SupabaseBackend('');
  return backend.setMyPin(pin);
}

/** Super-admin sets/resets any user's PIN (Supabase only). */
export async function adminSetPin(userId: string, pin: string): Promise<boolean> {
  if (!activeBackend?.isConfigured()) return false;
  return activeBackend.adminSetPin(userId, pin);
}

// --- auth activity log -----------------------------------------------------

/** Report a login/logout event to the platform (best-effort, never throws). */
export async function recordAuthEvent(
  userId: string,
  email: string,
  name: string,
  farmId: string | null,
  eventType: 'login' | 'logout',
): Promise<void> {
  try {
    const backend = activeBackend ?? new SupabaseBackend('');
    await backend.recordAuthEvent(userId, email, name, farmId, eventType);
  } catch (err) {
    console.error('[remoteSync] recordAuthEvent:', err);
  }
}

export async function adminListAuthEvents(limit = 100): Promise<AuthEvent[]> {
  if (!activeBackend?.isConfigured()) return [];
  return activeBackend.adminListAuthEvents(limit);
}