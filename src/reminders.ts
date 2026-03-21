import { format } from 'date-fns'
import { getReminderSettings, getFoodEntriesForDate, getCheckinForDate } from './store'

const LAST_EVENING_KEY = 'gutcheck_last_evening_reminder'
const LAST_MORNING_KEY = 'gutcheck_last_morning_reminder'
const CHECK_INTERVAL_MS = 60_000 // check every minute

function alreadySentToday(key: string): boolean {
  return localStorage.getItem(key) === format(new Date(), 'yyyy-MM-dd')
}

function markSent(key: string) {
  localStorage.setItem(key, format(new Date(), 'yyyy-MM-dd'))
}

function currentTimeHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function notify(title: string, body: string) {
  if (Notification.permission !== 'granted') return

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
    })
  } else {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

function checkReminders() {
  const settings = getReminderSettings()
  const now = currentTimeHHMM()
  const today = format(new Date(), 'yyyy-MM-dd')

  if (
    settings.eveningReminderEnabled &&
    now >= settings.eveningReminderTime &&
    !alreadySentToday(LAST_EVENING_KEY)
  ) {
    const foods = getFoodEntriesForDate(today)
    if (foods.length === 0) {
      notify('ChewClue', "You haven't logged any food today. Tap to add what you ate.")
    } else {
      notify('ChewClue', 'Did you log everything you ate today? Tap to review.')
    }
    markSent(LAST_EVENING_KEY)
  }

  if (
    settings.morningReminderEnabled &&
    now >= settings.morningReminderTime &&
    now < '12:00' &&
    !alreadySentToday(LAST_MORNING_KEY)
  ) {
    const checkin = getCheckinForDate(today)
    if (!checkin) {
      notify('ChewClue', 'Good morning! How are you feeling? Tap to do your check-in.')
    }
    markSent(LAST_MORNING_KEY)
  }
}

let intervalId: number | null = null

export function startReminderScheduler() {
  if (intervalId !== null) return
  checkReminders()
  intervalId = window.setInterval(checkReminders, CHECK_INTERVAL_MS)
}

export function stopReminderScheduler() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}
