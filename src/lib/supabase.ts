// src/lib/supabase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

const { supabaseUrl, supabaseAnonKey } = getEnv();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // RN에서는 false 고정
    storage: AsyncStorage,
  },
});
