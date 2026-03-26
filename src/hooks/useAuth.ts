import { useEffect, useState } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../supabase'

export type SignUpResult = { error: AuthError | null; needsEmailConfirmation: boolean }

function missingConfigError(): AuthError {
  return {
    name: 'AuthError',
    message:
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example), rebuild, and redeploy.',
  } as AuthError
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('ChewClue: getSession failed', err)
        if (!cancelled) {
          setUser(null)
          setLoading(false)
        }
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    if (!isSupabaseConfigured) {
      return { error: missingConfigError(), needsEmailConfirmation: false }
    }
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}` : undefined
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    })
    if (error) return { error, needsEmailConfirmation: false }
    // Session present → email confirmation is off or user was auto-signed in
    const needsEmailConfirmation = !data.session
    return { error: null, needsEmailConfirmation }
  }

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return missingConfigError()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signUp, signIn, signOut }
}
