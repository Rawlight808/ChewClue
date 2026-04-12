import { createContext, useContext, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './hooks/useAuth'
import { BottomNav } from './components/BottomNav'
import { AuthPage } from './pages/AuthPage'
import { TodayPage } from './pages/TodayPage'
import { LogFoodPage } from './pages/LogFoodPage'
import { CheckinPage } from './pages/CheckinPage'
import { InsightsPage } from './pages/InsightsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { SupportPage } from './pages/SupportPage'
import { refreshReminderScheduling, startReminderScheduler } from './reminders'
import './App.css'

type AuthCtx = {
  user: User | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthCtx>({ user: null, signOut: async () => {} })
export const useAuthContext = () => useContext(AuthContext)

export default function App() {
  const { user, loading, signIn, signUp, signOut, resetPassword } = useAuth()
  const isNativeApp = Capacitor.isNativePlatform()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    startReminderScheduler()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshReminderScheduling().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const loadingScreen = (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <p style={{ color: 'var(--clr-text-muted)' }}>Loading...</p>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route
          path="*"
          element={
            loading ? (
              loadingScreen
            ) : user ? (
              <AuthContext.Provider value={{ user, signOut }}>
                <div className={`app ${isNativeApp ? 'app--native' : ''}`}>
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
              </AuthContext.Provider>
            ) : (
              <AuthPage onSignIn={signIn} onSignUp={signUp} onResetPassword={resetPassword} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
