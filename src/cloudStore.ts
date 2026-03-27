import { supabase } from './supabase'
import type { CheckinPeriod, DailyCheckin, FoodEntry } from './types'

export async function cloudGetFoodEntries(): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error(error); return [] }

  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    meal: r.meal,
    description: r.description,
    tags: r.tags ?? [],
    createdAt: r.created_at,
  }))
}

export async function cloudGetFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) { console.error(error); return [] }

  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    meal: r.meal,
    description: r.description,
    tags: r.tags ?? [],
    createdAt: r.created_at,
  }))
}

export async function cloudSaveFoodEntry(entry: FoodEntry): Promise<void> {
  const { error } = await supabase
    .from('food_entries')
    .upsert({
      id: entry.id,
      date: entry.date,
      meal: entry.meal,
      description: entry.description,
      tags: entry.tags,
      created_at: entry.createdAt,
    })

  if (error) console.error(error)
}

export async function cloudDeleteFoodEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id)

  if (error) console.error(error)
}

export async function cloudGetCheckins(): Promise<DailyCheckin[]> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .order('date', { ascending: false })

  if (error) { console.error(error); return [] }

  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    period: r.period ?? 'morning',
    sleepQuality: r.sleep_quality,
    energy: r.energy,
    mood: r.mood,
    pain: r.pain,
    bowel: r.bowel,
    notes: r.notes ?? '',
    customLabels: r.custom_labels ?? {},
    customDirections: r.custom_directions ?? {},
    extraMetrics: r.extra_metrics ?? [],
    createdAt: r.created_at,
  }))
}

export async function cloudGetCheckinsForDate(date: string): Promise<DailyCheckin[]> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('date', date)

  if (error) return []

  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    period: r.period ?? 'morning',
    sleepQuality: r.sleep_quality,
    energy: r.energy,
    mood: r.mood,
    pain: r.pain,
    bowel: r.bowel,
    notes: r.notes ?? '',
    customLabels: r.custom_labels ?? {},
    customDirections: r.custom_directions ?? {},
    extraMetrics: r.extra_metrics ?? [],
    createdAt: r.created_at,
  }))
}

export async function cloudGetCheckinForDate(date: string, period: CheckinPeriod = 'morning'): Promise<DailyCheckin | undefined> {
  const checkins = await cloudGetCheckinsForDate(date)
  return checkins.find((checkin) => checkin.period === period)
}

export async function cloudSaveCheckin(checkin: DailyCheckin): Promise<void> {
  const { error } = await supabase
    .from('daily_checkins')
    .upsert({
      id: checkin.id,
      date: checkin.date,
      period: checkin.period,
      sleep_quality: checkin.sleepQuality,
      energy: checkin.energy,
      mood: checkin.mood,
      pain: checkin.pain,
      bowel: checkin.bowel,
      notes: checkin.notes,
      custom_labels: checkin.customLabels ?? {},
      custom_directions: checkin.customDirections ?? {},
      extra_metrics: checkin.extraMetrics ?? [],
      created_at: checkin.createdAt,
    })

  if (error) console.error(error)
}
