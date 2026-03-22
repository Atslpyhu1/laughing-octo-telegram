import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabase: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client using the service role key.
 * The service role key bypasses RLS — use only on the server side.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

/**
 * Returns a Supabase client scoped to a specific agency via RLS.
 * Uses the anon key with a custom JWT claim for agency_id.
 */
export function getAgencyScopedClient(agencyId: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        'x-agency-id': agencyId,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
