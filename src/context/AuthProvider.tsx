import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { dbStore } from '../services/store';
import { Profile, Farm, AppRole } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activateFarm, detachFarm, listUserFarms, switchFarm as switchFarmRemote, createFarmAndSwitch, joinFarmAndSwitch, getMyProfile, ensureMyProfile, recordAuthEvent } from '../lib/remoteSync';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  farms: Farm[];
  activeFarmId: string | null;
  isSuperAdmin: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithX: () => Promise<void>;
  signUp: (email: string, password?: string, name?: string, role?: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => void;
  switchFarm: (farmId: string) => Promise<void>;
  createFarm: (data: { name: string; location?: string; size_in_hectares?: number; description?: string }) => Promise<Farm | null>;
  joinFarm: (farmId: string) => Promise<Farm | null>;
  loginAsDemo: (role: AppRole) => void;
  resetPassword: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
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
        // Purge stale cached profiles from previous versions (any 'Jean' variant)
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
    // Default active profile for smooth experience
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

  // Listen for changes from Supabase if configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // getSession() + onAuthStateChange both fire on sign-in; dedupe so the
    // two runs can't double-provision the profile (duplicate key race).
    let sessionInFlight: Promise<void> | null = null;
    const applySession = (sessionUser: { id: string; email?: string | null; user_metadata?: { name?: string }; created_at: string }) => {
      if (sessionInFlight) return sessionInFlight;
      sessionInFlight = applySessionOnce(sessionUser).finally(() => {
        sessionInFlight = null;
      });
      return sessionInFlight;
    };

    const applySessionOnce = async (sessionUser: { id: string; email?: string | null; user_metadata?: { name?: string }; created_at: string }) => {
      const email = sessionUser.email || '';
      const name = sessionUser.user_metadata?.name || email.split('@')[0];
      const baseProfile: Profile = {
        id: sessionUser.id,
        email,
        name,
        role: 'admin',
        farm_id: null,
        created_at: sessionUser.created_at,
        updated_at: new Date().toISOString(),
      };

      // Resolve the user's real profile (farm_id/role) from the DB — the
      // handle_new_user trigger attaches sign-ups to the seed farm.
      let dbProfile: Profile | null;
      try {
        dbProfile = await getMyProfile();
        if (!dbProfile) {
          // Profile row is missing (e.g. after a DB reset wiped public.profiles
          // — the signup trigger only fires for new sign-ups). Re-provision it
          // server-side via ensure_profile (security definer, so it sees rows
          // RLS would hide and creates missing ones idempotently). Let RPC
          // errors surface so the real cause is shown instead of a blind,
          // duplicate-key-prone client insert.
          dbProfile = await ensureMyProfile(name, email);
        }
      } catch (err) {
        // Profile resolution failed at the network/RPC level — show the reason
        // instead of silently bouncing the user back to the login page.
        toast.error('Impossible de charger votre compte', {
          description: err instanceof Error ? err.message : String(err),
        });
        detachFarm();
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      if (!dbProfile) {
        // Still no profile: don't fabricate a ghost admin — sign the user out.
        toast.error('Compte introuvable', {
          description: 'Aucun profil associé à cet identifiant. Veuillez vous réinscrire.',
        });
        detachFarm();
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      const profile: Profile = { ...baseProfile, ...dbProfile };
      // Super admins bypass every role check (their farm role may still be the
      // DB default 'worker', which would otherwise hide sections like Ouvriers).
      if (profile.is_superadmin) profile.role = 'admin';

      setUser(profile);
      setActiveFarmId(profile.farm_id || null);
      if (profile.farm_id) {
        await activateFarm(profile);
        const userFarms = await listUserFarms();
        if (userFarms.length > 0) setFarms(userFarms);
      }

      // Report the login so super admins can see who signed in and when.
      void recordAuthEvent(profile.id, profile.email, profile.name, profile.farm_id || null, 'login');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) applySession(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        applySession(session.user);
      } else {
        detachFarm();
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, _password?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: _password || 'password123' });
        if (error) throw error;
        // session-change listener in the effect above applies the farm
      } else {
        const profiles = dbStore.getProfiles();
        let match = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
        if (!match) {
          match = dbStore.saveProfile({
            id: 'user-' + Date.now(),
            email: email,
            name: email.split('@')[0] || 'Pondycode',
            role: 'admin',
            farm_id: 'farm-1',
          });
        }
        if (match.role === 'admin') {
          match = { ...match, name: 'Pondycode', email: 'pondycode@gmail.com' };
        }
        setUser(match);
        void recordAuthEvent(match.id, match.email, match.name, match.farm_id || null, 'login');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('OAuth requires a Supabase connection');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  };

  const signInWithX = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('OAuth requires a Supabase connection');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signUp = async (email: string, _password?: string, name?: string, role: AppRole = 'admin') => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signUp({
          email,
          password: _password || 'password123',
          options: { data: { name, role } },
        });
        if (error) {
          const code = error.code || '';
          const msg = error.message.toLowerCase();
          if (code === 'user_already_exists' || msg.includes('already') || msg.includes('exists')) {
            throw new Error('An account with this email already exists. Try signing in or resend the confirmation email.');
          }
          throw error;
        }
      } else {
        const newProf = dbStore.saveProfile({
          id: 'user-' + Date.now(),
          email,
          name: name || email.split('@')[0] || 'Pondycode',
          role,
          farm_id: 'farm-1',
        });
        setUser(newProf);
        void recordAuthEvent(newProf.id, newProf.email, newProf.name, newProf.farm_id || null, 'login');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (user) {
      void recordAuthEvent(user.id, user.email, user.name, user.farm_id || null, 'logout');
    }
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
    // The admin demo identity is always Pondycode — never a stale cached name.
    if (demoUser.role === 'admin') {
      demoUser = { ...demoUser, name: 'Pondycode', email: 'pondycode@gmail.com' };
    }
    setUser(demoUser);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured()) {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
    }
  };

  const resendConfirmation = async (email: string) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
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
        signInWithGoogle,
        signInWithX,
        signUp,
        signOut,
        switchRole,
        switchFarm,
        createFarm,
        joinFarm,
        loginAsDemo,
        resetPassword,
        resendConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
