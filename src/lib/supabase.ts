// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.');
}

// No app nativo (Capacitor), usa localStorage como storage de sessão
const options: any = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
export const getSupabase = () => supabase;
