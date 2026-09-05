import { Farm, Profile, AdminFarm, AdminUser, AdminStats, AuthEvent, AppRole, UserFarmMembership, RolePermission } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type EntityKey =
  | 'farms'
  | 'profiles'
  | 'plots'
  | 'crop_cycles'
  | 'harvests'
  | 'contacts'
  | 'inventory_items'
  | 'workers'
  | 'farm_tasks'
  | 'financial_records'
  | 'investments'
  | 'user_farms';

/**
 * Thin Supabase access layer used by the adaptive store.
 * Every read/write is scoped to the current farm_id — RLS is the second
 * line of defence; the app never queries outside the tenant anyway.
 */
export class SupabaseBackend {
  public farmId: string | null = null;

  constructor(farmId: string | null = null) {
    this.farmId = farmId;
  }

  public isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  public isActive(): boolean {
    return this.isConfigured() && Boolean(this.farmId);
  }

  // --- reads -----------------------------------------------------------
  async fetchAll<T>(table: EntityKey): Promise<T[]> {
    let q = supabase.from(table).select('*');
    if (this.farmId && table !== 'profiles') {
      // Mirror the RLS tenant scoping per table:
      // - `farms`: primary key IS the farm id → filter by `id`.
      // - `crop_cycles`: has NO farm_id column; scoped via plot_id →
      //   plots.farm_id, so it must not be filtered on a nonexistent column.
      // - `harvests`: has NO farm_id column; scoped via crop_cycle_id →
      //   crop_cycles.plot_id → plots.farm_id (same reason).
      // - `contacts`/`investments`: farm_id is optional, so rows created
      //   with farm_id IS NULL are allowed by RLS (coalesce) and must be
      //   fetched back — otherwise they vanish after a reload.
      // - everything else: carries a farm_id column.
      if (table === 'farms') {
        q = q.eq('id', this.farmId);
      } else if (table === 'crop_cycles' || table === 'harvests') {
        // no farm_id column — RLS already scopes to the current farm
      } else if (table === 'contacts' || table === 'investments') {
        q = q.or(`farm_id.eq.${this.farmId},farm_id.is.null`);
      } else {
        q = q.eq('farm_id', this.farmId);
      }
    }
    const { data, error } = await q;
    if (error) {
      console.error(`[supabase] fetch ${table}:`, error.message);
      return [];
    }
    return (data || []) as T[];
  }

