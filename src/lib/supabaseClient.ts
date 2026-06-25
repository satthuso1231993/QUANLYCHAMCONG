import { createClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (value: string) => value.replace(/\/rest\/v1\/?$/i, '');

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

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
