import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;

export const getSupabase = () => {
  if (!_supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url') {
      const msg = 'Configuração do Supabase ausente ou inválida. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente (ex.: painel da Vercel) e faça o redeploy.';
      console.error(msg);
      // Mock que degrada com segurança: expõe .auth e .from com o MESMO formato
      // do cliente real, para a app mostrar a tela de login em vez de quebrar.
      const err = () => new Error(msg);
      const queryResult = { data: null, error: err() };
      const listResult = { data: [] as any[], error: err() };
      const filterChain: any = {
        eq: () => filterChain,
        neq: () => filterChain,
        gte: () => filterChain,
        lte: () => filterChain,
        in: () => filterChain,
        order: () => filterChain,
        limit: async () => listResult,
        single: async () => queryResult,
        maybeSingle: async () => queryResult,
        then: (resolve: (v: typeof listResult) => void) => resolve(listResult),
      };
      const fromMock = () => ({
        select: () => filterChain,
        insert: async () => queryResult,
        update: () => filterChain,
        delete: () => filterChain,
        upsert: async () => queryResult,
      });
      const mock = {
        auth: {
          getSession: async () => ({ data: { session: null }, error: err() }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ data: { user: null, session: null }, error: err() }),
          signUp: async () => ({ data: { user: null, session: null }, error: err() }),
          signOut: async () => ({ error: err() }),
        },
        from: fromMock,
      };
      return mock;
    }
    if (supabaseAnonKey.startsWith('sb_')) {
      throw new Error("Invalid Supabase Key: It looks like you are using a Stripe key (starting with 'sb_') instead of a Supabase key. Please use the 'anon' key from Supabase Settings -> API.");
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // importante para Capacitor
        storage: window.localStorage,
      }
    });
  }
  return _supabase;
};

// For backward compatibility while we migrate
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    return (getSupabase() as any)[prop];
  }
});
