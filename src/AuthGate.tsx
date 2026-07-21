import type { AuthError, OAuthResponse, Provider, Session, User } from '@supabase/supabase-js'
import { isTauri } from '@tauri-apps/api/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { Chrome, Cloud, Github, LoaderCircle, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import {
  authRedirectUrl,
  authConfigError,
  isProfileComplete,
  normalizeUserTypes,
  supabase,
  usesDesktopAuthCallback,
  type AuthState,
  type AuthUserType,
  type UserProfile,
} from './auth'
import { AuthContext, useAuth } from './authContext'
import { diagnosticLog } from './diagnostics'

type AuthGateProps = {
  children: ReactNode
}

type ProfileFormState = {
  firstName: string
  lastName: string
  phone: string
  userTypes: AuthUserType[]
  privacyAccepted: boolean
  termsAccepted: boolean
  marketingConsent: boolean
}

type AuthMode = 'signin' | 'signup'
type OAuthProviderConfig = {
  provider: Provider
  label: string
  Icon: typeof Chrome
}

const emptyProfileForm: ProfileFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  userTypes: ['regista'],
  privacyAccepted: false,
  termsAccepted: false,
  marketingConsent: false,
}

const oauthProviders: OAuthProviderConfig[] = [
  { provider: 'google', label: 'Google', Icon: Chrome },
  { provider: 'github', label: 'GitHub', Icon: Github },
  { provider: 'azure', label: 'Azure', Icon: Cloud },
]

const legalLinks = {
  privacy: 'http://stagedesk-pro.aigconsulting.it/informativa-privacy',
  terms: 'http://stagedesk-pro.aigconsulting.it/termini-uso',
} as const

const profileOptions: Array<{ value: AuthUserType; label: string }> = [
  { value: 'regista', label: 'Regista' },
  { value: 'autore', label: 'Autore/Autrice' },
  { value: 'attore', label: 'Attore/Attrice' },
  { value: 'altro', label: 'Altro' },
]

const handledAuthCallbackUrls = new Set<string>()

