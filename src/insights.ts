import { format, subDays, parseISO } from 'date-fns'
import type { BuiltInCheckinMetricKey, DailyCheckin, FoodEntry, FoodTag, TagDef, TriggerInsight } from './types'
import { BUILT_IN_TAGS } from './types'
import { getCustomTags } from './customTags'
import { getCheckinMetricLabel } from './checkinCategories'

type SymptomKey = 'energy' | 'pain' | 'bowel' | 'mood' | 'sleepQuality'

const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  energy: 'Low Energy',
  pain: 'Pain',
  bowel: 'Poor Digestion',
  mood: 'Low Mood',
  sleepQuality: 'Poor Sleep',
}

/**
 * For each food tag, compare symptom scores on mornings after eating
 * that tag vs mornings without. A tag is a potential trigger if symptoms
 * are consistently worse the day after consuming it.
 */
export function detectTriggers(
  foods: FoodEntry[],
  checkins: DailyCheckin[],
): TriggerInsight[] {
  const morningCheckins = checkins.filter((checkin) => checkin.period === 'morning')

  if (morningCheckins.length < 3) return []

  const checkinMap = new Map<string, DailyCheckin>()
  for (const c of morningCheckins) checkinMap.set(c.date, c)

  const foodsByDate = new Map<string, Set<FoodTag>>()
  for (const f of foods) {
    if (!foodsByDate.has(f.date)) foodsByDate.set(f.date, new Set())
    for (const t of f.tags) foodsByDate.get(f.date)!.add(t)
  }

  const insights: TriggerInsight[] = []
  const symptoms: SymptomKey[] = ['energy', 'pain', 'bowel', 'mood', 'sleepQuality']
  const latestMorningCheckin = morningCheckins[0]

  const allUsedTagIds = new Set<FoodTag>()
  for (const f of foods) for (const t of f.tags) allUsedTagIds.add(t)

  const allTagDefs: TagDef[] = [...BUILT_IN_TAGS, ...getCustomTags()]
  const tagLookup = new Map(allTagDefs.map((t) => [t.id, t]))
  for (const id of allUsedTagIds) {
    if (!tagLookup.has(id)) tagLookup.set(id, { id, label: id, emoji: '🏷️' })
  }

  for (const tag of tagLookup.values()) {
    for (const symptom of symptoms) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const checkin of morningCheckins) {
        const prevDay = format(subDays(parseISO(checkin.date), 1), 'yyyy-MM-dd')
        const prevTags = foodsByDate.get(prevDay)
        const val = checkin[symptom]

        if (prevTags?.has(tag.id)) {
          withTag.push(val)
        } else {
          withoutTag.push(val)
        }
      }

      if (withTag.length < 2 || withoutTag.length < 2) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length

      // For pain: higher = worse, so tag is bad if avgWith > avgWithout
      // For energy/mood/bowel/sleep: lower = worse, so tag is bad if avgWith < avgWithout
      const isNegativeScale = symptom === 'pain'
      const diff = isNegativeScale ? avgWith - avgWithout : avgWithout - avgWith

      if (diff <= 0.3) continue

      const score = Math.min(1, diff / 2)

      insights.push({
        tag: tag.id,
        label: tag.label,
        symptom: getCheckinMetricLabel(latestMorningCheckin, symptom as BuiltInCheckinMetricKey, SYMPTOM_LABELS[symptom]),
        score,
        occurrences: withTag.length,
        avgSymptomAfter: Math.round(avgWith * 10) / 10,
        avgSymptomWithout: Math.round(avgWithout * 10) / 10,
      })
    }
  }

  return insights.sort((a, b) => b.score - a.score)
}
