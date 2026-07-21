import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Surface a clear message instead of cryptic runtime errors when the app is
// built without its Supabase credentials configured.
export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env (local) or set the repo secrets (deploy).'
  )
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key')

// Name of the private Storage bucket that holds all uploaded file blobs.
export const BUCKET = 'files'
