import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { cloudGetCheckinForDate, cloudSaveCheckin } from '../cloudStore'
import {
  createCustomCheckinMetricId,
  getCheckinMetricDisplay,
  getCheckinMetricScaleLabels,
  getCheckinMetricTemplate,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--clr-text-muted)', marginBottom: '0.25rem' }}>
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

function buildEditableMetrics(checkin?: DailyCheckin): EditableMetric[] {
  if (checkin) {
    return getCheckinMetricDisplay(checkin).map((metric) => ({
      ...metric,
      builtIn: !metric.id.startsWith('custom_'),
    }))
  }

  return getCheckinMetricTemplate().map((metric) => ({
    ...metric,
    value: 0,
  }))
}

export function CheckinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = searchParams.get('date') ?? today
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
        setMetrics(buildEditableMetrics(c))
      } else {
        setExisting(undefined)
        setMetrics(buildEditableMetrics())
      }
      setLoaded(true)
    })
  }, [selectedDate, period])

  const canSave = metrics.length > 0 && metrics.every((metric) => metric.value > 0 && metric.label.trim())

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

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)

    const builtInMetrics = metrics.filter((metric) => metric.builtIn)
    const extraMetrics = metrics
      .filter((metric) => !metric.builtIn)
      .map(({ id, label, value, direction }) => ({ id, label: label.trim(), value, direction }))

    saveCheckinMetricTemplate(metrics.map(({ id, label, direction, builtIn }) => ({
      id,
      label: label.trim(),
      direction,
      builtIn,
    })))

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
        bowel: builtInMetrics.find((metric) => metric.id === 'bowel')?.label.trim() ?? 'Bowel Movement',
      },
      customDirections: {
        sleepQuality: builtInMetrics.find((metric) => metric.id === 'sleepQuality')?.direction ?? 'higher_better',
        energy: builtInMetrics.find((metric) => metric.id === 'energy')?.direction ?? 'higher_better',
        mood: builtInMetrics.find((metric) => metric.id === 'mood')?.direction ?? 'higher_better',
        pain: builtInMetrics.find((metric) => metric.id === 'pain')?.direction ?? 'higher_worse',
        bowel: builtInMetrics.find((metric) => metric.id === 'bowel')?.direction ?? 'higher_better',
      },
      extraMetrics,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })
    setSaving(false)
    navigate(`/?date=${selectedDate}`)
  }

  if (!loaded) {
    return <p style={{ textAlign: 'center', color: 'var(--clr-text-muted)', padding: '2rem' }}>Loading...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

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
                {metric.builtIn ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', width: '3rem', textAlign: 'center' }}>Core</span>
                ) : (
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '0.35rem 0.55rem', color: 'var(--clr-red)' }}
                    onClick={() => handleRemoveCategory(metric.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

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

      <div style={{ marginTop: '1rem' }}>
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
