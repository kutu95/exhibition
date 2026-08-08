import { createClient } from "@supabase/supabase-js";

import { DEFAULT_DB_TIMEOUT_MS } from "../db-errors";
import { fetchWithTimeout } from "../fetch-with-timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingEnvMessage = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY";

/**
 * Cookie-free anon client for public ISR pages.
 * Using `cookies()` via the SSR server client forces the whole route dynamic.
 */
export function createSupabasePublicClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(missingEnvMessage);
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: "exhibition",
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, DEFAULT_DB_TIMEOUT_MS),
    },
  });
}
