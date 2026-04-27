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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session fetch error:', error);
        if (error.message.includes('fetch')) {
          // This will be caught by ErrorBoundary if we re-throw or handle it
        }
      }
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('Critical Auth Error:', err);
      setLoading(false);
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
        name: data.name,
        role: data.role,
        status: data.status,
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
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cria um perfil manualmente como fallback
   * Usado quando o trigger automático falha
   */
  const createProfileFallback = async (userId: string, email: string, name?: string) => {
    try {
      console.log('Attempting fallback profile creation for user:', userId);
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: name || 'Novo Atleta',
          email: email,
          role: 'athlete',
          status: 'pending'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Fallback profile creation error:', createError);
        return null;
      }
      
      console.log('Fallback profile created successfully:', newProfile);
      return newProfile;
    } catch (error) {
      console.error('Fallback profile creation exception:', error);
      return null;
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (authError) {
        console.error('Auth error:', authError);
        setLoading(false);
        return { error: authError };
      }
      
      if (authData.user) {
        // Tentar buscar perfil com múltiplos retries
        let profile = null;
        const maxRetries = 3;
        const baseDelayMs = 300;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          console.log(`Fetching profile attempt ${attempt + 1}/${maxRetries} for user: ${authData.user.id}`);
          
          profile = await fetchUserProfile(authData.user.id);
          if (profile) {
            console.log('Profile found successfully');
            break;
          }
          
          // Delay exponencial entre tentativas
          if (attempt < maxRetries - 1) {
            const delayMs = baseDelayMs * Math.pow(2, attempt);
            console.log(`Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
        
        // Se ainda não encontrou, tentar criar perfil como fallback
        if (!profile) {
          console.warn('Profile not found after retries, attempting fallback creation');
          
          const fallbackProfile = await createProfileFallback(
            authData.user.id,
            authData.user.email || email,
            authData.user.user_metadata?.name
          );
          
          if (fallbackProfile) {
            // Tentar buscar novamente após criação
            profile = await fetchUserProfile(authData.user.id);
          }
        }
        
        if (!profile) {
          console.error('Failed to retrieve or create profile for user:', authData.user.id);
          setLoading(false);
          return { error: { message: 'Perfil não encontrado. Verifique se sua conta foi aprovada.' } };
        }
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Login exception:', error);
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
        console.error('Signup auth error:', authError);
        setLoading(false);
        return { error: authError };
      }
      
      // Após signup bem-sucedido, tentar criar perfil manualmente como backup
      // (o trigger deveria fazer isso, mas temos fallback)
      if (authData.user) {
        console.log('Signup successful, user created:', authData.user.id);
        
        // Pequeno delay para garantir que o trigger teve tempo de executar
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verificar se o perfil foi criado
        const profile = await fetchUserProfile(authData.user.id);
        
        if (!profile) {
          console.warn('Profile not created by trigger, attempting fallback');
          await createProfileFallback(authData.user.id, email, name);
        }
      }
      
      setLoading(false);
      return { error: null };
    } catch (error: any) {
      console.error('Signup exception:', error);
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
