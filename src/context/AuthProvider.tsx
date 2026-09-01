import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { dbStore } from '../services/store';
import { Profile, Farm, AppRole } from '../types/database';
import { hashPin, verifyPin, pinToSecret } from '../lib/pinAuth';
import { activateFarm, detachFarm, listUserFarms, switchFarm as switchFarmRemote, createFarmAndSwitch, joinFarmAndSwitch, setMyPin, getMyProfile, ensureMyProfile } from '../lib/remoteSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  farms: Farm[];
  activeFarmId: string | null;
  isSuperAdmin: boolean;
  signIn: (email: string, pin: string) => Promise<void>;
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
    try {
      const stored = localStorage.getItem('agri_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        const stale = (parsed?.name || '').toLowerCase().includes('jean') || parsed?.email === 'admin@agriapp.com';
        if (stale) {
          localStorage.removeItem('agri_current_user');
        } else {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
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
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem('agri_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agri_current_user');
    }
  }, [user]);

  useEffect(() => {
    if (user?.farm_id) {
      setActiveFarmId(user.farm_id);
      void activateFarm(user);
      void listUserFarms().then((f) => { if (f.length > 0) setFarms(f); });
    }
  }, [user?.farm_id]);

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
        if (profile.farm_id) {
          setActiveFarmId(profile.farm_id);
          await activateFarm(profile);
          const userFarms = await listUserFarms();
          if (userFarms.length > 0) setFarms(userFarms);
        }
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
        if (profile.farm_id) {
          setActiveFarmId(profile.farm_id);
          await activateFarm(profile);
          const userFarms = await listUserFarms();
          if (userFarms.length > 0) setFarms(userFarms);
        }
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
            throw new Error('Un compte avec cet email existe déjà.');
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
            throw si;
          }
        }
        // Store the PIN in the profiles column so it is visible to the admin.
        await setMyPin(pin);
        let newProf = await getMyProfile();
        if (!newProf) {
          newProf = await ensureMyProfile(name || email.split('@')[0], email);
        }
        if (!newProf) throw new Error('Impossible de créer le compte.');
        setUser(newProf);
        if (newProf.farm_id) {
          setActiveFarmId(newProf.farm_id);
          await activateFarm(newProf);
          const userFarms = await listUserFarms();
          if (userFarms.length > 0) setFarms(userFarms);
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
          const userFarms = await listUserFarms();
          if (userFarms.length > 0) setFarms(userFarms);
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
    setActiveFarmId(null);
  };

  const switchRole = (newRole: AppRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    dbStore.saveProfile(updated);
  };

  const refreshFarms = async () => {
    const userFarms = await listUserFarms();
    if (userFarms.length > 0) setFarms(userFarms);
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
        farms,
        activeFarmId,
        isSuperAdmin: user?.is_superadmin === true,
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
