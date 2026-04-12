import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { getReminderSettings, saveReminderSettings, resetLocalAppData } from '../store'
import { clearCustomTags } from '../customTags'
import { resetCheckinMetricTemplate } from '../checkinCategories'
import { cloudResetAllData } from '../cloudStore'
import { useAuthContext } from '../App'
import {
  getReminderPermissionStatus,
  refreshReminderScheduling,
  requestReminderPermission,
  type ReminderPermission,
} from '../reminders'

function useNotificationStatus() {
  const [status, setStatus] = useState<ReminderPermission>('default')

  const refresh = async () => {
    setStatus(await getReminderPermissionStatus())
  }

  useEffect(() => {
    refresh().catch(() => setStatus('unsupported'))
  }, [])

  return { status, refresh }
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isNativeApp = Capacitor.isNativePlatform()
export function SettingsPage() {
  const { user, signOut } = useAuthContext()
  const [settings, setSettings] = useState(() => getReminderSettings())
  const [resetting, setResetting] = useState(false)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const { status: notifStatus, refresh: refreshNotif } = useNotificationStatus()

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveReminderSettings(next)
    refreshReminderScheduling().catch(() => {})
  }

  const requestNotificationPermission = async () => {
    const result = await requestReminderPermission()
    await refreshNotif()
    if (result === 'granted') {
      await refreshReminderScheduling().catch(() => {})
      if ('Notification' in window) {
        new Notification('ChewClue', { body: 'Reminders are now enabled!' })
      }
    } else if (result === 'unsupported') {
      alert('This device does not support notifications.')
    }
  }

  const handleReset = async () => {
    const ok = window.confirm(
      'Start over and delete all your meals, check-ins, and local preferences? This cannot be undone.',
    )
    if (!ok || resetting) return

    setResetting(true)
    setResetNotice(null)
    try {
      await cloudResetAllData()
      resetLocalAppData()
      clearCustomTags()
      resetCheckinMetricTemplate()
      const defaults = getReminderSettings()
      setSettings(defaults)
      setResetNotice('All data reset. You can start fresh now.')
    } catch {
      setResetNotice('Could not reset right now. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Reminders & preferences</p>
      </div>

      <div className="card">
        <div className="card__label">Daily Reminders</div>

        {notifStatus === 'granted' ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--clr-green)', fontWeight: 600, marginBottom: '0.75rem' }}>
            Notifications enabled
          </p>
        ) : notifStatus === 'denied' ? (
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--clr-red)', marginBottom: '0.25rem' }}>
              Notifications are blocked.
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
              {isIOS
                ? isNativeApp
                  ? 'Open iPhone Settings → Notifications → ChewClue to re-enable.'
                  : 'Open iPhone Settings → Safari → Notifications to re-enable.'
                : 'Check your browser notification settings to re-enable.'}
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
              Get gentle reminders to log your morning and evening check-ins.
            </p>
            <button className="btn btn--primary btn--full" onClick={requestNotificationPermission}>
              Enable Reminders
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '0.75rem' }}>
          <div className="toggle-row">
            <div>
              <span className="toggle-label">Morning</span>
              {settings.morningReminderEnabled && (
                <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginLeft: '0.5rem' }}>
                  {settings.morningReminderTime}
                </span>
              )}
            </div>
            <button
              className={`toggle ${settings.morningReminderEnabled ? 'toggle--on' : ''}`}
              onClick={() => update({ morningReminderEnabled: !settings.morningReminderEnabled })}
            >
              <div className="toggle__thumb" />
            </button>
          </div>

          {settings.morningReminderEnabled && (
            <div style={{ marginBottom: '0.5rem' }}>
              <input
                type="time"
                className="input"
                value={settings.morningReminderTime}
                onChange={(e) => update({ morningReminderTime: e.target.value })}
              />
            </div>
          )}

          <div className="toggle-row">
            <div>
              <span className="toggle-label">Evening</span>
              {settings.eveningReminderEnabled && (
                <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginLeft: '0.5rem' }}>
                  {settings.eveningReminderTime}
                </span>
              )}
            </div>
            <button
              className={`toggle ${settings.eveningReminderEnabled ? 'toggle--on' : ''}`}
              onClick={() => update({ eveningReminderEnabled: !settings.eveningReminderEnabled })}
            >
              <div className="toggle__thumb" />
            </button>
          </div>

          {settings.eveningReminderEnabled && (
            <div>
              <input
                type="time"
                className="input"
                value={settings.eveningReminderTime}
                onChange={(e) => update({ eveningReminderTime: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__label">Help</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link
            to="/support"
            style={{ fontSize: '0.88rem', color: 'var(--clr-accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            Support
          </Link>
          <Link
            to="/privacy"
            style={{ fontSize: '0.88rem', color: 'var(--clr-accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            Privacy Policy
          </Link>
          <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', margin: 0 }}>
            Email:{' '}
            <a href="mailto:rawlightlabs@gmail.com" style={{ color: 'var(--clr-accent)' }}>
              rawlightlabs@gmail.com
            </a>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card__label">Account</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
          {user?.email}
        </p>
        <button className="btn btn--ghost btn--full" onClick={signOut}>
          Sign Out
        </button>
      </div>

      <div className="card" style={{ borderColor: 'var(--clr-red)', borderStyle: 'dashed' }}>
        <div className="card__label" style={{ color: 'var(--clr-red)' }}>Danger Zone</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
          Permanently delete all your meals, check-ins, and preferences.
        </p>
        <button
          className="btn btn--ghost btn--full"
          style={{ color: 'var(--clr-red)', background: 'rgba(239, 68, 68, 0.08)' }}
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? 'Resetting...' : 'Start Over (Reset All Data)'}
        </button>
        {resetNotice && (
          <p
            style={{
              marginTop: '0.6rem',
              fontSize: '0.82rem',
              color: resetNotice.startsWith('All data reset') ? 'var(--clr-green)' : 'var(--clr-red)',
            }}
          >
            {resetNotice}
          </p>
        )}
      </div>
    </div>
  )
}
