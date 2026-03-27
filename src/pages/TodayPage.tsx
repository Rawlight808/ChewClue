import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, addDays, subDays } from 'date-fns'
import { cloudGetFoodEntriesForDate, cloudGetCheckinsForDate, cloudDeleteFoodEntry } from '../cloudStore'
import type { CheckinPeriod, FoodEntry, DailyCheckin, MealSlot } from '../types'
import { getCheckinMetricDisplay } from '../checkinCategories'

const MEAL_ORDER: { slot: MealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { slot: 'lunch', label: 'Lunch', emoji: '☀️' },
  { slot: 'dinner', label: 'Dinner', emoji: '🌙' },
  { slot: 'snack', label: 'Snacks', emoji: '🍿' },
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

export function TodayPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const todayString = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(() => searchParams.get('date') ?? todayString)
  const [foods, setFoods] = useState<FoodEntry[]>([])
  const [checkins, setCheckins] = useState<DailyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const isToday = date === todayString

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

  const handleDelete = async (id: string) => {
    await cloudDeleteFoodEntry(id)
    setFoods((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button className="btn btn--ghost" style={{ padding: '0.4rem' }} onClick={() => updateDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>
            ←
          </button>
          <div>
            <h1 className="page-title">{isToday ? 'Today' : format(new Date(date + 'T12:00:00'), 'EEE, MMM d')}</h1>
            <p className="page-subtitle">
              {isToday
                ? 'Track meals, find triggers, feel better.'
                : format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button
            className="btn btn--ghost"
            style={{ padding: '0.4rem', opacity: isToday ? 0.3 : 1 }}
            onClick={() => { if (!isToday) updateDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd')) }}
            disabled={isToday}
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--clr-text-muted)', padding: '2rem' }}>Loading...</p>
      ) : (
        <>
          {CHECKIN_SECTIONS.map((section, index) => {
            const checkin = getCheckin(section.period)

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
                    <div className="checkin-summary">
                      {getCheckinMetricDisplay(checkin).map((metric) => (
                        <div key={metric.id} className="checkin-stat">
                          <div
                            className="checkin-stat__value"
                            style={{ background: ratingColor(metric.value, metric.direction === 'higher_worse') }}
                          >
                            {metric.value}
                          </div>
                          <span className="checkin-stat__label">{metric.label}</span>
                        </div>
                      ))}
                    </div>
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
              <button className="btn btn--ghost btn--full" onClick={() => navigate(`/log?date=${date}`)}>
                + Log Your First Meal
              </button>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span className="meal-item__tags">
                                {item.tags.slice(0, 3).map((t) => (
                                  <span key={t} title={t}>{t === 'dairy' ? '🧀' : t === 'gluten' ? '🍞' : t === 'sugar' ? '🍬' : t === 'spicy' ? '🌶️' : t === 'caffeine' ? '☕' : '·'}</span>
                                ))}
                              </span>
                              <button className="meal-item__delete" onClick={() => handleDelete(item.id)}>✕</button>
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
    </div>
  )
}
