import { createClient } from '@supabase/supabase-js';

// Using Vite's special import.meta.env syntax
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env variables. Check your .env file!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);