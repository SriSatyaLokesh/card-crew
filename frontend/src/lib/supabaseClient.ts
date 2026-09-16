import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing; auth will not work.");
}

const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

export { supabase };
