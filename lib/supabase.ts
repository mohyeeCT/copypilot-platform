import { createBrowserClient } from '@supabase/ssr'

const AUTH_UNAVAILABLE_MESSAGE = 'Authentication service temporarily unavailable'

function missingSupabaseConfig() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function createClient() {
  if (missingSupabaseConfig()) {
    const error = new Error(AUTH_UNAVAILABLE_MESSAGE)
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error }),
        signOut: async () => ({ error: null }),
      },
    } as unknown as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
