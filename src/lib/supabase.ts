import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;

export const getSupabase = () => {
  if (!_supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'ERRO: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas. Crie um arquivo .env na raiz do projeto com essas variáveis.'
      );
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
