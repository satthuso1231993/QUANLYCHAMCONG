import { createClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (value: string) => value.replace(/\/rest\/v1\/?$/i, '').trim();

export const DEFAULT_SUPABASE_URL = 'https://erylrvplknqzxuyetpgq.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_wOJ_c-xEHWuMmZEJez610Q_TxyqVuqB';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const supabaseUrl = normalizeSupabaseUrl(rawUrl);
export const supabaseAnonKey = rawAnonKey.trim();
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});


