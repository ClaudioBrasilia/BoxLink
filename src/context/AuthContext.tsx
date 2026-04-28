import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const fetchUserProfile = async (userId: string): Promise<User | null> => {

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Supabase query error:', error);
        return null;
      }

      if (!data) {
        console.warn('Profile not found for user:', userId);
        return null;
      }

      const { data: checkinsData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId);

      const mappedUser: User = {
        id: data.id,
        email: data.email,
        name: data.name ?? 'Atleta',
        role: data.role ?? 'athlete',
        status: data.status ?? data.approval_status ?? data.approvalStatus ?? 'pending',
        xp: data.xp || 0,
        coins: data.coins || 0,
        level: data.level || 1,
        avatar: {
          equipped: data.avatar_equipped,
          inventory: data.avatar_inventory || []
        },
        checkins: (checkinsData || []).map((c: any) => ({
          date: c.date,
          timestamp: c.timestamp,
          classTime: c.class_time
        })),
        paidBonuses: data.paid_bonuses || [],
        createdAt: data.created_at
      };

      setUser(mappedUser);
      return mappedUser;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;

        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }

        if (isMounted) setInitializing(false);
      })
      .catch(() => {
        if (isMounted) setInitializing(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        setLoading(false);
        return { error: authError };
      }

      if (authData.user) {
        let profile = await fetchUserProfile(authData.user.id);

        if (!profile) {
          // Tenta buscar o perfil novamente com um pequeno atraso para dar tempo ao trigger do banco de dados
          await new Promise(resolve => setTimeout(resolve, 1500));
          profile = await fetchUserProfile(authData.user.id);
        }

        if (!profile) {
          // Se ainda não encontrar, pode ser um problema de sincronização ou RLS
          console.warn('Perfil não encontrado após tentativa com atraso para o usuário:', authData.user.id);
          setLoading(false);
          return {
            error: {
              message: 'Perfil não encontrado. Verifique se sua conta foi aprovada.'
            }
          };
        }
      }

      setLoading(false);
      return { error: null };
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (authError) {
        setLoading(false);
        return { error: authError };
      }

      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const logout = async () => {
    setUser(null);
    setLoading(false);
    await supabase.auth.signOut();
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        updateUser,
        loading,
        initializing
      }}
    >
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
