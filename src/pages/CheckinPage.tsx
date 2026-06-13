import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, isValid, parseISO } from 'date-fns'
import { DateHeaderWithCalendar } from '../components/DateHeaderWithCalendar'
import { v4 as uuid } from 'uuid'
import { cloudGetCheckinForDate, cloudSaveCheckin } from '../cloudStore'
import { refreshReminderScheduling } from '../reminders'
import {
  createCustomCheckinMetricId,
  getCheckinMetricDisplay,
  getCheckinMetricScaleLabels,
  getCheckinMetricTemplate,
  getCoreCheckinMetrics,
  saveCheckinMetricTemplate,
} from '../checkinCategories'
import type {
  BowelRating,
  BuiltInCheckinMetricKey,
  CheckinMetricDirection,
  CheckinMetricTemplate,
  CheckinPeriod,
  DailyCheckin,
} from '../types'

type EditableMetric = CheckinMetricTemplate & { value: number }

function RatingRow({ label, value, onChange, labels }: {
  label: string
  value: number
  onChange: (v: number) => void
  labels?: string[]
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div className="card__label">{label}</div>
      {labels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--clr-text-muted)', marginBottom: '0.3rem', padding: '0 0.25rem' }}>
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
      <div className="rating-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`rating-btn ${value === n ? 'rating-btn--selected' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function metricValue(metrics: EditableMetric[], id: BuiltInCheckinMetricKey): number {
  return metrics.find((metric) => metric.id === id)?.value ?? 0
}

// The "feeling fine" rating depends on the scale direction: 5 when higher is
// better (great sleep/energy), 1 when higher is worse (no pain/constipation).
function goodValue(direction: CheckinMetricDirection): number {
  return direction === 'higher_worse' ? 1 : 5
}

function resolveDateParam(param: string | null): string {
  if (param && isValid(parseISO(param))) return param
  return format(new Date(), 'yyyy-MM-dd')
}

// Sleep quality only makes sense when reflecting on last night, so it's a
// morning-only question. Evening check-ins with a legacy value still show it.
function isEveningExcluded(metricId: string, period: CheckinPeriod): boolean {
  return period === 'evening' && metricId === 'sleepQuality'
}

function buildEditableMetrics(period: CheckinPeriod, checkin?: DailyCheckin): EditableMetric[] {
  if (checkin) {
    const templateIds = new Set(getCheckinMetricTemplate().map((metric) => metric.id))
    return getCheckinMetricDisplay(checkin)
      // Hide core categories the user removed, unless this check-in has a value for them
      .filter((metric) => metric.value > 0 || (
        !isEveningExcluded(metric.id, period) &&
        (metric.id.startsWith('custom_') || templateIds.has(metric.id))
      ))
      .map((metric) => ({
        ...metric,
        builtIn: !metric.id.startsWith('custom_'),
      }))
  }

  return getCheckinMetricTemplate()
    .filter((metric) => !isEveningExcluded(metric.id, period))
    .map((metric) => ({
      ...metric,
      value: 0,
    }))
}

export function CheckinPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = resolveDateParam(searchParams.get('date'))
  const periodParam = searchParams.get('period')
  const period: CheckinPeriod = periodParam === 'evening' ? 'evening' : 'morning'
  const title = period === 'evening' ? 'Evening Check-In' : 'Morning Check-In'
  const subtitle = period === 'evening' ? 'How are you feeling tonight?' : 'How are you feeling today?'

  const [existing, setExisting] = useState<DailyCheckin | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [metrics, setMetrics] = useState<EditableMetric[]>([])
  const [showCategoryEditor, setShowCategoryEditor] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryDirection, setNewCategoryDirection] = useState<CheckinMetricDirection>('higher_worse')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoaded(false)
    cloudGetCheckinForDate(selectedDate, period).then((c) => {
      if (c) {
        setExisting(c)
        setMetrics(buildEditableMetrics(period, c))
      } else {
        setExisting(undefined)
        setMetrics(buildEditableMetrics(period))
      }
      setLoaded(true)
    })
  }, [selectedDate, period])

  const answered = metrics.filter((m) => m.value > 0).length
  const total = metrics.length
  const canSave = total > 0 && metrics.every((metric) => metric.label.trim())

  const updateMetric = (id: string, patch: Partial<EditableMetric>) => {
    setMetrics((current) => current.map((metric) => (
      metric.id === id ? { ...metric, ...patch } : metric
    )))
  }

  const handleAddCategory = () => {
    const label = newCategoryLabel.trim()
    if (!label) return

    setMetrics((current) => [
      ...current,
      {
        id: createCustomCheckinMetricId(label, current.map((metric) => metric.id)),
        label,
        direction: newCategoryDirection,
        builtIn: false,
        value: 0,
      },
    ])
    setNewCategoryLabel('')
    setNewCategoryDirection('higher_worse')
  }

  const handleRemoveCategory = (id: string) => {
    setMetrics((current) => current.filter((metric) => metric.id !== id))
  }

  const allGood = total > 0 && metrics.every((metric) => metric.value === goodValue(metric.direction))

  const handleAllGood = () => {
    setMetrics((current) => current.map((metric) => ({
      ...metric,
      value: goodValue(metric.direction),
    })))
  }

  const removedCoreMetrics = getCoreCheckinMetrics().filter(
    (builtIn) =>
      !isEveningExcluded(builtIn.id, period) &&
      !metrics.some((metric) => metric.id === builtIn.id),
  )

  const handleRestoreCategory = (metric: CheckinMetricTemplate) => {
    setMetrics((current) => [...current, { ...metric, value: 0 }])
  }

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)

    const builtInMetrics = metrics.filter((metric) => metric.builtIn)
    const extraMetrics = metrics
      .filter((metric) => !metric.builtIn)
      .map(({ id, label, value, direction }) => ({ id, label: label.trim(), value, direction }))

    const templateFromMetrics = metrics.map(({ id, label, direction, builtIn }) => ({
      id,
      label: label.trim(),
      direction,
      builtIn,
    }))
    // Morning-only categories aren't shown in evening check-ins, so carry them
    // over from the saved template instead of dropping them.
    const preservedMetrics = getCheckinMetricTemplate().filter((metric) =>
      isEveningExcluded(metric.id, period) &&
      !templateFromMetrics.some((item) => item.id === metric.id),
    )
    saveCheckinMetricTemplate([...preservedMetrics, ...templateFromMetrics])

    await cloudSaveCheckin({
      id: existing?.id ?? uuid(),
      date: selectedDate,
      period,
      sleepQuality: metricValue(builtInMetrics, 'sleepQuality'),
      energy: metricValue(builtInMetrics, 'energy'),
      mood: metricValue(builtInMetrics, 'mood'),
      pain: metricValue(builtInMetrics, 'pain'),
      bowel: metricValue(builtInMetrics, 'bowel') as BowelRating,
      notes: '',
      customLabels: {
        sleepQuality: builtInMetrics.find((metric) => metric.id === 'sleepQuality')?.label.trim() ?? 'Sleep Quality',
        energy: builtInMetrics.find((metric) => metric.id === 'energy')?.label.trim() ?? 'Energy Level',
        mood: builtInMetrics.find((metric) => metric.id === 'mood')?.label.trim() ?? 'Mood',
        pain: builtInMetrics.find((metric) => metric.id === 'pain')?.label.trim() ?? 'Pain Level',
        bowel: builtInMetrics.find((metric) => metric.id === 'bowel')?.label.trim() ?? 'Constipation',
      },
      customDirections: {
        sleepQuality: builtInMetrics.find((metric) => metric.id === 'sleepQuality')?.direction ?? 'higher_better',
        energy: builtInMetrics.find((metric) => metric.id === 'energy')?.direction ?? 'higher_better',
        mood: builtInMetrics.find((metric) => metric.id === 'mood')?.direction ?? 'higher_better',
        pain: builtInMetrics.find((metric) => metric.id === 'pain')?.direction ?? 'higher_worse',
        bowel: builtInMetrics.find((metric) => metric.id === 'bowel')?.direction ?? 'higher_worse',
      },
      extraMetrics,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })
    if (selectedDate === today) {
      await refreshReminderScheduling().catch(() => {})
    }
    setSaving(false)
    navigate(selectedDate === today ? '/' : `/?date=${selectedDate}`)
  }

  const changeCheckinDate = (next: string) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('date', next)
      const p = prev.get('period') === 'evening' ? 'evening' : 'morning'
      n.set('period', p)
      return n
    })
  }

  if (!loaded) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="skeleton skeleton-line" style={{ width: '50%', marginBottom: '1.5rem' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '1.25rem' }}>
            <div className="skeleton skeleton-line--short skeleton-line" />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <DateHeaderWithCalendar
        selected={selectedDate}
        onDateChange={changeCheckinDate}
        todayHint="Go back to any day to add or adjust this check-in."
      />

      {total > 0 && (
        <div className="progress-strip" style={{ marginBottom: '0.75rem' }}>
          <div className="progress-strip__dots">
            {metrics.map((m) => (
              <div key={m.id} className={`progress-dot ${m.value > 0 ? 'progress-dot--done' : ''}`} />
            ))}
          </div>
          <span>{answered === total ? 'All answered' : `${answered} of ${total} — you can save anytime`}</span>
        </div>
      )}

      {total > 0 && (
        <button
          className={`btn btn--full ${allGood ? 'btn--primary' : 'btn--ghost'}`}
          onClick={handleAllGood}
          style={{ marginBottom: '0.75rem' }}
        >
          {allGood ? '✓ All good' : 'All good — I feel fine in every category'}
        </button>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="card__label" style={{ marginBottom: 0 }}>Categories</div>
          <button
            className="btn btn--ghost"
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
            onClick={() => setShowCategoryEditor((current) => !current)}
          >
            {showCategoryEditor ? 'Done' : 'Customize'}
          </button>
        </div>

        {metrics.map((metric) => (
          <RatingRow
            key={metric.id}
            label={metric.label}
            value={metric.value}
            onChange={(value) => updateMetric(metric.id, { value })}
            labels={getCheckinMetricScaleLabels(metric.direction)}
          />
        ))}

        {showCategoryEditor && (
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--clr-border)', paddingTop: '0.75rem' }}>
            {metrics.map((metric) => (
              <div key={metric.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  className="input"
                  value={metric.label}
                  onChange={(e) => updateMetric(metric.id, { label: e.target.value })}
                  placeholder="Category name"
                />
                <select
                  className="input"
                  value={metric.direction}
                  onChange={(e) => updateMetric(metric.id, { direction: e.target.value as CheckinMetricDirection })}
                  style={{ minWidth: '9rem' }}
                >
                  <option value="higher_better">Higher is better</option>
                  <option value="higher_worse">Higher is worse</option>
                </select>
                <button
                  className="btn btn--ghost"
                  style={{ padding: '0.35rem 0.55rem', color: 'var(--clr-red)' }}
                  onClick={() => handleRemoveCategory(metric.id)}
                >
                  Remove
                </button>
              </div>
            ))}

            {removedCoreMetrics.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '0.4rem' }}>
                  Removed core categories
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {removedCoreMetrics.map((metric) => (
                    <button
                      key={metric.id}
                      className="btn btn--ghost"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={() => handleRestoreCategory(metric)}
                    >
                      + {metric.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
              <input
                className="input"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder="New category"
              />
              <select
                className="input"
                value={newCategoryDirection}
                onChange={(e) => setNewCategoryDirection(e.target.value as CheckinMetricDirection)}
                style={{ minWidth: '9rem' }}
              >
                <option value="higher_better">Higher is better</option>
                <option value="higher_worse">Higher is worse</option>
              </select>
              <button
                className="btn btn--primary"
                style={{ padding: '0.45rem 0.8rem' }}
                onClick={handleAddCategory}
                disabled={!newCategoryLabel.trim()}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: '5rem' }} />

      <div className="sticky-save">
        <button
          className="btn btn--primary btn--full"
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{ opacity: canSave && !saving ? 1 : 0.45 }}
        >
          {saving ? 'Saving...' : existing ? 'Update Check-In' : 'Save Check-In'}
        </button>
      </div>
    </div>
  )
}
