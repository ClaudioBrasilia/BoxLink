import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  loading: boolean;
  initializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        currentUserIdRef.current = session.user.id;
        await fetchUserProfile(session.user.id);
      }
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        currentUserIdRef.current = null;
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, checkins(*)')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        console.warn('Profile not found for user:', userId);
        setUser(null);
        return null;
      }

      const mappedUser: User = {
        id: data.id,
        email: data.email,
        name: data.name ?? data.full_name ?? 'Atleta',
        role: data.role,
        status: data.status ?? data.approval_status ?? data.approvalStatus ?? 'pending',
        xp: data.xp || 0,
        coins: data.coins || 0,
        level: data.level || 1,
        avatar: {
          equipped: data.avatar_equipped,
          inventory: data.avatar_inventory || []
        },
        checkins: (data.checkins || []).map((c: any) => ({
          date: c.date,
          timestamp: c.timestamp,
          classTime: c.class_time
        })),
        paidBonuses: data.paid_bonuses || [],
        createdAt: data.created_at
      };

      setUser(mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setLoading(false);
        return { error: authError };
      }

      if (authData.user) {
        currentUserIdRef.current = authData.user.id;

        const profile = await fetchUserProfile(authData.user.id);
        if (!profile) {
          await new Promise(resolve => setTimeout(resolve, 800));
          const retryProfile = await fetchUserProfile(authData.user.id);
          if (!retryProfile) {
            setLoading(false);
            return { error: { message: 'Perfil não encontrado. Verifique se sua conta foi aprovada.' } };
          }
        }
      }

      return { error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      setLoading(false);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });

      if (authError) {
        setLoading(false);
        return { error: authError };
      }

      setLoading(false);
      return { error: null };
    } catch (error: any) {
      console.error('Signup error:', error);
      setLoading(false);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const logout = async () => {
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, loading, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
