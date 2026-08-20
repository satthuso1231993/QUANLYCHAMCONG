import { createClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (value: string) => value.replace(/\/rest\/v1\/?$/i, '').trim();

const getEnvOrStored = (envKey: string, storageKey: string): string => {
  const envVal = (import.meta.env[envKey] as string | undefined) || '';
  if (envVal.trim()) return envVal.trim();
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(storageKey);
    if (stored && stored.trim()) return stored.trim();
  }
  return '';
};

export const saveSupabaseConfigToStorage = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('CSGT_SUPABASE_URL', url.trim());
    window.localStorage.setItem('CSGT_SUPABASE_ANON_KEY', anonKey.trim());
  }
};

export const clearSupabaseConfigFromStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('CSGT_SUPABASE_URL');
    window.localStorage.removeItem('CSGT_SUPABASE_ANON_KEY');
  }
};

const rawUrl = getEnvOrStored('VITE_SUPABASE_URL', 'CSGT_SUPABASE_URL');
const rawAnonKey = getEnvOrStored('VITE_SUPABASE_ANON_KEY', 'CSGT_SUPABASE_ANON_KEY');

export const supabaseUrl = rawUrl ? normalizeSupabaseUrl(rawUrl) : '';
export const supabaseAnonKey = rawAnonKey;
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

