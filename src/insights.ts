import { format, subDays, parseISO } from 'date-fns'
import type {
  BuiltInCheckinMetricKey,
  CheckinMetricDirection,
  DailyCheckin,
  FoodEntry,
  FoodTag,
  TagDef,
  TriggerInsight,
  TriggerLag,
} from './types'
import { BUILT_IN_TAGS } from './types'
import { getCustomTags } from './customTags'
import { getCheckinMetricLabel } from './checkinCategories'

type CoreSymptomKey = 'energy' | 'pain' | 'bowel' | 'mood' | 'sleepQuality'

const CORE_SYMPTOMS: CoreSymptomKey[] = ['energy', 'pain', 'bowel', 'mood', 'sleepQuality']

const SYMPTOM_LABELS: Record<CoreSymptomKey, string> = {
  energy: 'Low Energy',
  pain: 'Pain',
  bowel: 'Constipation',
  mood: 'Low Mood',
  sleepQuality: 'Poor Sleep',
}

// Direction for check-ins saved before per-checkin directions existed.
// Back then bowel was "Bowel Movement" quality (higher = better).
const LEGACY_DIRECTIONS: Record<CoreSymptomKey, CheckinMetricDirection> = {
  energy: 'higher_better',
  pain: 'higher_worse',
  bowel: 'higher_better',
  mood: 'higher_better',
  sleepQuality: 'higher_better',
}

const WINDOW_DAYS = 60         // only this much recent history counts
const MIN_BUCKET = 3           // min days in each of the with/without buckets
const MIN_EFFECT = 0.3         // min mean difference on the 1–5 scale to bother reporting
const MIN_TAG_BASE_RATE = 0.1  // tag must appear on at least 10% of food-logged days
const COOCCURRENCE_JACCARD = 0.8 // tags sharing ≥80% of their days are reported together

/** Normalize a 1–5 rating so that higher always means worse. */
function worseness(value: number, direction: CheckinMetricDirection): number {
  return direction === 'higher_worse' ? value : 6 - value
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sampleVariance(xs: number[], m: number): number {
  if (xs.length < 2) return 0
  return xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1)
}

type MetricDef = { key: string; label: string; core: boolean }
type Sample = { tagDate: string; w: number }

function metricValue(
  checkin: DailyCheckin,
  def: MetricDef,
): { value: number; direction: CheckinMetricDirection } | null {
  if (def.core) {
    const key = def.key as CoreSymptomKey
    return {
      value: checkin[key],
      direction: checkin.customDirections?.[key] ?? LEGACY_DIRECTIONS[key],
    }
  }
  const extra = (checkin.extraMetrics ?? []).find((m) => m.id === def.key)
  return extra ? { value: extra.value, direction: extra.direction } : null
}

/**
 * For each food tag and check-in metric, compare symptom severity on days
 * the tag was eaten vs days it wasn't, at two lags:
 *   - same_day:     tags eaten today vs tonight's evening check-in
 *   - next_morning: tags eaten yesterday vs this morning's check-in
 *
 * Values are normalized per check-in so higher always means worse, letting
 * data recorded under either scale direction mix correctly. Confidence is a
 * Welch-style t statistic squashed to 0–1, so small samples can't claim a
 * strong pattern. Tags that nearly always co-occur (e.g. bread + gluten) are
 * collapsed into a single insight.
 */
