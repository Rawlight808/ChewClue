import type {
  BuiltInCheckinMetricKey,
  CheckinMetricDirection,
  CheckinMetricTemplate,
  DailyCheckin,
} from './types'

const STORAGE_KEY = 'chewclue_checkin_metric_template'

const BUILT_IN_METRICS: CheckinMetricTemplate[] = [
  { id: 'sleepQuality', label: 'Sleep Quality', direction: 'higher_better', builtIn: true },
  { id: 'energy', label: 'Energy Level', direction: 'higher_better', builtIn: true },
  { id: 'mood', label: 'Mood', direction: 'higher_better', builtIn: true },
  { id: 'pain', label: 'Pain Level', direction: 'higher_worse', builtIn: true },
  { id: 'bowel', label: 'Constipation', direction: 'higher_worse', builtIn: true },
]

// Core categories a fresh check-in starts with. The rest stay available
// through the "Removed core categories" restore list.
const DEFAULT_TEMPLATE_IDS = new Set(['sleepQuality', 'energy', 'bowel'])

// Saved labels matching an old built-in default are treated as "never renamed"
// so they pick up the current default label and direction.
const LEGACY_BUILT_IN_LABELS: Record<string, string[]> = {
  bowel: ['Bowel Movement'],
}

function builtInMetricLookup() {
  return new Map(BUILT_IN_METRICS.map((metric) => [metric.id, metric]))
}

function normalizeTemplate(raw: unknown): CheckinMetricTemplate[] {
  // No saved template yet: start with all core categories. A saved template
  // is authoritative — core categories the user removed stay removed.
  if (!Array.isArray(raw)) return getDefaultCheckinMetricTemplate()

  const builtInLookup = builtInMetricLookup()
  const saved = raw.filter((item): item is CheckinMetricTemplate =>
    Boolean(
      item &&
      typeof item === 'object' &&
      'id' in item &&
      'label' in item &&
      'direction' in item,
    ),
  )

  const seen = new Set<string>()
  const result: CheckinMetricTemplate[] = []
  for (const item of saved) {
    if (seen.has(item.id)) continue
    seen.add(item.id)

    const builtIn = builtInLookup.get(item.id)
    if (builtIn) {
      const savedLabel = item.label?.trim()
      const isLegacyDefault = !savedLabel || (LEGACY_BUILT_IN_LABELS[item.id] ?? []).includes(savedLabel)
      result.push({
        ...builtIn,
        label: isLegacyDefault ? builtIn.label : savedLabel,
        direction: isLegacyDefault
          ? builtIn.direction
          : item.direction === 'higher_worse' ? 'higher_worse' : item.direction === 'higher_better' ? 'higher_better' : builtIn.direction,
      })
    } else {
      result.push({
        id: item.id,
        label: item.label,
        direction: (item.direction === 'higher_worse' ? 'higher_worse' : 'higher_better') as CheckinMetricDirection,
        builtIn: false,
      })
    }
  }

  return result
}

export function getDefaultCheckinMetricTemplate(): CheckinMetricTemplate[] {
  return BUILT_IN_METRICS
    .filter((metric) => DEFAULT_TEMPLATE_IDS.has(metric.id))
    .map((metric) => ({ ...metric }))
}

/** All core categories, including ones not in the default starting template. */
export function getCoreCheckinMetrics(): CheckinMetricTemplate[] {
  return BUILT_IN_METRICS.map((metric) => ({ ...metric }))
}

export function getCheckinMetricTemplate(): CheckinMetricTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeTemplate(raw ? JSON.parse(raw) : undefined)
  } catch {
    return getDefaultCheckinMetricTemplate()
  }
}

export function saveCheckinMetricTemplate(metrics: CheckinMetricTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTemplate(metrics)))
  } catch {
    /* Safari private mode / storage blocked */
  }
}

export function resetCheckinMetricTemplate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function createCustomCheckinMetricId(label: string, existingIds: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_metric'
  let id = `custom_${base}`
  let suffix = 2
  while (existingIds.includes(id)) {
    id = `custom_${base}_${suffix}`
    suffix += 1
  }
  return id
}

export function getCheckinMetricScaleLabels(direction: CheckinMetricDirection): [string, string] {
  return direction === 'higher_worse' ? ['None', 'Severe'] : ['Low', 'High']
}

export function getCheckinMetricDisplay(checkin: DailyCheckin): Array<{
  id: string
  label: string
  value: number
  direction: CheckinMetricDirection
}> {
  const labels = checkin.customLabels ?? {}
  const directions = checkin.customDirections ?? {}

  const builtIns = BUILT_IN_METRICS.map((metric) => ({
    id: metric.id,
    label: labels[metric.id as BuiltInCheckinMetricKey] ?? metric.label,
    value: checkin[metric.id as BuiltInCheckinMetricKey],
    direction: directions[metric.id as BuiltInCheckinMetricKey] ?? metric.direction,
  }))

  return [...builtIns, ...(checkin.extraMetrics ?? [])]
}

export function getCheckinMetricLabel(
  checkin: DailyCheckin | undefined,
  key: BuiltInCheckinMetricKey,
  fallback: string,
): string {
  return checkin?.customLabels?.[key] ?? fallback
}
