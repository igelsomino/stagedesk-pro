import { createClient } from '@supabase/supabase-js'
import type { Session, User } from '@supabase/supabase-js'
import { isTauri } from '@tauri-apps/api/core'

const env = import.meta.env as ImportMetaEnv & {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
}

export const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  ''

export const supabasePublishableKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''

export const authConfigError =
  !supabaseUrl || !supabasePublishableKey
    ? 'Configurazione autenticazione mancante. Imposta VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nell’ambiente di build.'
    : ''

export const supabase = createClient(supabaseUrl || 'https://auth.local.invalid', supabasePublishableKey || 'missing-key', {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    persistSession: true,
  },
})

export type AuthUserType = 'regista' | 'autore' | 'altro'

export type UserProfile = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  user_type: AuthUserType
  user_types?: AuthUserType[] | null
  privacy_accepted_at: string
  terms_accepted_at: string | null
  marketing_consent_at: string | null
  created_at?: string
  updated_at?: string
}

export type AuthState = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  profileComplete: boolean
  signOut: () => Promise<void>
}

export const desktopAuthCallbackUrl = 'stagedeskpro://auth-callback'
export const desktopAuthBridgeUrl = 'https://stagedesk-pro.aigconsulting.it/auth-callback/'

export const isLocalAuthOrigin = () => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.origin)

export const authRedirectUrl = () => {
  if (isLocalAuthOrigin()) return window.location.origin
  return isTauri() ? desktopAuthBridgeUrl : window.location.origin
}

export const usesDesktopAuthCallback = () => isTauri() && !isLocalAuthOrigin()

export const userDisplayName = (user: User | null, profile: UserProfile | null) => {
  if (profile?.first_name || profile?.last_name) return `${profile.first_name} ${profile.last_name}`.trim()
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()
  return user?.email ?? 'Utente'
}

export const normalizeUserTypes = (profile: Pick<UserProfile, 'user_type' | 'user_types'> | null) => {
  const values = profile?.user_types?.length ? profile.user_types : profile?.user_type ? [profile.user_type] : []
  return Array.from(new Set(values.filter((value): value is AuthUserType =>
    value === 'regista' || value === 'autore' || value === 'altro',
  )))
}

export const isProfileComplete = (profile: UserProfile | null) =>
  Boolean(
    profile?.first_name?.trim() &&
    profile.last_name?.trim() &&
    profile.phone?.trim() &&
    normalizeUserTypes(profile).length &&
    profile.privacy_accepted_at,
  )
