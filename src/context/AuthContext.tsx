import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AvatarSlot } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  setUser: (user: User | null) => void;
  fetchUserProfile: (userId: string) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const fetchingRef = useRef(false);

  const fetchUserProfile = async (userId: string) => {
    if (fetchingRef.current) return null;
    fetchingRef.current = true;

    try {
      const [{ data, error }, { data: checkinsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('checkins')
          .select('*')
          .eq('user_id', userId)
      ]);

      if (error) {
        console.error('Supabase query error:', error);
        return null;
      }

      if (!data) {
        console.log('No profile found for UID:', userId);
        return null;
      }

      // Avatar padrão se nenhum estiver equipado
      const defaultAvatar: AvatarSlot = {
        base_outfit: 'base_light',
        top: null,
        bottom: null,
        shoes: null,
        accessory: null,
        head_accessory: null,
        wrist_accessory: null,
        special: null
      };

      const mappedUser: User = {
        id: data.id,
        email: data.email || '',
        name: data.name || 'Atleta',
        role: data.role || 'aluno',
        xp: data.xp || 0,
        coins: data.coins || 0,
        level: data.level || 1,
        avatar: {
          equipped: data.avatar_equipped || defaultAvatar,
          inventory: data.avatar_inventory || []
        },
        checkins: (checkinsData || []).map((c: any) => ({
          date: c.date,
          workoutId: c.workout_id
        })),
        stats: data.stats || {}
      };

      setUser(mappedUser);
      return mappedUser;
    } catch (err) {
      console.error('Fetch error:', err);
      return null;
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let profileSubscription: any = null;

    const setupAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          await fetchUserProfile(session.user.id);
          
          // Setup real-time listener para o perfil
          profileSubscription = supabase
            .channel(`profile_changes_${session.user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${session.user.id}`
              },
              () => {
                fetchUserProfile(session.user.id);
              }
            )
            .subscribe();
        }
      } catch (error) {
        console.error('Auth setup error:', error);
      } finally {
        if (isMounted) setInitializing(false);
      }
    };

    setupAuth();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserProfile(session.user.id);
        
        if (!profileSubscription) {
          profileSubscription = supabase
            .channel(`profile_changes_${session.user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${session.user.id}`
              },
              () => {
                fetchUserProfile(session.user.id);
              }
            )
            .subscribe();
        }
      } else if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
        if (profileSubscription) {
          supabase.removeChannel(profileSubscription);
          profileSubscription = null;
        }
      }
    });

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, initializing, setUser, fetchUserProfile }}>
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
}
