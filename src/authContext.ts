import { createContext, useContext } from 'react'
import type { AuthState } from './auth'

export const AuthContext = createContext<AuthState | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve essere usato dentro AuthGate')
  return context
}
