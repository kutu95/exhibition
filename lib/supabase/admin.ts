import { createClient } from "@supabase/supabase-js";

import { DEFAULT_DB_TIMEOUT_MS } from "../db-errors";
import { fetchWithTimeout } from "../fetch-with-timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missingEnvMessage = "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";

// WARNING: This client bypasses RLS via the service role key.
// Use only in trusted server-side code (API routes/server actions).
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "exhibition",
      },
      global: {
        fetch: (input, init) => fetchWithTimeout(input, init, DEFAULT_DB_TIMEOUT_MS),
      },
    })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(missingEnvMessage);
        },
      },
    ) as ReturnType<typeof createClient>);
