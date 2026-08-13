import { Farm, Profile, Plot, AdminFarm, AdminUser, AdminStats } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type EntityKey =
  | 'farms'
  | 'profiles'
  | 'plots'
  | 'crop_cycles'
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
      // `farms` is the tenant root: its primary key IS the farm id, so
      // filter by `id`; every other table carries a farm_id column.
      q = table === 'farms' ? q.eq('id', this.farmId) : q.eq('farm_id', this.farmId);
    }
    const { data, error } = await q;
    if (error) {
      console.error(`[supabase] fetch ${table}:`, error.message);
      return [];
    }
    return (data || []) as T[];
  }

  // --- writes -----------------------------------------------------------
  public async upsert(table: EntityKey, rows: Record<string, unknown>[]) {
    if (!this.isActive() || rows.length === 0) return;
    const { error } = await supabase.from(table).upsert(rows as never);
    if (error) console.error(`[supabase] upsert ${table}:`, error.message);
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

  /** List farms the current user belongs to (via user_farms). */
  public async listMyFarms(): Promise<Farm[]> {
    if (!this.isConfigured()) return [];
    const { data, error } = await supabase
      .from('user_farms')
      .select('farm_id, farms(*)');
    if (error) {
      console.error('[supabase] listMyFarms:', error.message);
      return [];
    }
    return (data || [])
      .map((row) => (row as { farms: Farm[] | null }).farms)
      .filter((f): f is Farm[] => Array.isArray(f))
      .map((f) => f[0])
      .filter((f): f is Farm => Boolean(f));
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

  /** First-run: persist the seed farm + plots so a fresh tenant has baseline data. */
  public async seedFarmIfEmpty(emitFarm: Farm, emitPlots: Plot[]): Promise<void> {
    if (!this.isConfigured()) return;
    const existing = await this.fetchAll<Farm>('farms');
    if (existing.length > 0) return;
    await supabase.from('farms').upsert({
      id: emitFarm.id,
      name: emitFarm.name,
      location: emitFarm.location,
      plots: emitFarm.plots,
      size_in_hectares: emitFarm.size_in_hectares,
      description: emitFarm.description,
    } as never);
    for (const p of emitPlots) {
      await supabase.from('plots').upsert({
        id: p.id,
        farm_id: emitFarm.id,
        name: p.name,
        size_in_hectares: p.size_in_hectares,
        soil_type: p.soil_type,
        status: p.status,
      } as never);
    }
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
}