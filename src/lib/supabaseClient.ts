import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseUrl = (
  (typeof process !== 'undefined' && process.env ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) : null) ||
  (import.meta && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : null) ||
  ''
).trim();

const supabaseAnonKey = (
  (typeof process !== 'undefined' && process.env ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) : null) ||
  (import.meta && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : null) ||
  ''
).trim();

// Automatically sanitize URL if it includes the API path suffix
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -'/rest/v1/'.length);
} else if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -'/rest/v1'.length);
}

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client initialized successfully with URL:', supabaseUrl);
  } catch (err) {
    console.warn('⚠️ Supabase initialization error, falling back to local mode:', err);
  }
} else {
  console.info('ℹ️ Supabase environment variables not configured. Running in high-performance local mode with in-memory sync.');
}

export const supabase = supabaseInstance;