  // --- writes -----------------------------------------------------------
  public async upsert(table: EntityKey, rows: Record<string, unknown>[]): Promise<{ ok: boolean; error?: string }> {
    if (!this.isActive() || rows.length === 0) return { ok: true };
    const { error } = await supabase.from(table).upsert(rows as never);
    if (error) {
      console.error(`[supabase] upsert ${table}:`, error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  public async remove(table: EntityKey, id: string) {
    if (!this.isActive()) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.error(`[supabase] delete ${table}:`, error.message);
  }

  // --- tenant bootstrap --------------------------------------------------
  /** Fetch the current user's profile row (farm_id, role) from the DB. */
  public async getMyProfile(): Promise<Profile | null> {
    if (!this.isConfigured()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id' as never, user.id as never)
      .maybeSingle();
    if (error) {
      console.error('[supabase] getMyProfile:', error.message);
      throw new Error(`getMyProfile: ${error.message}`);
    }
    return data as Profile | null;
  }

  /** Re-create the signed-in user's profile row if it was wiped (DB reset). */
  public async ensureMyProfile(name: string, email: string): Promise<Profile | null> {
    if (!this.isConfigured()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc('ensure_profile', {
      p_user_id: user.id,
      p_name: name,
      p_email: email,
    } as never);
    if (error) {
      console.error('[supabase] ensure_profile:', error.message);
      throw new Error(`ensure_profile: ${error.message}`);
    }
    return data as Profile | null;
  }

  /** Claim the current Auth0-style Supabase user's profile row so RLS resolves. */
  public async bindProfileToFarm(profile: Profile): Promise<Profile | null> {
    if (!this.isConfigured() || !profile.id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: profile.name,
        role: profile.role,
        farm_id: this.farmId,
      } as never)
      .eq('id' as never, profile.id as never)
      .select()
      .single();
    if (error) {
      console.error('[supabase] bindProfileToFarm:', error.message);
      return null;
    }
    return data as Profile | null;
  }

  /** Ensure the user belongs to the farm (insert into user_farms if missing). */
  public async ensureMembership(userId: string, farmId: string, role = 'admin'): Promise<void> {
    if (!this.isConfigured()) return;
    const { data } = await supabase
      .from('user_farms')
      .select('farm_id')
      .eq('user_id', userId)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (data) return;
    const { error } = await supabase
      .from('user_farms')
      .insert({ user_id: userId, farm_id: farmId, role } as never);
    if (error) console.error('[supabase] ensureMembership:', error.message);
  }

  /** Switch the user's active farm in the DB so RLS + role lookups follow. */
  public async setActiveFarm(farmId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('set_active_farm', { p_farm_id: farmId } as never);
    if (error) console.error('[supabase] setActiveFarm:', error.message);
    return !error;
  }

  /** Bootstrap farm + membership + profile in one RPC (security definer).
   *  Breaks the RLS deadlock that occurs when profiles.farm_id is NULL. */
  public async bootstrapFarm(userId: string, farmId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('bootstrap_user_farm', {
      p_user_id: userId,
      p_farm_id: farmId,
    } as never);
    if (error) {
      console.error('[supabase] bootstrapFarm:', error.message);
      return false;
    }
    return true;
  }

  /** List farms the current user belongs to, with their per-farm role. */
  public async listMyFarms(): Promise<UserFarmMembership[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase
      .from('user_farms')
      .select('farm_id, role, farms(*)');
    if (error) {
      console.error('[supabase] listMyFarms:', error.message);
      return [];
    }
    return (data || [])
      .map((row) => {
        const r = row as { farm_id: string; role: string; farms: Farm[] | null };
        const farm = Array.isArray(r.farms) ? r.farms[0] : null;
        if (!farm) return null;
        return { farm, role: r.role as AppRole } satisfies UserFarmMembership;
      })
      .filter((x): x is UserFarmMembership => Boolean(x));
  }

  /** Create a farm owned by the current user and join it (single transaction). */
  public async createFarm(data: {
    name: string;
    location?: string;
    size_in_hectares?: number;
    description?: string;
  }): Promise<Farm | null> {
    if (!this.isConfigured()) return null;
    const { data: farm, error } = await supabase.rpc('create_farm_and_join', {
      p_name: data.name,
      p_location: data.location || '',
      p_size_in_hectares: data.size_in_hectares || 0,
      p_description: data.description || null,
    } as never);
    if (error) {
      console.error('[supabase] createFarm:', error.message);
      return null;
    }
    return farm as Farm | null;
  }

  /** Join an existing farm by id (as a worker). Returns null if not found. */
  public async joinFarm(farmId: string): Promise<Farm | null> {
    if (!this.isConfigured()) return null;
    const { data: farm, error } = await supabase.rpc('join_farm_by_id', {
      p_farm_id: farmId,
    } as never);
    if (error) {
      console.error('[supabase] joinFarm:', error.message);
      return null;
    }
    return farm as Farm | null;
  }

  /** First-run: persist the seed farm so a fresh tenant has baseline data. */
  public async seedFarmIfEmpty(farmId: string): Promise<void> {
    if (!this.isConfigured()) return;
    const existing = await this.fetchAll<Farm>('farms');
    if (existing.length > 0) return;
    const { error } = await supabase.from('farms').upsert({
      id: farmId,
      name: 'Ma ferme',
      location: '',
      plots: 0,
      size_in_hectares: 0,
      description: '',
    } as never);
    if (error) console.error('[supabase] seedFarmIfEmpty:', error.message);
  }

  // --- SaaS super-admin (platform-wide, gated server-side) ----------
  public async isSuperAdmin(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { data, error } = await supabase.rpc('is_super_admin');
    if (error) {
      console.error('[supabase] isSuperAdmin:', error.message);
      return false;
    }
    return Boolean(data);
  }

  public async adminListFarms(): Promise<AdminFarm[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase.rpc('admin_list_farms');
    if (error) {
      console.error('[supabase] adminListFarms:', error.message);
      return [];
    }
    return (data || []) as AdminFarm[];
  }

  public async adminListUsers(): Promise<AdminUser[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) {
      console.error('[supabase] adminListUsers:', error.message);
      return [];
    }
    return (data || []) as AdminUser[];
  }

  public async adminStats(): Promise<AdminStats | null> {
    if (!this.isConfigured()) return null;
    const { data, error } = await supabase.rpc('admin_stats');
    if (error) {
      console.error('[supabase] adminStats:', error.message);
      return null;
    }
    return (data?.[0] || null) as AdminStats | null;
  }

  public async adminSetRole(userId: string, role: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role } as never);
    if (error) console.error('[supabase] adminSetRole:', error.message);
    return !error;
  }

  public async adminListPermissions(): Promise<RolePermission[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase.rpc('admin_list_permissions' as never);
    if (error) {
      console.error('[supabase] adminListPermissions:', error.message);
      return [];
    }
    return (data || []) as RolePermission[];
  }

  public async adminSetPermission(
    role: AppRole,
    resource: string,
    action: string,
    allowed: boolean,
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_set_permission', {
      p_role: role,
      p_resource: resource,
      p_action: action,
      p_allowed: allowed,
    } as never);
    if (error) console.error('[supabase] adminSetPermission:', error.message);
    return !error;
  }

  public async adminResetPermissions(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_reset_permissions' as never);
    if (error) console.error('[supabase] adminResetPermissions:', error.message);
    return !error;
  }

  public async adminSetSuperadmin(userId: string, active: boolean): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_set_superadmin', { p_user_id: userId, p_active: active } as never);
    if (error) console.error('[supabase] adminSetSuperadmin:', error.message);
    return !error;
  }

  public async adminDeleteFarm(farmId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_delete_farm', { p_farm_id: farmId } as never);
    if (error) console.error('[supabase] adminDeleteFarm:', error.message);
    return !error;
  }

  public async adminMoveUser(userId: string, farmId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_move_user', { p_user_id: userId, p_farm_id: farmId } as never);
    if (error) console.error('[supabase] adminMoveUser:', error.message);
    return !error;
  }

  // --- PIN auth -------------------------------------------------------------

  /** Set or change the signed-in user's own PIN (which doubles as its Supabase password). */
  public async setMyPin(pin: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('set_my_pin', { p_pin: pin } as never);
    if (error) console.error('[supabase] setMyPin:', error.message);
    return !error;
  }

  /** Return true when the PIN is already in use by another account. */
  public async isPinTaken(pin: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { data, error } = await supabase.rpc('pin_taken', { p_pin: pin } as never);
    if (error) {
      console.error('[supabase] pin_taken:', error.message);
      return false;
    }
    return Boolean(data);
  }

  /** Super-admin sets/resets any user's PIN. */
  public async adminSetPin(userId: string, pin: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { error } = await supabase.rpc('admin_set_pin', { p_user_id: userId, p_pin: pin } as never);
    if (error) {
      console.error('[supabase] adminSetPin:', error.message);
      const msg = (error.message || '').toUpperCase();
      if (msg.includes('PIN_ALREADY_TAKEN')) {
        throw new Error('Ce PIN est déjà utilisé par un autre compte. Choisissez un autre code.');
      }
      if (msg.includes('INVALID_PIN_FORMAT')) {
        throw new Error('Le PIN doit contenir exactement 4 chiffres.');
      }
      if (msg.includes('FORBIDDEN')) {
        throw new Error('Action refusée : vous n\'êtes pas super-admin.');
      }
      throw new Error(msg);
    }
    return true;
  }

  // --- auth activity log --------------------------------------------------

  /** Record a login/logout event for a user (fire-and-forget). */
  public async recordAuthEvent(
    userId: string,
    email: string,
    name: string,
    farmId: string | null,
    eventType: 'login' | 'logout',
  ): Promise<void> {
    if (!this.isConfigured()) return;
    const { error } = await supabase.rpc('record_auth_event', {
      p_user_id: userId,
      p_user_email: email,
      p_user_name: name,
      p_farm_id: farmId,
      p_event_type: eventType,
    } as never);
    if (error) console.error('[supabase] recordAuthEvent:', error.message);
  }

  /** List recent auth activity for a super admin. */
  public async adminListAuthEvents(limit = 100): Promise<AuthEvent[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase.rpc('admin_list_auth_events', { p_limit: limit } as never);
    if (error) {
      console.error('[supabase] adminListAuthEvents:', error.message);
      return [];
    }
    return (data || []) as AuthEvent[];
  }
}