export function detectTriggers(
  foods: FoodEntry[],
  checkins: DailyCheckin[],
): TriggerInsight[] {
  if (foods.length === 0 || checkins.length === 0) return []

  const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
  const cutoff = format(subDays(parseISO(sorted[0].date), WINDOW_DAYS), 'yyyy-MM-dd')
  const recent = sorted.filter((c) => c.date >= cutoff)

  // Tag servings per day (dose), and the set of days each tag was eaten
  const tagCountsByDate = new Map<string, Map<FoodTag, number>>()
  for (const f of foods) {
    if (f.date < cutoff) continue
    let counts = tagCountsByDate.get(f.date)
    if (!counts) {
      counts = new Map()
      tagCountsByDate.set(f.date, counts)
    }
    for (const t of f.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const foodDays = tagCountsByDate.size
  if (foodDays === 0) return []

  const daysWithTag = new Map<FoodTag, Set<string>>()
  for (const [date, counts] of tagCountsByDate) {
    for (const t of counts.keys()) {
      if (!daysWithTag.has(t)) daysWithTag.set(t, new Set())
      daysWithTag.get(t)!.add(date)
    }
  }

  // Metrics to analyze: the five core categories plus any custom categories
  // seen in recent check-ins (labeled from their most recent appearance).
  const latestMorning = recent.find((c) => c.period === 'morning')
  const metricDefs: MetricDef[] = CORE_SYMPTOMS.map((key) => ({
    key,
    core: true,
    label: getCheckinMetricLabel(latestMorning, key as BuiltInCheckinMetricKey, SYMPTOM_LABELS[key]),
  }))
  const seenCustom = new Set<string>()
  for (const c of recent) {
    for (const extra of c.extraMetrics ?? []) {
      if (seenCustom.has(extra.id)) continue
      seenCustom.add(extra.id)
      metricDefs.push({ key: extra.id, core: false, label: extra.label })
    }
  }

  // Pre-bucket normalized samples per (lag, metric). tagDate is the day whose
  // foods are compared against the check-in.
  const lags: TriggerLag[] = ['next_morning', 'same_day']
  const samples = new Map<string, Sample[]>()
  for (const checkin of recent) {
    const lag: TriggerLag = checkin.period === 'morning' ? 'next_morning' : 'same_day'
    const tagDate = lag === 'next_morning'
      ? format(subDays(parseISO(checkin.date), 1), 'yyyy-MM-dd')
      : checkin.date
    for (const def of metricDefs) {
      const v = metricValue(checkin, def)
      if (!v || v.value === 0) continue
      const key = `${lag}|${def.key}`
      if (!samples.has(key)) samples.set(key, [])
      samples.get(key)!.push({ tagDate, w: worseness(v.value, v.direction) })
    }
  }

  const allUsedTagIds = new Set<FoodTag>(daysWithTag.keys())
  const allTagDefs: TagDef[] = [...BUILT_IN_TAGS, ...getCustomTags()]
  const tagLookup = new Map(allTagDefs.map((t) => [t.id, t]))
  for (const id of allUsedTagIds) {
    if (!tagLookup.has(id)) tagLookup.set(id, { id, label: id, emoji: '🏷️' })
  }

  type Candidate = TriggerInsight & { metricKey: string }
  const candidates: Candidate[] = []

  for (const tag of tagLookup.values()) {
    const tagDays = daysWithTag.get(tag.id)?.size ?? 0
    if (tagDays < MIN_BUCKET || tagDays / foodDays < MIN_TAG_BASE_RATE) continue

    for (const def of metricDefs) {
      let best: Candidate | null = null

      for (const lag of lags) {
        const lagSamples = samples.get(`${lag}|${def.key}`) ?? []
        const withTag: number[] = []
        const withoutTag: number[] = []
        const highDose: number[] = []

        for (const s of lagSamples) {
          const count = tagCountsByDate.get(s.tagDate)?.get(tag.id) ?? 0
          if (count > 0) {
            withTag.push(s.w)
            if (count >= 2) highDose.push(s.w)
          } else {
            withoutTag.push(s.w)
          }
        }

        if (withTag.length < MIN_BUCKET || withoutTag.length < MIN_BUCKET) continue

        const avgWith = mean(withTag)
        const avgWithout = mean(withoutTag)
        const diff = avgWith - avgWithout
        if (diff <= MIN_EFFECT) continue

        // Welch-style standard error, floored because integer ratings can
        // have zero variance at small n (which would fake infinite confidence).
        const se = Math.max(
          0.2,
          Math.sqrt(
            sampleVariance(withTag, avgWith) / withTag.length +
            sampleVariance(withoutTag, avgWithout) / withoutTag.length,
          ),
        )
        let score = Math.min(1, diff / se / 4)

        // Dose-response: feeling even worse on multi-serving days strengthens the case
        if (highDose.length >= 2) {
          const doseDiff = mean(highDose) - avgWith
          if (doseDiff > 0) score = Math.min(1, score + Math.min(0.15, doseDiff / 2))
        }

        if (!best || score > best.score) {
          best = {
            tag: tag.id,
            label: tag.label,
            symptom: def.label,
            metricKey: def.key,
            score,
            occurrences: withTag.length,
            lag,
            avgSymptomAfter: Math.round(avgWith * 10) / 10,
            avgSymptomWithout: Math.round(avgWithout * 10) / 10,
          }
        }
      }

      if (best) candidates.push(best)
    }
  }

  // Collapse tags that nearly always co-occur: they carry the same evidence,
  // so listing them separately would overstate it.
  const parent = new Map<FoodTag, FoodTag>()
  const find = (t: FoodTag): FoodTag => {
    const p = parent.get(t) ?? t
    if (p === t) return t
    const root = find(p)
    parent.set(t, root)
    return root
  }
  const union = (a: FoodTag, b: FoodTag) => parent.set(find(a), find(b))

  const candidateTags = [...new Set(candidates.map((c) => c.tag))]
  for (let i = 0; i < candidateTags.length; i++) {
    for (let j = i + 1; j < candidateTags.length; j++) {
      const a = daysWithTag.get(candidateTags[i])!
      const b = daysWithTag.get(candidateTags[j])!
      let intersection = 0
      for (const d of a) if (b.has(d)) intersection++
      const jaccard = intersection / (a.size + b.size - intersection)
      if (jaccard >= COOCCURRENCE_JACCARD) union(candidateTags[i], candidateTags[j])
    }
  }

  const grouped = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const key = `${find(c.tag)}|${c.metricKey}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(c)
  }

  const results: TriggerInsight[] = []
  for (const group of grouped.values()) {
    group.sort((a, b) => b.score - a.score)
    const { metricKey: _metricKey, ...top } = group[0]
    const label = [...new Set(group.map((c) => c.label))].slice(0, 3).join(' / ')
    results.push({ ...top, label })
  }

  return results.sort((a, b) => b.score - a.score)
}
