import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("Faltan las credenciales de Supabase en .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
