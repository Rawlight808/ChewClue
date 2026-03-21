import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { cloudSaveFoodEntry } from '../cloudStore'
import { BUILT_IN_TAGS } from '../types'
import { getCustomTags, addCustomTag, removeCustomTag } from '../customTags'
import { getAutoTags } from '../autoTags'
import type { MealSlot, TagDef } from '../types'

const MEALS: { slot: MealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { slot: 'lunch', label: 'Lunch', emoji: '☀️' },
  { slot: 'dinner', label: 'Dinner', emoji: '🌙' },
  { slot: 'snack', label: 'Snack', emoji: '🍿' },
]

type DayOption = 'today' | 'yesterday'

export function LogFoodPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [day, setDay] = useState<DayOption>(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && dateParam === format(subDays(new Date(), 1), 'yyyy-MM-dd')) {
      return 'yesterday'
    }
    return 'today'
  })
  const [meal, setMeal] = useState<MealSlot>('breakfast')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [customTags, setCustomTags] = useState<TagDef[]>(() => getCustomTags())
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [autoApplied, setAutoApplied] = useState(false)

  const allTags = useMemo(() => [...BUILT_IN_TAGS, ...customTags], [customTags])

  const selectedDate = day === 'today'
    ? format(new Date(), 'yyyy-MM-dd')
    : format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // Auto-tag when description changes
  useEffect(() => {
    if (!description.trim()) {
      if (autoApplied) {
        setTags(new Set())
        setAutoApplied(false)
      }
      return
    }

    const suggested = getAutoTags(description)
    if (suggested.size > 0) {
      setTags((prev) => {
        const next = new Set(prev)
        for (const t of suggested) next.add(t)
        return next
      })
      setAutoApplied(true)
    }
  }, [description])

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  const handleAddCustomTag = () => {
    const name = newTagName.trim()
    if (!name) return
    const existing = allTags.find((t) => t.label.toLowerCase() === name.toLowerCase())
    if (existing) {
      setTags((prev) => new Set(prev).add(existing.id))
    } else {
      const tag = addCustomTag(name)
      setCustomTags(getCustomTags())
      setTags((prev) => new Set(prev).add(tag.id))
    }
    setNewTagName('')
    setShowAddTag(false)
  }

  const handleRemoveCustomTag = (id: string) => {
    removeCustomTag(id)
    setCustomTags(getCustomTags())
    setTags((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!description.trim() || saving) return
    setSaving(true)

    await cloudSaveFoodEntry({
      id: uuid(),
      date: selectedDate,
      meal,
      description: description.trim(),
      tags: [...tags],
      createdAt: new Date().toISOString(),
    })

    setSaving(false)
    setDescription('')
    setTags(new Set())
    setAutoApplied(false)
    navigate('/')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Log Food</h1>
        <p className="page-subtitle">What did you eat?</p>
      </div>

      <div className="day-toggle">
        <button
          className={`day-toggle__btn ${day === 'today' ? 'day-toggle__btn--active' : ''}`}
          onClick={() => setDay('today')}
        >
          Today
        </button>
        <button
          className={`day-toggle__btn ${day === 'yesterday' ? 'day-toggle__btn--active' : ''}`}
          onClick={() => setDay('yesterday')}
        >
          Yesterday
        </button>
      </div>

      <div className="meal-tabs">
        {MEALS.map((m) => (
          <button
            key={m.slot}
            className={`meal-tab ${meal === m.slot ? 'meal-tab--active' : ''}`}
            onClick={() => setMeal(m.slot)}
          >
            {m.emoji}<br />{m.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card__label">What did you eat?</div>
        <input
          className="input"
          placeholder="e.g. Eggs, toast with butter, coffee"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
        {autoApplied && tags.size > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--clr-accent)', marginTop: '0.35rem' }}>
            Auto-tagged based on what you typed
          </p>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card__label">Food Tags</div>
          <button
            className="btn btn--ghost"
            style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setShowAddTag(!showAddTag)}
          >
            + Custom
          </button>
        </div>

        {showAddTag && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
              autoFocus
            />
            <button
              className="btn btn--primary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              onClick={handleAddCustomTag}
              disabled={!newTagName.trim()}
            >
              Add
            </button>
          </div>
        )}

        <div className="tag-grid">
          {allTags.map((t) => (
            <button
              key={t.id}
              className={`tag-chip ${tags.has(t.id) ? 'tag-chip--selected' : ''}`}
              onClick={() => toggleTag(t.id)}
            >
              {t.emoji} {t.label}
              {t.id.startsWith('custom_') && (
                <span
                  className="tag-chip__remove"
                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomTag(t.id) }}
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button
          className="btn btn--primary btn--full"
          onClick={handleSave}
          disabled={!description.trim() || saving}
          style={{ opacity: description.trim() && !saving ? 1 : 0.45 }}
        >
          {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </div>
  )
}
