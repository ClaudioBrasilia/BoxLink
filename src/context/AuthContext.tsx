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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoading(true);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, retries = 3) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, checkins(*)')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        if (retries > 0) {
          console.log(`Profile not found, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchUserProfile(userId, retries - 1);
        }
        console.warn('Profile not found for user:', userId);
        setUser(null);
        return;
      }
      
      const mappedUser: User = {
        ...data,
        avatar: {
          equipped: data.avatar_equipped,
          inventory: data.avatar_inventory
        },
        checkins: data.checkins || [],
        paidBonuses: data.paid_bonuses || []
      };
      
      setUser(mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
        // Tenta buscar o perfil. Se não encontrar imediatamente, fetchUserProfile já tem retentativas.
        const profile = await fetchUserProfile(authData.user.id);
        
        // Se após as retentativas ainda não existir, pode ser um atraso na trigger do Supabase.
        // Em vez de bloquear o login com erro, permitimos que o estado 'loading' ou o useEffect do App.tsx lidem com isso,
        // ou fornecemos uma mensagem mais clara.
        if (!profile) {
          console.error('Perfil não encontrado após login para o UID:', authData.user.id);
          // Opcional: Você pode optar por criar o perfil aqui se a trigger falhar, 
          // mas por segurança vamos apenas avisar que está sendo preparado.
          setLoading(false);
          return { error: { message: 'Seu perfil está sendo preparado. Por favor, tente entrar novamente em alguns segundos.' } };
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
        options: {
          data: {
            name: name
          }
        }
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
    await supabase.auth.signOut();
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, loading }}>
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
