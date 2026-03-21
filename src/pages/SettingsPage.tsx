import { useState } from 'react'
import { getReminderSettings, saveReminderSettings } from '../store'
import { useAuthContext } from '../App'

function useNotificationStatus() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  return { status, refresh: () => setStatus('Notification' in window ? Notification.permission : 'unsupported') }
}

export function SettingsPage() {
  const { user, signOut } = useAuthContext()
  const [settings, setSettings] = useState(() => getReminderSettings())
  const [saved, setSaved] = useState(false)
  const { status: notifStatus, refresh: refreshNotif } = useNotificationStatus()

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveReminderSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.')
      return
    }
    const result = await Notification.requestPermission()
    refreshNotif()
    if (result === 'granted') {
      new Notification('ChewClue', { body: 'Reminders are now enabled!' })
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Reminders & preferences</p>
      </div>

      <div className="card">
        <div className="card__label">Notifications</div>
        {notifStatus === 'granted' ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--clr-green)', fontWeight: 600 }}>
            ✓ Notifications enabled
          </p>
        ) : notifStatus === 'denied' ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--clr-red)' }}>
            Notifications blocked. Please enable them in your browser settings.
          </p>
        ) : (
          <button className="btn btn--ghost btn--full" onClick={requestNotificationPermission}>
            Enable Notifications
          </button>
        )}
      </div>

      <div className="card">
        <div className="card__label">Evening Reminder</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
          Reminder to log what you ate today
        </p>

        <div className="toggle-row">
          <span className="toggle-label">Enabled</span>
          <button
            className={`toggle ${settings.eveningReminderEnabled ? 'toggle--on' : ''}`}
            onClick={() => update({ eveningReminderEnabled: !settings.eveningReminderEnabled })}
          >
            <div className="toggle__thumb" />
          </button>
        </div>

        {settings.eveningReminderEnabled && (
          <div style={{ marginTop: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
              Time
              <input
                type="time"
                className="input"
                style={{ marginTop: '0.25rem' }}
                value={settings.eveningReminderTime}
                onChange={(e) => update({ eveningReminderTime: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__label">Morning Reminder</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
          Reminder to do your morning check-in
        </p>

        <div className="toggle-row">
          <span className="toggle-label">Enabled</span>
          <button
            className={`toggle ${settings.morningReminderEnabled ? 'toggle--on' : ''}`}
            onClick={() => update({ morningReminderEnabled: !settings.morningReminderEnabled })}
          >
            <div className="toggle__thumb" />
          </button>
        </div>

        {settings.morningReminderEnabled && (
          <div style={{ marginTop: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)' }}>
              Time
              <input
                type="time"
                className="input"
                style={{ marginTop: '0.25rem' }}
                value={settings.morningReminderTime}
                onChange={(e) => update({ morningReminderTime: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      {saved && (
        <p style={{ textAlign: 'center', color: 'var(--clr-green)', fontWeight: 600, marginTop: '0.75rem', fontSize: '0.85rem' }}>
          Settings saved ✓
        </p>
      )}

      <div className="card">
        <div className="card__label">Account</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginBottom: '0.6rem' }}>
          {user?.email}
        </p>
        <button className="btn btn--ghost btn--full" style={{ color: 'var(--clr-red)' }} onClick={signOut}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
