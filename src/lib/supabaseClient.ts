import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Supabase initialization error, falling back to local mode:', err);
  }
} else {
  console.info('ℹ️ Supabase environment variables not configured. Running in high-performance local mode with in-memory sync.');
}

export const supabase = supabaseInstance;
