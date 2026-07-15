import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { DEFAULT_DB_TIMEOUT_MS } from "../db-errors";
import { fetchWithTimeout } from "../fetch-with-timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingEnvMessage = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY";

export const createSupabaseServerClient = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(missingEnvMessage);
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can fail in contexts where cookies are read-only.
        }
      },
    },
    db: {
      schema: "exhibition",
    },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, DEFAULT_DB_TIMEOUT_MS),
    },
  });
};

export const createClient = createSupabaseServerClient;
