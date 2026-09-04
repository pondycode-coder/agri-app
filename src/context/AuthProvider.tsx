import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { dbStore } from '../services/store';
import { Profile, Farm, AppRole, UserFarmMembership } from '../types/database';
import { hashPin, verifyPin, pinToSecret } from '../lib/pinAuth';
import { activateFarm, detachFarm, listUserFarms, switchFarm as switchFarmRemote, createFarmAndSwitch, joinFarmAndSwitch, setMyPin, getMyProfile, ensureMyProfile, isPinTaken } from '../lib/remoteSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  ready: boolean;
  farms: Farm[];
  activeFarmId: string | null;
  isSuperAdmin: boolean;
  /**
   * Role granted on the ACTIVE farm (from user_farms), falling back to the
   * profile's role when the membership is not loaded yet. Permissions must
   * always be checked against this, not `user.role`.
   */
  effectiveRole: AppRole | undefined;
  signIn: (email: string, pin: string) => Promise<Profile | null>;
  signUp: (email: string, pin: string, name: string, role?: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => void;
  switchFarm: (farmId: string) => Promise<void>;
  createFarm: (data: { name: string; location?: string; size_in_hectares?: number; description?: string }) => Promise<Farm | null>;
  joinFarm: (farmId: string) => Promise<Farm | null>;
  loginAsDemo: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(() => {
    // Only DEMO/local-mode profiles are allowed to boot from the cache.
    // On Supabase the user must come from a real auth session — never from a
    // demo fallback (its id like 'user-admin-1' is not a UUID and breaks RLS).
    try {
      const stored = localStorage.getItem('agri_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        const stale = (parsed?.name || '').toLowerCase().includes('jean') || parsed?.email === 'admin@agriapp.com';
        if (stale) {
          localStorage.removeItem('agri_current_user');
        } else if (!isSupabaseConfigured()) {
          return parsed;
        } else if (parsed && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id || '')) {
          return parsed;
        } else {
          localStorage.removeItem('agri_current_user');
        }
      }
    } catch (e) {
      console.error(e);
    }
    if (!isSupabaseConfigured()) {
      const profiles = dbStore.getProfiles();
      return profiles[0] || {
        id: 'user-admin-1',
        email: 'pondycode@gmail.com',
        name: 'Pondycode',
        role: 'admin',
        farm_id: 'farm-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  });
  // True only after the Supabase session has been checked at boot.
  const [ready, setReady] = useState(() => !isSupabaseConfigured());
  const [loading, setLoading] = useState<boolean>(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  // Per-farm role map: farmId -> role granted in user_farms. This is the
  // source of truth for authorization while a farm is active.
  const [farmRoles, setFarmRoles] = useState<Record<string, AppRole>>({});

  const applyFarms = (memberships: UserFarmMembership[]) => {
    setFarms(memberships.map((m) => m.farm));
    setFarmRoles(Object.fromEntries(memberships.map((m) => [m.farm.id, m.role])));
  };

  const effectiveRole: AppRole | undefined =
    (activeFarmId && farmRoles[activeFarmId]) || user?.role || undefined;

  // Restore a real Supabase session on refresh so protected pages (and the
  // post-login redirect) work after a page reload.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        let p: Profile | null = null;
        try {
          p = await getMyProfile();
          if (!p) p = await ensureMyProfile('', data.session.user.email || '');
        } catch (err) {
          console.error('[auth] session restore profile:', err);
        }
        if (!cancelled && p) {
          setUser(p);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('agri_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agri_current_user');
    }
  }, [user]);

  // Only auto-activate a real tenant user. Demo/local profiles (non-UUID ids,
  // e.g. 'user-admin-1' / farm 'farm-1') must never be pushed into Supabase.
  useEffect(() => {
    if (!user?.id) return;
    if (isSupabaseConfigured() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id || '')) {
      return;
    }
    const farmId = user.farm_id || '00000000-0000-4000-8000-000000000001';
    setActiveFarmId(farmId);
    void activateFarm(user);
    void listUserFarms().then((m) => { if (m.length > 0) applyFarms(m); });
  }, [user?.farm_id, user?.id]);

  // Activate the tenant + load the farm list after a successful login, but
  // never let a data-loading failure block the redirect — the user is already
  // authenticated at this point.
  const secureActivate = async (profile: Profile) => {
    const farmId = profile.farm_id || '00000000-0000-4000-8000-000000000001';
    setActiveFarmId(farmId);
    try {
      await activateFarm(profile);
    } catch (err) {
      console.error('[auth] activateFarm failed:', err);
    }
    try {
      const memberships = await listUserFarms();
      if (memberships.length > 0) applyFarms(memberships);
    } catch (err) {
      console.error('[auth] listUserFarms failed:', err);
    }
  };

  const signIn = async (email: string, pin: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pinToSecret(pin) });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
            throw new Error('Email ou PIN incorrect.');
          }
          if (msg.includes('confirm')) {
            throw new Error('Votre email n\'a pas encore été confirmé.');
          }
          throw error;
        }
        let profile = await getMyProfile();
        if (!profile) {
          profile = await ensureMyProfile(email.split('@')[0], email);
        }
        if (!profile) throw new Error('Compte introuvable.');
        setUser(profile);
        await secureActivate(profile);
        return profile;
      } else {
        const profile = dbStore.getProfileByEmail(email);
        if (!profile) {
          throw new Error('Aucun compte trouvé avec cet email.');
        }
        if (!profile.pin_hash) {
          throw new Error('Aucun PIN configuré pour ce compte. Contactez l\'administrateur.');
        }
        const valid = await verifyPin(pin, profile.pin_hash);
        if (!valid) {
          throw new Error('PIN incorrect.');
        }
        setUser(profile);
        await secureActivate(profile);
        return profile;
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pin: string, name: string, role: AppRole = 'admin') => {
    setLoading(true);
    try {
      if (!/^\d{4}$/.test(pin)) {
        throw new Error('Le PIN doit contenir exactement 4 chiffres.');
      }
      if (isSupabaseConfigured()) {
        // Reject a PIN that is already in use before creating the auth user.
        // The email is derived from the PIN (<pin>@local.agri), so a duplicate
        // PIN means a duplicate email — but supabase.auth.signUp can silently
        // "succeed" for an existing email, so we check explicitly first.
        // isPinTaken returns false (falls back gracefully) if the RPC is not
        // available, in which case signUp's own detection below still applies.
        if (await isPinTaken(pin)) {
          throw new Error('Ce PIN est déjà utilisé par un autre compte. Choisissez un autre code.');
        }
        // Create the Supabase auth user using the PIN as its password (its
        // trigger creates the DB profile row). signUp also logs the user in,
        // giving a real session so RLS lets the app read their data.
        const { data: suData, error: su } = await supabase.auth.signUp({
          email,
          password: pinToSecret(pin),
          options: { data: { name: name || email.split('@')[0], role } },
        });
        if (su) {
          const code = su.code || '';
          const msg = (su.message || '').toLowerCase();
          if (code === 'user_already_exists' || msg.includes('already') || msg.includes('exists')) {
            throw new Error('Ce PIN est déjà utilisé par un autre compte. Choisissez un autre code.');
          }
          throw su;
        }
        // signUp does not always create a session (email confirmation may be
        // enabled). Establish one so auth.uid() is set and the app can read the
        // user's data through RLS.
        if (!suData?.session) {
          const { error: si } = await supabase.auth.signInWithPassword({ email, password: pinToSecret(pin) });
          if (si) {
            const sm = (si.message || '').toLowerCase();
            if (sm.includes('confirm') || sm.includes('not confirmed')) {
              throw new Error('Veuillez d\'abord confirmer votre email, puis réessayer.');
            }
            // Sign-in with the derived email+password failed. If the PIN's
            // derived email already belongs to an existing account, the takeaway
            // is "this PIN is taken" (its password differs from ours).
            if (sm.includes('invalid login') || sm.includes('invalid credentials')) {
              throw new Error('Ce PIN est déjà utilisé par un autre compte. Choisissez un autre code.');
            }
            throw si;
          }
        }
        // Store the PIN in the profiles column so it is visible to the admin.
        const pinOk = await setMyPin(pin);
        if (!pinOk) {
          // set_my_pin is security-definer and rejects a duplicate PIN with
          // PIN_ALREADY_TAKEN; a failure here almost always means the PIN is
          // already in use by another account.
          throw new Error('Ce PIN est déjà utilisé par un autre compte. Choisissez un autre code.');
        }
        let newProf = await getMyProfile();
        if (!newProf) {
          newProf = await ensureMyProfile(name || email.split('@')[0], email);
        }
        if (!newProf) throw new Error('Impossible de créer le compte.');
        setUser(newProf);
        {
          const farmId = newProf.farm_id || '00000000-0000-4000-8000-000000000001';
          setActiveFarmId(farmId);
          await activateFarm(newProf);
          const memberships = await listUserFarms();
          if (memberships.length > 0) applyFarms(memberships);
        }
      } else {
        const existing = dbStore.getProfileByEmail(email);
        if (existing) {
          throw new Error('Un compte avec cet email existe déjà.');
        }
        const pinHash = await hashPin(pin);
        const newProf = dbStore.saveProfile({
          id: 'user-' + Date.now(),
          email,
          name: name || email.split('@')[0],
          role,
          farm_id: 'farm-1',
          pin_hash: pinHash,
        });
        setUser(newProf);
        if (newProf.farm_id) {
          setActiveFarmId(newProf.farm_id);
          await activateFarm(newProf);
          const memberships = await listUserFarms();
          if (memberships.length > 0) applyFarms(memberships);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    detachFarm();
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setFarms([]);
    setFarmRoles({});
    setActiveFarmId(null);
  };

  const switchRole = (newRole: AppRole) => {
    if (!user) return;
    // Local/demo mode only. In Supabase mode the role lives in the DB
    // (profiles + user_farms); client-side switching would only fake the UI
    // and fight the server — so it is a strict no-op there.
    if (isSupabaseConfigured()) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    dbStore.saveProfile(updated);
  };

  const refreshFarms = async () => {
    const memberships = await listUserFarms();
    if (memberships.length > 0) applyFarms(memberships);
  };

  const switchFarm = async (farmId: string) => {
    setActiveFarmId(farmId);
    await switchFarmRemote(farmId);
    if (user) setUser({ ...user, farm_id: farmId });
  };

  const createFarm = async (data: { name: string; location?: string; size_in_hectares?: number; description?: string }) => {
    if (!user) return null;
    const created = await createFarmAndSwitch(data);
    if (!created) return null;
    setActiveFarmId(created.id);
    if (user) setUser({ ...user, farm_id: created.id });
    await refreshFarms();
    return created;
  };

  const joinFarm = async (farmId: string) => {
    if (!user) return null;
    const joined = await joinFarmAndSwitch(farmId);
    if (!joined) return null;
    setActiveFarmId(joined.id);
    if (user) setUser({ ...user, farm_id: joined.id });
    await refreshFarms();
    return joined;
  };

  const loginAsDemo = (role: AppRole) => {
    // Never available on a deployed/configured Supabase instance.
    if (isSupabaseConfigured()) return;
    const profiles = dbStore.getProfiles();
    let demoUser = profiles.find((p) => p.role === role) || profiles[0];
    if (!demoUser) {
      demoUser = dbStore.saveProfile({
        id: 'user-admin-1',
        email: 'pondycode@gmail.com',
        name: 'Pondycode',
        role: 'admin',
        farm_id: 'farm-1',
      });
    }
    if (demoUser.role === 'admin') {
      demoUser = { ...demoUser, name: 'Pondycode', email: 'pondycode@gmail.com' };
    }
    setUser(demoUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        ready,
        farms,
        activeFarmId,
        isSuperAdmin: user?.is_superadmin === true,
        effectiveRole,
        signIn,
        signUp,
        signOut,
        switchRole,
        switchFarm,
        createFarm,
        joinFarm,
        loginAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
