import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authRedirectUrl,
  desktopAuthCallbackUrl,
  isLocalAuthOrigin,
  isProfileComplete,
  normalizeUserTypes,
  usesDesktopAuthCallback,
  type UserProfile,
} from './auth'

const setRuntime = (origin: string, tauri = false) => {
  vi.stubGlobal('window', { location: { origin } })
  vi.stubGlobal('isTauri', tauri)
}

describe('auth redirect urls', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps localhost callbacks for browser and tauri dev', () => {
    setRuntime('http://localhost:1420', true)

    expect(isLocalAuthOrigin()).toBe(true)
    expect(authRedirectUrl()).toBe('http://localhost:1420')
    expect(usesDesktopAuthCallback()).toBe(false)
  })

  it('uses the desktop deep link callback in installed tauri builds', () => {
    setRuntime('http://tauri.localhost', true)

    expect(isLocalAuthOrigin()).toBe(false)
    expect(authRedirectUrl()).toBe(desktopAuthCallbackUrl)
    expect(usesDesktopAuthCallback()).toBe(true)
  })

  it('keeps regular web origins outside tauri', () => {
    setRuntime('https://example.com', false)

    expect(authRedirectUrl()).toBe('https://example.com')
    expect(usesDesktopAuthCallback()).toBe(false)
  })
})

describe('auth profile types', () => {
  const profile: UserProfile = {
    id: 'profile-1',
    email: 'utente@example.com',
    first_name: 'Nome',
    last_name: 'Cognome',
    phone: '+3900000000',
    user_type: 'regista',
    user_types: ['regista', 'autore'],
    privacy_accepted_at: '2026-07-10T00:00:00.000Z',
    terms_accepted_at: null,
    marketing_consent_at: null,
  }

  it('keeps multiple selected profiles', () => {
    expect(normalizeUserTypes(profile)).toEqual(['regista', 'autore'])
    expect(isProfileComplete(profile)).toBe(true)
  })

  it('falls back to the legacy single profile', () => {
    expect(normalizeUserTypes({ user_type: 'autore', user_types: null })).toEqual(['autore'])
  })
})
