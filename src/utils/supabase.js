import { createClient } from '@supabase/supabase-js';

export const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);
  return {
    success: false,
    error: error.message || 'Ocorreu um erro'
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
