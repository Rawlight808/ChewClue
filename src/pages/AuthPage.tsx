import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SignUpResult } from '../hooks/useAuth'

type Props = {
  onSignIn: (email: string, password: string) => Promise<Error | null>
  onSignUp: (email: string, password: string) => Promise<SignUpResult>
}

export function AuthPage({ onSignIn, onSignUp }: Props) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmMsg('')
    setLoading(true)

    if (isSignUp) {
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
          <p className="auth-subtitle">Track food. Find triggers. Feel better.</p>
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
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />

          {error && <p className="auth-error">{error}</p>}
          {confirmMsg && <p className="auth-confirm">{confirmMsg}</p>}

          <button
            className="btn btn--primary btn--full"
            type="submit"
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          className="auth-toggle"
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setConfirmMsg('') }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        <p className="auth-legal">
          <Link to="/support">Support</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
