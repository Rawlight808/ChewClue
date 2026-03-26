import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays, subDays } from 'date-fns'
import { cloudGetFoodEntriesForDate, cloudGetCheckinForDate, cloudDeleteFoodEntry } from '../cloudStore'
import type { FoodEntry, DailyCheckin, MealSlot } from '../types'

const MEAL_ORDER: { slot: MealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { slot: 'lunch', label: 'Lunch', emoji: '☀️' },
  { slot: 'dinner', label: 'Dinner', emoji: '🌙' },
  { slot: 'snack', label: 'Snacks', emoji: '🍿' },
]

function ratingColor(val: number, invert = false) {
  const v = invert ? 6 - val : val
  if (v >= 4) return 'var(--clr-green)'
  if (v >= 3) return 'var(--clr-orange)'
  return 'var(--clr-red)'
}

export function TodayPage() {
  const navigate = useNavigate()
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [foods, setFoods] = useState<FoodEntry[]>([])
  const [checkin, setCheckin] = useState<DailyCheckin | undefined>()
  const [loading, setLoading] = useState(true)
  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [f, c] = await Promise.all([
      cloudGetFoodEntriesForDate(date),
      cloudGetCheckinForDate(date),
    ])
    setFoods(f)
    setCheckin(c)
    setLoading(false)
  }, [date])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    await cloudDeleteFoodEntry(id)
    setFoods((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button className="btn btn--ghost" style={{ padding: '0.4rem' }} onClick={() => setDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>
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
            onClick={() => { if (!isToday) setDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd')) }}
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
          <div className="card">
            <div className="card__label">Morning Check-In</div>
            {checkin ? (
              <div className="checkin-summary">
                {([
                  { key: 'energy', label: 'Energy' },
                  { key: 'mood', label: 'Mood' },
                  { key: 'pain', label: 'Pain' },
                  { key: 'bowel', label: 'Bowel' },
                  { key: 'sleepQuality', label: 'Sleep' },
                ] as const).map((s) => (
                  <div key={s.key} className="checkin-stat">
                    <div
                      className="checkin-stat__value"
                      style={{ background: ratingColor(checkin[s.key], s.key === 'pain') }}
                    >
                      {checkin[s.key]}
                    </div>
                    <span className="checkin-stat__label">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <button className="btn btn--ghost btn--full" onClick={() => navigate('/checkin')}>
                + Log Morning Check-In
              </button>
            )}
          </div>

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
