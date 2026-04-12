import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SignUpResult } from '../hooks/useAuth'

type Props = {
  onSignIn: (email: string, password: string) => Promise<Error | null>
  onSignUp: (email: string, password: string) => Promise<SignUpResult>
  onResetPassword: (email: string) => Promise<Error | null>
}

export function AuthPage({ onSignIn, onSignUp, onResetPassword }: Props) {
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'reset'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')

  const switchMode = (next: 'signIn' | 'signUp' | 'reset') => {
    setMode(next)
    setError('')
    setConfirmMsg('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmMsg('')
    setLoading(true)

    if (mode === 'reset') {
      const err = await onResetPassword(email)
      setLoading(false)
      if (err) {
        setError(err.message)
      } else {
        setConfirmMsg('Check your email for a password reset link.')
      }
      return
    }

    if (mode === 'signUp') {
      const { error, needsEmailConfirmation } = await onSignUp(email, password)
      setLoading(false)
      if (error) {
        setError(error.message)
      } else if (needsEmailConfirmation) {
        setConfirmMsg('Check your email for a confirmation link, then sign in here.')
      }
    } else {
      const err = await onSignIn(email, password)
      setLoading(false)
      if (err) setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">🔍🍽️</span>
          <h1 className="auth-title">ChewClue</h1>
          <p className="auth-subtitle">
            {mode === 'reset' ? 'Reset your password' : 'Track food. Find triggers. Feel better.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {mode !== 'reset' && (
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            />
          )}

          {error && <p className="auth-error">{error}</p>}
          {confirmMsg && <p className="auth-confirm">{confirmMsg}</p>}

          <button
            className="btn btn--primary btn--full"
            type="submit"
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading
              ? '...'
              : mode === 'signUp'
                ? 'Create Account'
                : mode === 'reset'
                  ? 'Send Reset Link'
                  : 'Sign In'}
          </button>
        </form>

        {mode === 'signIn' && (
          <button className="auth-toggle" onClick={() => switchMode('reset')}>
            Forgot password?
          </button>
        )}

        {mode === 'reset' ? (
          <button className="auth-toggle" onClick={() => switchMode('signIn')}>
            Back to sign in
          </button>
        ) : (
          <button
            className="auth-toggle"
            onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
          >
            {mode === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        )}

        <p className="auth-legal">
          <Link to="/support">Support</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
