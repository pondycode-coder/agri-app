import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { dbStore } from '../services/store';
import { Profile, AppRole } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password?: string, name?: string, role?: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => void;
  loginAsDemo: (role: AppRole) => void;
  resetPassword: (email: string) => Promise<void>;
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
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    // Default active profile for smooth experience
    const profiles = dbStore.getProfiles();
    return profiles[0] || {
      id: 'user-admin-1',
      email: 'admin@agriapp.com',
      name: 'Jean-Paul Nkoumou',
      role: 'admin',
      farm_id: 'farm-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const [loading, setLoading] = useState<boolean>(false);

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || '';
        const name = session.user.user_metadata?.name || email.split('@')[0];
        setUser({
          id: session.user.id,
          email,
          name,
          role: 'admin',
          created_at: session.user.created_at,
          updated_at: new Date().toISOString(),
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || '';
        const name = session.user.user_metadata?.name || email.split('@')[0];
        setUser({
          id: session.user.id,
          email,
          name,
          role: 'admin',
          created_at: session.user.created_at,
          updated_at: new Date().toISOString(),
        });
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
      } else {
        const profiles = dbStore.getProfiles();
        let match = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
        if (!match) {
          match = dbStore.saveProfile({
            id: 'user-' + Date.now(),
            email,
            name: email.split('@')[0] || 'Utilisateur Agri',
            role: 'admin',
            farm_id: 'farm-1',
          });
        }
        setUser(match);
      }
    } finally {
      setLoading(false);
    }
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
        if (error) throw error;
      } else {
        const newProf = dbStore.saveProfile({
          id: 'user-' + Date.now(),
          email,
          name: name || email.split('@')[0] || 'Exploitant Agricole',
          role,
          farm_id: 'farm-1',
        });
        setUser(newProf);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const switchRole = (newRole: AppRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    dbStore.saveProfile(updated);
  };

  const loginAsDemo = (role: AppRole) => {
    const profiles = dbStore.getProfiles();
    const demoUser = profiles.find((p) => p.role === role) || profiles[0];
    setUser(demoUser);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured()) {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        switchRole,
        loginAsDemo,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
