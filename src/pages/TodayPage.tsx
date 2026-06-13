import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { cloudGetFoodEntriesForDate, cloudGetCheckinsForDate, cloudDeleteFoodEntry } from '../cloudStore'
import type { CheckinPeriod, FoodEntry, DailyCheckin, MealSlot } from '../types'
import { getCheckinMetricDisplay } from '../checkinCategories'
import { DateHeaderWithCalendar } from '../components/DateHeaderWithCalendar'

const MEAL_ORDER: { slot: MealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { slot: 'lunch', label: 'Lunch', emoji: '☀️' },
  { slot: 'dinner', label: 'Dinner', emoji: '🌙' },
  { slot: 'supplement', label: 'Supplements', emoji: '💊' },
]

const CHECKIN_SECTIONS: { period: CheckinPeriod; title: string; emptyLabel: string }[] = [
  { period: 'morning', title: 'Morning Check-In', emptyLabel: '+ Log Morning Check-In' },
  { period: 'evening', title: 'Evening Check-In', emptyLabel: '+ Log Evening Check-In' },
]

function ratingColor(val: number, higherIsWorse = false) {
  const v = higherIsWorse ? 6 - val : val
  if (v >= 4) return 'var(--clr-green)'
  if (v >= 3) return 'var(--clr-orange)'
  return 'var(--clr-red)'
}

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton skeleton-circle" />
        ))}
      </div>
    </div>
  )
}

