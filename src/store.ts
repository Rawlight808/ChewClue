import type { CheckinPeriod, DailyCheckin, FoodEntry, ReminderSettings } from './types'

const FOOD_KEY = 'chewclue_foods'
const CHECKIN_KEY = 'chewclue_checkins'
const REMINDER_KEY = 'chewclue_reminders'

/** One-time copy from pre-rename keys so existing users keep data */
function migrateFromLegacyKeys() {
  const pairs: [string, string][] = [
    ['gutcheck_foods', FOOD_KEY],
    ['gutcheck_checkins', CHECKIN_KEY],
    ['gutcheck_reminders', REMINDER_KEY],
  ]
  for (const [oldKey, newKey] of pairs) {
    if (localStorage.getItem(newKey) === null) {
      const v = localStorage.getItem(oldKey)
      if (v !== null) localStorage.setItem(newKey, v)
    }
  }
}
migrateFromLegacyKeys()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function getFoodEntries(): FoodEntry[] {
  return read<FoodEntry[]>(FOOD_KEY, [])
}

export function saveFoodEntry(entry: FoodEntry) {
  const entries = getFoodEntries()
  const idx = entries.findIndex((e) => e.id === entry.id)
  if (idx >= 0) entries[idx] = entry
  else entries.push(entry)
  write(FOOD_KEY, entries)
}

export function deleteFoodEntry(id: string) {
  write(FOOD_KEY, getFoodEntries().filter((e) => e.id !== id))
}

export function getCheckins(): DailyCheckin[] {
  return read<DailyCheckin[]>(CHECKIN_KEY, []).map((checkin) => ({
    ...checkin,
    period: checkin.period ?? 'morning',
    customLabels: checkin.customLabels ?? {},
    customDirections: checkin.customDirections ?? {},
    extraMetrics: checkin.extraMetrics ?? [],
  }))
}

export function saveCheckin(checkin: DailyCheckin) {
  const list = getCheckins()
  const idx = list.findIndex((c) => c.id === checkin.id)
  if (idx >= 0) list[idx] = checkin
  else list.push(checkin)
  write(CHECKIN_KEY, list)
}

export function getCheckinForDate(date: string): DailyCheckin | undefined {
  return getCheckinForDateAndPeriod(date, 'morning')
}

export function getCheckinForDateAndPeriod(date: string, period: CheckinPeriod): DailyCheckin | undefined {
  return getCheckins().find((c) => c.date === date && c.period === period)
}

export function getCheckinsForDate(date: string): DailyCheckin[] {
  return getCheckins().filter((c) => c.date === date)
}

export function getFoodEntriesForDate(date: string): FoodEntry[] {
  return getFoodEntries().filter((e) => e.date === date)
}

const defaultReminders: ReminderSettings = {
  eveningReminderEnabled: true,
  eveningReminderTime: '20:00',
  morningReminderEnabled: true,
  morningReminderTime: '08:00',
}

export function getReminderSettings(): ReminderSettings {
  return read<ReminderSettings>(REMINDER_KEY, defaultReminders)
}

export function saveReminderSettings(settings: ReminderSettings) {
  write(REMINDER_KEY, settings)
}

export function resetLocalAppData() {
  try {
    localStorage.removeItem(FOOD_KEY)
    localStorage.removeItem(CHECKIN_KEY)
    localStorage.removeItem(REMINDER_KEY)
    localStorage.removeItem('gutcheck_foods')
    localStorage.removeItem('gutcheck_checkins')
    localStorage.removeItem('gutcheck_reminders')
  } catch {
    /* storage unavailable */
  }
}
