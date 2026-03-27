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
  { id: 'bowel', label: 'Bowel Movement', direction: 'higher_better', builtIn: true },
]

function builtInMetricLookup() {
  return new Map(BUILT_IN_METRICS.map((metric) => [metric.id, metric]))
}

function normalizeTemplate(raw: unknown): CheckinMetricTemplate[] {
  const builtInLookup = builtInMetricLookup()
  const saved = Array.isArray(raw)
    ? raw.filter((item): item is CheckinMetricTemplate =>
      Boolean(
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'label' in item &&
        'direction' in item,
      ),
    )
    : []

  const extraMetrics = saved.filter((item) => !builtInLookup.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    direction: (item.direction === 'higher_worse' ? 'higher_worse' : 'higher_better') as CheckinMetricDirection,
    builtIn: false,
  }))

  const builtIns = BUILT_IN_METRICS.map((metric) => {
    const savedMetric = saved.find((item) => item.id === metric.id)
    return {
      ...metric,
      label: savedMetric?.label?.trim() || metric.label,
      direction: savedMetric?.direction === 'higher_worse' ? 'higher_worse' : savedMetric?.direction === 'higher_better' ? 'higher_better' : metric.direction,
    }
  })

  return [...builtIns, ...extraMetrics]
}

export function getDefaultCheckinMetricTemplate(): CheckinMetricTemplate[] {
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
