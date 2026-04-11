import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;

export const getSupabase = () => {
  if (!_supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url') {
      const msg = 'Configuração do Supabase ausente ou inválida. Verifique as variáveis de ambiente no menu Settings.';
      console.error(msg);
      // Return a proxy that logs errors instead of throwing
      return new Proxy({}, {
        get: () => () => ({ 
          auth: { 
            getSession: async () => ({ data: { session: null }, error: new Error(msg) }), 
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error(msg) }),
            signUp: async () => ({ data: { user: null, session: null }, error: new Error(msg) }),
            signOut: async () => ({ error: new Error(msg) })
          },
          from: () => ({ 
            select: () => ({ 
              eq: () => ({ 
                single: async () => ({ data: null, error: new Error(msg) }),
                maybeSingle: async () => ({ data: null, error: new Error(msg) })
              }),
              order: () => ({ limit: () => ({ data: [], error: new Error(msg) }) })
            }),
            insert: async () => ({ data: null, error: new Error(msg) }),
            update: async () => ({ data: null, error: new Error(msg) }),
            delete: async () => ({ data: null, error: new Error(msg) })
          })
        })
      });
    }
    if (supabaseAnonKey.startsWith('sb_')) {
      throw new Error("Invalid Supabase Key: It looks like you are using a Stripe key (starting with 'sb_') instead of a Supabase key. Please use the 'anon' key from Supabase Settings -> API.");
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
};

// For backward compatibility while we migrate
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    return (getSupabase() as any)[prop];
  }
});
