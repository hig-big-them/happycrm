/**
 * Supabase Service Role Client
 *
 * This client is intended for server-side use only, with elevated privileges.
 * Never expose this client or its keys to the browser.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type Database } from '../../../types/supabase'

export function createServiceRoleClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      'Missing Supabase environment variables for service role client'
    )
  }

  // Note: this assumes that you have a `SUPABASE_SERVICE_ROLE_KEY` environment variable set.
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Legacy alias for backward compatibility
export const createClient = createServiceRoleClient
export const createServiceClient = createServiceRoleClient