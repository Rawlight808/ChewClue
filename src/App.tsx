import { createContext, useContext, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from './hooks/useAuth'
import { BottomNav } from './components/BottomNav'
import { AuthPage } from './pages/AuthPage'
import { TodayPage } from './pages/TodayPage'
import { LogFoodPage } from './pages/LogFoodPage'
import { CheckinPage } from './pages/CheckinPage'
import { InsightsPage } from './pages/InsightsPage'
import { SettingsPage } from './pages/SettingsPage'
import { startReminderScheduler } from './reminders'
import './App.css'

type AuthCtx = {
  user: User | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthCtx>({ user: null, signOut: async () => {} })
export const useAuthContext = () => useContext(AuthContext)

export default function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    startReminderScheduler()
  }, [])

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <p style={{ color: 'var(--clr-text-muted)' }}>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      <BrowserRouter>
        <div className="app">
          <div className="app__content">
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/log" element={<LogFoodPage />} />
              <Route path="/checkin" element={<CheckinPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