export function TodayPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const todayString = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(() => searchParams.get('date') ?? todayString)
  const [foods, setFoods] = useState<FoodEntry[]>([])
  const [checkins, setCheckins] = useState<DailyCheckin[]>([])
  const [loading, setLoading] = useState(true)

  const [undoItem, setUndoItem] = useState<FoodEntry | null>(null)
  const undoTimer = useRef<number>(0)

  const updateDate = (nextDate: string) => {
    setDate(nextDate)
    setSearchParams(nextDate === todayString ? {} : { date: nextDate })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [f, c] = await Promise.all([
      cloudGetFoodEntriesForDate(date),
      cloudGetCheckinsForDate(date),
    ])
    setFoods(f)
    setCheckins(c)
    setLoading(false)
  }, [date])

  useEffect(() => { loadData() }, [loadData])

  const getCheckin = (period: CheckinPeriod) => checkins.find((checkin) => checkin.period === period)

  const handleDelete = (item: FoodEntry) => {
    setFoods((prev) => prev.filter((f) => f.id !== item.id))
    setUndoItem(item)
    clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => {
      cloudDeleteFoodEntry(item.id)
      setUndoItem(null)
    }, 4000)
  }

  const handleUndo = () => {
    if (!undoItem) return
    clearTimeout(undoTimer.current)
    setFoods((prev) => [...prev, undoItem])
    setUndoItem(null)
  }

  const hasMorning = !!getCheckin('morning')
  const hasEvening = !!getCheckin('evening')
  const hasFoods = foods.length > 0
  const doneCount = (hasMorning ? 1 : 0) + (hasEvening ? 1 : 0) + (hasFoods ? 1 : 0)
  const isToday = date === todayString

  return (
    <div>
      <div className="page-header">
        <DateHeaderWithCalendar
          variant="page"
          selected={date}
          onDateChange={updateDate}
          todayHint="Track meals, find triggers, feel better."
        />
      </div>

      {loading ? (
        <>
          <SkeletonCard />
          <div style={{ marginTop: '0.75rem' }}><SkeletonCard /></div>
          <div style={{ marginTop: '0.75rem' }}><SkeletonCard /></div>
        </>
      ) : (
        <>
          {isToday && (
            <div className="progress-strip">
              <div className="progress-strip__dots">
                <div className={`progress-dot ${hasMorning ? 'progress-dot--done' : ''}`} />
                <div className={`progress-dot ${hasFoods ? 'progress-dot--done' : ''}`} />
                <div className={`progress-dot ${hasEvening ? 'progress-dot--done' : ''}`} />
              </div>
              <span>
                {doneCount === 3
                  ? 'All done for today'
                  : doneCount === 0
                    ? 'Start your day — log a check-in or meal'
                    : `${doneCount} of 3 done today`}
              </span>
            </div>
          )}

          {CHECKIN_SECTIONS.map((section, index) => {
            const checkin = getCheckin(section.period)
            const metrics = checkin ? getCheckinMetricDisplay(checkin) : []

            return (
              <div key={section.period} className="card" style={{ marginTop: index === 0 ? 0 : '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: checkin ? '0.75rem' : 0 }}>
                  <div className="card__label" style={{ marginBottom: 0 }}>{section.title}</div>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    onClick={() => navigate(`/checkin?date=${date}&period=${section.period}`)}
                  >
                    {checkin ? 'Edit' : 'Add'}
                  </button>
                </div>

                {checkin ? (
                  <>
                    {(() => {
                      const answeredMetrics = metrics.filter((m) => m.value > 0)
                      const isPartial = answeredMetrics.length < metrics.length
                      return (
                        <>
                          <p className="checkin-summary__headline">
                            {isPartial
                              ? `${section.period === 'morning' ? 'Morning' : 'Evening'} check-in — ${answeredMetrics.length} of ${metrics.length} logged`
                              : section.period === 'morning' ? 'Morning check-in complete' : 'Evening check-in complete'}
                          </p>
                          <div className="checkin-summary">
                            {answeredMetrics.map((metric) => (
                              <div key={metric.id} className="checkin-stat">
                                <span className="checkin-stat__label">{metric.label}</span>
                                <div
                                  className="checkin-stat__value"
                                  style={{ background: ratingColor(metric.value, metric.direction === 'higher_worse') }}
                                >
                                  {metric.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <button className="btn btn--ghost btn--full" onClick={() => navigate(`/checkin?date=${date}&period=${section.period}`)}>
                    {section.emptyLabel}
                  </button>
                )}
              </div>
            )
          })}

          <div className="card" style={{ marginTop: '0.75rem' }}>
            <div className="card__label">Food Log</div>
            {foods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
                  No meals logged yet. What did you eat?
                </p>
                <button className="btn btn--primary btn--full" onClick={() => navigate(`/log?date=${date}`)}>
                  Log Your First Meal
                </button>
              </div>
            ) : (
              <>
                {MEAL_ORDER.map((m) => {
                  const items = foods.filter((f) => f.meal === m.slot)
                  if (items.length === 0) return null
                  return (
                    <div key={m.slot} className="meal-section">
                      <div className="meal-header">
                        <span className="meal-title">{m.emoji} {m.label}</span>
                      </div>
                      <div className="meal-items">
                        {items.map((item) => (
                          <div key={item.id} className="meal-item">
                            <span>{item.description}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                              <span className="meal-item__tags">
                                {item.tags.slice(0, 3).map((t) => (
                                  <span key={t} title={t}>{t === 'dairy' ? '🧀' : t === 'gluten' ? '🍞' : t === 'sugar' ? '🍬' : t === 'spicy' ? '🌶️' : t === 'caffeine' ? '☕' : '·'}</span>
                                ))}
                              </span>
                              <button className="meal-item__edit" onClick={() => navigate(`/log?date=${date}&edit=${item.id}`)}>✎</button>
                              <button className="meal-item__delete" onClick={() => handleDelete(item)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <button
                  className="btn btn--ghost btn--full"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => navigate(`/log?date=${date}`)}
                >
                  + Add More
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className={`undo-bar ${undoItem ? 'undo-bar--visible' : ''}`}>
        <span>Deleted</span>
        <button className="undo-bar__btn" onClick={handleUndo}>Undo</button>
      </div>
    </div>
  )
}