const cleanAuthCallbackUrl = () => {
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`)
}

const authParamsFromUrl = (rawUrl: string) => {
  const parsed = new URL(rawUrl)
  const params = new URLSearchParams(parsed.search)
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value))
  return params
}

const isPasswordRecoveryCallbackUrl = (rawUrl: string) => {
  try {
    const params = authParamsFromUrl(rawUrl)
    return params.get('mode') === 'recovery' || params.get('type') === 'recovery'
  } catch {
    return false
  }
}

const passwordRecoveryRedirectUrl = () => {
  const url = new URL(authRedirectUrl(), window.location.origin)
  url.searchParams.set('mode', 'recovery')
  return url.toString()
}

const processAuthCallbackUrl = async (rawUrl: string, options: { cleanUrl?: boolean } = {}) => {
  if (handledAuthCallbackUrls.has(rawUrl)) return ''
  const params = authParamsFromUrl(rawUrl)
  const authCode = params.get('code')
  const authError = params.get('error_description') || params.get('error')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!authCode && !authError && !accessToken) return ''

  handledAuthCallbackUrls.add(rawUrl)
  let callbackError = authError ?? ''

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode)
    if (error) callbackError = error.message
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) callbackError = error.message
  }

  if (options.cleanUrl) cleanAuthCallbackUrl()
  return callbackError
}

const clearLocalAuthSession = async () => {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
}

const validatedSession = async (candidate: Session | null) => {
  if (!candidate) return null

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user || data.user.id !== candidate.user.id) {
    await clearLocalAuthSession()
    return null
  }

  return { ...candidate, user: data.user }
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const user = session?.user ?? null
  const profileComplete = isProfileComplete(profile)
  const sessionRef = useRef<Session | null>(session)
  const userRef = useRef<User | null>(user)
  sessionRef.current = session
  userRef.current = user

  useEffect(() => {
    if (authConfigError) {
      setLoading(false)
      return undefined
    }

    let active = true

    const loadSession = async () => {
      if (isPasswordRecoveryCallbackUrl(window.location.href)) setPasswordRecovery(true)
      let callbackError = await processAuthCallbackUrl(window.location.href, { cleanUrl: true })

      if (usesDesktopAuthCallback()) {
        const { getCurrent } = await import('@tauri-apps/plugin-deep-link')
        const urls = await getCurrent()
        if (urls?.length) {
          setMessage('Completamento accesso provider in corso...')
          for (const url of urls) {
            if (isPasswordRecoveryCallbackUrl(url)) setPasswordRecovery(true)
            callbackError = await processAuthCallbackUrl(url)
            if (callbackError) break
          }
        }
      }

      const { data, error } = await supabase.auth.getSession()
      const nextSession = await validatedSession(data.session)
      if (!active) return
      if (error) setMessage(error.message)
      if (data.session && !nextSession) setMessage('Sessione non più valida. Accedi di nuovo.')
      else if (!nextSession && callbackError) setMessage(`Accesso provider non completato: ${callbackError}`)
      setSession(nextSession)
      if (!nextSession) setProfile(null)
      setLoading(false)
    }

    void loadSession()

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      diagnosticLog('auth-state-change', {
        event,
        userId: nextSession?.user.id,
      })
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (!nextSession) {
        setSession(null)
        setProfile(null)
        return
      }

      void validatedSession(nextSession).then((validSession) => {
        if (!active) return
        setSession(validSession)
        if (!validSession) {
          setProfile(null)
          setMessage('Sessione non più valida. Accedi di nuovo.')
        }
      })
    })

    let unlistenDeepLink: (() => void) | undefined
    if (usesDesktopAuthCallback()) {
      void import('@tauri-apps/plugin-deep-link')
        .then(({ onOpenUrl }) =>
          onOpenUrl((urls) => {
            void (async () => {
              setMessage('Completamento accesso provider in corso...')
              let callbackError = ''
              for (const url of urls) {
                if (isPasswordRecoveryCallbackUrl(url)) setPasswordRecovery(true)
                callbackError = await processAuthCallbackUrl(url)
                if (callbackError) break
              }

              const { data: sessionData, error } = await supabase.auth.getSession()
              const validSession = await validatedSession(sessionData.session)
              if (!active) return
              if (error) setMessage(error.message)
              else if (sessionData.session && !validSession) setMessage('Sessione non più valida. Accedi di nuovo.')
              else if (!validSession && callbackError) setMessage(`Accesso provider non completato: ${callbackError}`)
              else if (!callbackError) setMessage('')
              setSession(validSession)
              if (!validSession) setProfile(null)
            })()
          }),
        )
        .then((unlisten) => {
          unlistenDeepLink = unlisten
        })
        .catch((error: Error) => {
          if (active) setMessage(`Deep link autenticazione non disponibile: ${error.message}`)
        })
    }

    return () => {
      active = false
      data.subscription.unsubscribe()
      unlistenDeepLink?.()
    }
  }, [])

  useEffect(() => {
    const currentSession = sessionRef.current
    const currentUser = userRef.current
    const userId = currentUser?.id ?? ''
    if (!currentSession || !currentUser || !userId) return
    let active = true
    diagnosticLog('profile-load-start', { userId })
    setProfileLoading(true)
    setProfile(null)
    setMessage('')

    const loadValidatedProfile = async () => {
      const validSession = await validatedSession(currentSession)
      if (!validSession || validSession.user.id !== userId) return undefined
      return loadProfile(validSession.user)
    }

    loadValidatedProfile()
      .then((loadedProfile) => {
        if (!active) return
        if (loadedProfile === undefined) {
          diagnosticLog('profile-load-invalid-session', { userId })
          setSession(null)
          setProfile(null)
          setMessage('Sessione non più valida. Accedi di nuovo.')
          return
        }
        diagnosticLog('profile-load-complete', { userId, complete: isProfileComplete(loadedProfile) })
        setProfile(loadedProfile)
      })
      .catch((error: Error) => {
        diagnosticLog('profile-load-error', { userId, message: error.message })
        if (active) setMessage(`Profilo non disponibile: ${error.message}`)
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.id])

  const authState = useMemo<AuthState>(() => ({
    session,
    user,
    profile,
    profileComplete,
    signOut: async () => {
      await supabase.auth.signOut()
      setProfile(null)
      setPasswordRecovery(false)
    },
  }), [profile, profileComplete, session, user])

  if (authConfigError) {
    return <AuthShell title="Configurazione richiesta" subtitle={authConfigError} />
  }

  if (loading) {
    return <AuthShell title="Accesso" subtitle="Verifica sessione in corso..." />
  }

  if (!session || !user) {
    return (
      <AuthShell title="StageDesk Pro" subtitle="Autenticazione obbligatoria">
        <AuthPanel message={message} onMessage={setMessage} />
      </AuthShell>
    )
  }

  if (passwordRecovery) {
    return (
      <AuthShell title="Reimposta password" subtitle="Scegli una nuova password per il tuo account.">
        <PasswordRecoveryPanel
          onCompleted={(nextMessage) => {
            setPasswordRecovery(false)
            setMessage(nextMessage)
          }}
        />
      </AuthShell>
    )
  }

  if (profileLoading) {
    return <AuthShell title="Profilo" subtitle="Caricamento dati utente..." />
  }

  if (!profileComplete) {
    return (
      <AuthShell title="Completa il profilo" subtitle="I dati sono obbligatori per usare l'applicazione.">
        <ProfilePanel user={user} profile={profile} message={message} onMessage={setMessage} onSaved={setProfile} />
      </AuthShell>
    )
  }

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
}

export function SignOutButton() {
  const { signOut } = useAuth()

  return (
    <button type="button" className="topbar-button" onClick={() => void signOut()}>
      <LogOut size={16} />
      Esci
    </button>
  )
}

function AuthPanel({
  message,
  onMessage,
}: {
  message: string
  onMessage: (message: string) => void
}) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [oauthBusyProvider, setOauthBusyProvider] = useState<Provider | ''>('')
  const [oauthRedirectUrl, setOauthRedirectUrl] = useState('')
  const [resetRequestMode, setResetRequestMode] = useState(false)
  const [form, setForm] = useState<ProfileFormState>(emptyProfileForm)
  const busy = formBusy || Boolean(oauthBusyProvider)

  if (resetRequestMode) {
    return (
      <PasswordResetRequestPanel
        onBack={() => setResetRequestMode(false)}
      />
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onMessage('')
    setOauthRedirectUrl('')
    setFormBusy(true)

    try {
      if (mode === 'signin') {
        onMessage('Accesso in corso...')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        if (!form.privacyAccepted) throw new Error('Accettazione privacy obbligatoria')
        if (!form.userTypes.length) throw new Error('Seleziona almeno un profilo')
        const acceptedAt = new Date().toISOString()
        onMessage('Creazione account in corso...')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: form.firstName.trim(),
              last_name: form.lastName.trim(),
              phone: form.phone.trim(),
              user_type: form.userTypes[0],
              user_types: form.userTypes,
              privacy_accepted_at: acceptedAt,
              terms_accepted_at: form.termsAccepted ? acceptedAt : null,
              marketing_consent_at: form.marketingConsent ? acceptedAt : null,
            },
            emailRedirectTo: authRedirectUrl(),
          },
        })
        if (error) throw error
        if (data.session && data.user) await saveProfile(data.user, form)
        if (!data.session) onMessage('Registrazione creata. Controlla la mail per confermare l’account.')
      }
    } catch (error) {
      onMessage(authErrorMessage(error))
    } finally {
      setFormBusy(false)
    }
  }

  const oauthLogin = async ({ provider, label }: OAuthProviderConfig) => {
    onMessage(`Apertura accesso ${label}...`)
    setOauthRedirectUrl('')
    setOauthBusyProvider(provider)

    try {
      const result: OAuthResponse = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: authRedirectUrl(),
          skipBrowserRedirect: true,
        },
      })
      if (result.error) throw result.error
      if (!result.data.url) throw new Error(`Redirect ${label} non disponibile`)

      setOauthRedirectUrl(result.data.url)
      onMessage(`Reindirizzamento a ${label} in corso...`)
      await openAuthProviderUrl(result.data.url)
      window.setTimeout(() => {
        setOauthBusyProvider('')
        onMessage(`Se il reindirizzamento a ${label} non si apre, usa il link manuale sotto.`)
      }, 7000)
    } catch (error) {
      setOauthBusyProvider('')
      onMessage(authErrorMessage(error))
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="tablist">
        <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
          Accedi
        </button>
        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
          Registrati
        </button>
      </div>

      <div className="auth-social">
        {oauthProviders.map(({ provider, label, Icon }) => {
          const active = oauthBusyProvider === provider
          return (
            <button
              type="button"
              key={provider}
              onClick={() => void oauthLogin({ provider, label, Icon })}
              disabled={busy}
              aria-busy={active}
              className={active ? 'loading' : ''}
            >
              {active ? <LoaderCircle size={16} className="spin-icon" /> : <Icon size={16} />}
              {active ? 'Attendi...' : label}
            </button>
          )
        })}
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>oppure con e-mail</span>
      </div>

      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        {mode === 'signin' ? (
          <button
            type="button"
            className="auth-recovery-link"
            onClick={() => {
              onMessage('')
              setResetRequestMode(true)
            }}
          >
            Password dimenticata?
          </button>
        ) : null}

        {mode === 'signup' ? (
          <ProfileFields form={form} onChange={setForm} />
        ) : null}

        <button type="submit" className="primary" disabled={busy}>
          <LogIn size={16} />
          {mode === 'signin' ? 'Accedi' : 'Crea account'}
        </button>
      </form>

      {message ? <p className="auth-message">{message}</p> : null}
      {oauthRedirectUrl ? (
        <a
          className="auth-fallback-link"
          href={oauthRedirectUrl}
          onClick={(event) => {
            event.preventDefault()
            void openAuthProviderUrl(oauthRedirectUrl)
          }}
        >
          Apri accesso provider
        </a>
      ) : null}
    </div>
  )
}

function PasswordResetRequestPanel({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('Invio del link in corso...')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: passwordRecoveryRedirectUrl(),
    })
    setBusy(false)
    setMessage(error ? authErrorMessage(error) : 'Se l’indirizzo è registrato, riceverai un link per impostare una nuova password.')
  }

  return (
    <div className="auth-recovery-panel">
      <h2>Recupera password</h2>
      <p>Inserisci l’indirizzo e-mail del tuo account. Riceverai un link per impostare una nuova password.</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Invio in corso...' : 'Invia link di recupero'}
        </button>
      </form>
      {message ? <p className="auth-message">{message}</p> : null}
      <button type="button" className="auth-recovery-link" onClick={onBack}>Torna all’accesso</button>
    </div>
  )
}

function PasswordRecoveryPanel({ onCompleted }: { onCompleted: (message: string) => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) {
      setMessage('La password deve contenere almeno 8 caratteri.')
      return
    }
    if (password !== confirmation) {
      setMessage('Le password non coincidono.')
      return
    }
    setBusy(true)
    setMessage('Aggiornamento password in corso...')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setBusy(false)
      setMessage(authErrorMessage(error))
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
    onCompleted('Password aggiornata. Accedi con la nuova password.')
  }

  return (
    <div className="auth-recovery-panel">
      <h2>Nuova password</h2>
      <p>Imposta una nuova password di almeno 8 caratteri.</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>
          Nuova password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Conferma password
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Salvataggio in corso...' : 'Salva nuova password'}
        </button>
      </form>
      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  )
}

const openAuthProviderUrl = async (url: string) => {
  if (!usesDesktopAuthCallback()) {
    window.location.assign(url)
    return
  }

  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } catch {
    window.location.assign(url)
  }
}

const openLegalLink = async (href: string) => {
  const url = new URL(href).toString()

  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

const handleLegalLinkClick = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  event.preventDefault()
  event.stopPropagation()
  void openLegalLink(href).catch((error: Error) => {
    console.error('Apertura collegamento legale non riuscita', error)
    window.open(href, '_blank', 'noopener,noreferrer')
  })
}

function ProfilePanel({
  user,
  profile,
  message,
  onMessage,
  onSaved,
}: {
  user: User
  profile: UserProfile | null
  message: string
  onMessage: (message: string) => void
  onSaved: (profile: UserProfile) => void
}) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<ProfileFormState>(() => profileFormFromUser(user, profile))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onMessage('Salvataggio profilo in corso...')
    setBusy(true)
    try {
      const saved = await saveProfile(user, form)
      onSaved(saved)
    } catch (error) {
      onMessage(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-panel">
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <ProfileFields form={form} onChange={setForm} />
        <button type="submit" className="primary" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin-icon" /> : <ShieldCheck size={16} />}
          {busy ? 'Salvataggio...' : 'Salva e continua'}
        </button>
      </form>
      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  )
}

function ProfileFields({
  form,
  onChange,
}: {
  form: ProfileFormState
  onChange: (form: ProfileFormState) => void
}) {
  return (
    <fieldset className="profile-fields">
      <label>
        Nome
        <input
          value={form.firstName}
          onChange={(event) => onChange({ ...form, firstName: event.target.value })}
          required
        />
      </label>
      <label>
        Cognome
        <input
          value={form.lastName}
          onChange={(event) => onChange({ ...form, lastName: event.target.value })}
          required
        />
      </label>
      <label>
        Recapito telefonico
        <input
          type="tel"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value })}
          required
        />
      </label>
      <div className="auth-field">
        <span>Profilo</span>
        <details className="auth-profile-dropdown">
          <summary>
            {form.userTypes.length
              ? profileOptions.filter((option) => form.userTypes.includes(option.value)).map((option) => option.label).join(', ')
              : 'Seleziona uno o più profili'}
          </summary>
          <span className="auth-choice-list">
            {profileOptions.map((option) => {
              const checked = form.userTypes.includes(option.value)
              return (
                <label className="auth-choice" key={option.value}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextTypes = event.target.checked
                        ? [...form.userTypes, option.value]
                        : form.userTypes.filter((value) => value !== option.value)
                      onChange({ ...form, userTypes: Array.from(new Set(nextTypes)) })
                    }}
                  />
                  {option.label}
                </label>
              )
            })}
          </span>
        </details>
      </div>
      <label className="auth-check">
        <input
          type="checkbox"
          checked={form.privacyAccepted}
          onChange={(event) => onChange({ ...form, privacyAccepted: event.target.checked })}
          required
        />
        <span>
          Accetto l’{' '}
          <a
            href={legalLinks.privacy}
            target="_blank"
            rel="noreferrer"
            onClick={handleLegalLinkClick(legalLinks.privacy)}
          >
            informativa privacy
          </a>
        </span>
      </label>
      <label className="auth-check">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(event) => onChange({ ...form, termsAccepted: event.target.checked })}
        />
        <span>
          Accetto i{' '}
          <a
            href={legalLinks.terms}
            target="_blank"
            rel="noreferrer"
            onClick={handleLegalLinkClick(legalLinks.terms)}
          >
            termini d’uso
          </a>
        </span>
      </label>
      <label className="auth-check">
        <input
          type="checkbox"
          checked={form.marketingConsent}
          onChange={(event) => onChange({ ...form, marketingConsent: event.target.checked })}
        />
        Acconsento alle comunicazioni informative
      </label>
    </fieldset>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true"><UserRound size={22} /></span>
          <div>
            <p>{subtitle}</p>
            <h1>{title}</h1>
          </div>
        </div>
        {children}
      </section>
    </main>
  )
}

const loadProfile = async (user: User) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name,phone,user_type,user_types,privacy_accepted_at,terms_accepted_at,marketing_consent_at,created_at,updated_at')
    .eq('id', user.id)
    .maybeSingle<UserProfile>()

  if (error && isMissingUserTypesColumn(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,phone,user_type,privacy_accepted_at,terms_accepted_at,marketing_consent_at,created_at,updated_at')
      .eq('id', user.id)
      .maybeSingle<UserProfile>()
    if (legacyError) throw legacyError
    return legacyData ? syncProfileTypesFromMetadata(user, legacyData) : legacyData
  }

  if (error) throw error
  return data ? syncProfileTypesFromMetadata(user, data) : data
}

const saveProfile = async (user: User, form: ProfileFormState) => {
  if (!form.privacyAccepted) throw new Error('Accettazione privacy obbligatoria')
  if (!form.userTypes.length) throw new Error('Seleziona almeno un profilo')

  const now = new Date().toISOString()
  const payload: UserProfile = {
    id: user.id,
    email: user.email ?? '',
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    phone: form.phone.trim(),
    user_type: form.userTypes[0],
    user_types: form.userTypes,
    privacy_accepted_at: now,
    terms_accepted_at: form.termsAccepted ? now : null,
    marketing_consent_at: form.marketingConsent ? now : null,
  }

  if (!payload.first_name || !payload.last_name || !payload.phone) {
    throw new Error('Nome, cognome e recapito telefonico sono obbligatori')
  }

  const { data, error } = await supabase.from('profiles').upsert(payload).select().single<UserProfile>()
  if (error && isMissingUserTypesColumn(error)) {
    throw new Error('Schema profili Supabase non aggiornato: esegui la migrazione docs/supabase-auth.sql per abilitare profili multipli.')
  }
  if (error) throw error
  await syncUserMetadata(user, form, now)
  return data
}

const isMissingUserTypesColumn = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('user_types')
}

const syncProfileTypesFromMetadata = async (user: User, profile: UserProfile) => {
  if (profile.user_types?.length) return profile

  const metadataTypes = userTypesArrayFromMetadata(user)
  if (!metadataTypes.length) return profile
  if (sameUserTypes(normalizeUserTypes(profile), metadataTypes)) return profile

  const { data, error } = await supabase
    .from('profiles')
    .update({
      user_type: metadataTypes[0],
      user_types: metadataTypes,
    })
    .eq('id', user.id)
    .select('id,email,first_name,last_name,phone,user_type,user_types,privacy_accepted_at,terms_accepted_at,marketing_consent_at,created_at,updated_at')
    .single<UserProfile>()

  if (error && isMissingUserTypesColumn(error)) return profile
  if (error) throw error
  return data
}

const profileFormFromUser = (user: User, profile: UserProfile | null): ProfileFormState => {
  const metadata = user.user_metadata
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  const [firstNameFromMetadata, ...lastNameFromMetadata] = fullName.split(/\s+/).filter(Boolean)

  return {
    firstName: profile?.first_name ?? (typeof metadata?.first_name === 'string' ? metadata.first_name : firstNameFromMetadata ?? ''),
    lastName: profile?.last_name ?? (typeof metadata?.last_name === 'string' ? metadata.last_name : lastNameFromMetadata.join(' ')),
    phone: profile?.phone ?? (typeof metadata?.phone === 'string' ? metadata.phone : ''),
    userTypes: userTypesFromProfile(user, profile),
    privacyAccepted: Boolean(profile?.privacy_accepted_at),
    termsAccepted: Boolean(profile?.terms_accepted_at),
    marketingConsent: Boolean(profile?.marketing_consent_at),
  }
}

const userTypesFromProfile = (user: User, profile: UserProfile | null): AuthUserType[] => {
  const profileTypes = normalizeUserTypes(profile)
  if (profileTypes.length) return profileTypes

  const metadataTypes = userTypesFromMetadata(user)
  if (metadataTypes.length) return metadataTypes
  return ['regista']
}

const userTypesFromMetadata = (user: User): AuthUserType[] => {
  const metadataTypes = userTypesArrayFromMetadata(user)
  if (metadataTypes.length) return metadataTypes

  const metadata = user.user_metadata
  if (metadata?.user_type === 'regista' || metadata?.user_type === 'autore' || metadata?.user_type === 'attore' || metadata?.user_type === 'altro') {
    return [metadata.user_type]
  }
  return []
}

const userTypesArrayFromMetadata = (user: User): AuthUserType[] => {
  const metadata = user.user_metadata
  if (Array.isArray(metadata?.user_types)) {
    const metadataTypes = metadata.user_types.filter((value): value is AuthUserType =>
      value === 'regista' || value === 'autore' || value === 'attore' || value === 'altro',
    )
    if (metadataTypes.length) return Array.from(new Set(metadataTypes))
  }
  return []
}

const syncUserMetadata = async (user: User, form: ProfileFormState, acceptedAt: string) => {
  const existing = user.user_metadata ?? {}
  const nextMetadata = {
    ...existing,
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    phone: form.phone.trim(),
    user_type: form.userTypes[0],
    user_types: form.userTypes,
    privacy_accepted_at: existing.privacy_accepted_at ?? acceptedAt,
    terms_accepted_at: form.termsAccepted ? (existing.terms_accepted_at ?? acceptedAt) : null,
    marketing_consent_at: form.marketingConsent ? (existing.marketing_consent_at ?? acceptedAt) : null,
  }

  const { error } = await supabase.auth.updateUser({ data: nextMetadata })
  if (error) throw error
}

const sameUserTypes = (left: AuthUserType[], right: AuthUserType[]) => {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

const authErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('relation') && message.includes('profiles')) {
    return 'Tabella profili non configurata in Supabase. Esegui lo script docs/supabase-auth.sql nel SQL Editor.'
  }
  return (error as AuthError)?.message ?? message
}
