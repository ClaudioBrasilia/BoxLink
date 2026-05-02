import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

const ONBOARDING_KEY = 'boxlink_onboarding_done';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  loading: boolean;
  initializing: boolean;
  // Onboarding — controlado aqui para sobreviver a trocas de rota
  showOnboarding: boolean;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const fetchingRef = useRef(false);

  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    if (fetchingRef.current) return null;
    fetchingRef.current = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) { console.error('Supabase query error:', error); return null; }
      if (!data)  { console.warn('Profile not found for user:', userId); return null; }

      const { data: checkinsData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId);

      const mappedUser: User = {
        id: data.id,
        email: data.email,
        name: data.name ?? 'Atleta',
        role: data.role,
        status: data.status ?? 'pending',
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

      // Verifica onboarding só quando o perfil carrega com id real e status aprovado
      if (mappedUser.status === 'approved') {
        const done = localStorage.getItem(ONBOARDING_KEY + '_' + mappedUser.id);
        if (!done) setShowOnboarding(true);
      }

      return mappedUser;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) await fetchUserProfile(session.user.id);
      if (isMounted) setInitializing(false);
    }).catch(() => {
      if (isMounted) setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
        setShowOnboarding(false);
      }
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setLoading(false); return { error: authError }; }
      if (authData.user) {
        const profile = await fetchUserProfile(authData.user.id);
        if (!profile) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retry = await fetchUserProfile(authData.user.id);
          if (!retry) {
            setLoading(false);
            return { error: { message: 'Perfil não encontrado. Verifique se sua conta foi aprovada.' } };
          }
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
        email, password, options: { data: { name } }
      });
      if (authError) { setLoading(false); return { error: authError }; }
      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const logout = async () => {
    setUser(null);
    setShowOnboarding(false);
    await supabase.auth.signOut();
  };

  const updateUser = (userData: User) => setUser(userData);

  const completeOnboarding = () => {
    if (user?.id) localStorage.setItem(ONBOARDING_KEY + '_' + user.id, '1');
    setShowOnboarding(false);
  };

  return (
    <AuthContext.Provider value={{
      user, login, signup, logout, updateUser,
      loading, initializing,
      showOnboarding, completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
