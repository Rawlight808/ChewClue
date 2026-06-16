import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, subDays, isValid, parseISO } from 'date-fns'
import { DateHeaderWithCalendar } from '../components/DateHeaderWithCalendar'
import { v4 as uuid } from 'uuid'
import { cloudSaveFoodEntry, cloudGetFoodEntry, cloudGetFoodEntriesForDate, cloudDeleteFoodEntry } from '../cloudStore'
import { BUILT_IN_TAGS } from '../types'
import { getCustomTags, addCustomTag, removeCustomTag } from '../customTags'
import { getAutoTags } from '../autoTags'
import { learnMeal, getLearnedTagsFor } from '../learnedMeals'
import type { FoodEntry, MealSlot, TagDef } from '../types'

function useToast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<number>(0)
  const show = (text: string, ms = 2000) => {
    clearTimeout(timer.current)
    setMsg(text)
    setVisible(true)
    timer.current = window.setTimeout(() => setVisible(false), ms)
  }
  return { msg, visible, show }
}

const MEALS: { slot: MealSlot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { slot: 'lunch', label: 'Lunch', emoji: '☀️' },
  { slot: 'dinner', label: 'Dinner', emoji: '🌙' },
  { slot: 'supplement', label: 'Supplement', emoji: '💊' },
]

const TAG_ICON: Record<string, string> = {
  dairy: '🧀',
  gluten: '🍞',
  sugar: '🍬',
  spicy: '🌶️',
  caffeine: '☕',
}

function resolveDate(param: string | null): string {
  if (param && isValid(parseISO(param))) return param
  return format(new Date(), 'yyyy-MM-dd')
}

export function LogFoodPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const dateParam = searchParams.get('date')
  const editId = searchParams.get('edit')
  const isEdit = !!editId

  const [selectedDate, setSelectedDate] = useState(() => resolveDate(dateParam))
  const [meal, setMeal] = useState<MealSlot>('breakfast')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState(isEdit)
  const [dateEntries, setDateEntries] = useState<FoodEntry[]>([])
  const [loadingDateEntries, setLoadingDateEntries] = useState(true)
  const [entryId, setEntryId] = useState<string>(() => editId ?? uuid())
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string | null>(null)
  const [customTags, setCustomTags] = useState<TagDef[]>(() => getCustomTags())
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [autoApplied, setAutoApplied] = useState(false)
  const [learnedApplied, setLearnedApplied] = useState(false)
  // Tags added by auto-tagging (vs picked by hand) and suggestions the user dismissed
  const autoAddedRef = useRef<Set<string>>(new Set())
  const dismissedSuggestionsRef = useRef<Set<string>>(new Set())
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => [...BUILT_IN_TAGS, ...customTags], [customTags])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const isToday = selectedDate === todayStr
  const isYesterday = selectedDate === yesterdayStr
  const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(new Date(selectedDate + 'T12:00:00'), 'EEE, MMM d')

  const refreshDateEntries = useCallback(async () => {
    setLoadingDateEntries(true)
    setDateEntries(await cloudGetFoodEntriesForDate(selectedDate))
    setLoadingDateEntries(false)
  }, [selectedDate])

  const loadEntry = useCallback(async () => {
    if (!editId) return
    setLoadingEntry(true)
    const entry = await cloudGetFoodEntry(editId)
    if (entry) {
      setEntryId(entry.id)
      setSelectedDate(entry.date)
      setMeal(entry.meal)
      setDescription(entry.description)
      setTags(new Set(entry.tags))
      setOriginalCreatedAt(entry.createdAt)
    }
    setLoadingEntry(false)
  }, [editId])

  useEffect(() => { loadEntry() }, [loadEntry])
  useEffect(() => { refreshDateEntries() }, [refreshDateEntries])

  useEffect(() => {
    if (editId) return
    setSelectedDate(resolveDate(dateParam))
  }, [dateParam, editId])

  const changeLogDate = (next: string) => {
    setSelectedDate(next)
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('date', next)
      return n
    })
  }

  useEffect(() => {
    if (loadingEntry) return
    const trimmed = description.trim()
    // Tags learned from a past identical meal, plus keyword auto-tags. Filter
    // learned tags to ones that still exist (a custom tag may have been deleted).
    const knownIds = new Set(allTags.map((t) => t.id))
    const learnedTags = trimmed
      ? getLearnedTagsFor(description).filter((id) => knownIds.has(id))
      : []
    const suggested = new Set<string>([
      ...(trimmed ? getAutoTags(description) : []),
      ...learnedTags,
    ])

    setTags((prev) => {
      const next = new Set(prev)
      // Drop auto-added tags that no longer match (e.g. "stea" matched tea,
      // but "steak" doesn't). Manually picked tags are never touched.
      for (const t of autoAddedRef.current) {
        if (!suggested.has(t)) next.delete(t)
      }
      for (const t of suggested) {
        if (!next.has(t) && !dismissedSuggestionsRef.current.has(t)) next.add(t)
      }
      return next
    })

    for (const t of [...autoAddedRef.current]) {
      if (!suggested.has(t)) autoAddedRef.current.delete(t)
    }
    for (const t of suggested) {
      if (!tags.has(t) && !dismissedSuggestionsRef.current.has(t)) autoAddedRef.current.add(t)
    }

    setAutoApplied(suggested.size > 0)
    setLearnedApplied(learnedTags.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, loadingEntry])

  const toggleTag = (tag: string) => {
    if (tags.has(tag)) {
      // Removing an auto-added tag counts as dismissing the suggestion,
      // so it doesn't immediately get re-applied on the next keystroke.
      if (autoAddedRef.current.has(tag)) dismissedSuggestionsRef.current.add(tag)
      autoAddedRef.current.delete(tag)
    } else {
      dismissedSuggestionsRef.current.delete(tag)
      autoAddedRef.current.delete(tag)
    }
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
      id: entryId,
      date: selectedDate,
      meal,
      description: description.trim(),
      tags: [...tags],
      createdAt: originalCreatedAt ?? new Date().toISOString(),
    })

    // Remember this meal's tags so the same description auto-tags next time
    learnMeal(description, [...tags])

    setSaving(false)
    await refreshDateEntries()
    if (isEdit) {
      const returnDate = selectedDate === todayStr ? '' : `?date=${selectedDate}`
      navigate(`/${returnDate}`)
      return
    }

    const savedMealLabel = MEALS.find((m) => m.slot === meal)?.label ?? 'Entry'
    toast.show(`${savedMealLabel} saved`)
    setDescription('')
    setTags(new Set([...tags].filter((tagId) => tagId.startsWith('custom_'))))
    setAutoApplied(false)
    setLearnedApplied(false)
    setEntryId(uuid())
    setOriginalCreatedAt(null)
    inputRef.current?.focus()
  }

  const setDayShortcut = (target: 'today' | 'yesterday') => {
    changeLogDate(target === 'today' ? todayStr : yesterdayStr)
  }

  const handleDeleteEntry = async (id: string) => {
    await cloudDeleteFoodEntry(id)

    if (id === entryId) {
      navigate(selectedDate === todayStr ? '/log' : `/log?date=${selectedDate}`)
      return
    }

    setDateEntries((current) => current.filter((entry) => entry.id !== id))
  }

  if (loadingEntry) {
    return <p style={{ textAlign: 'center', color: 'var(--clr-text-muted)', padding: '2rem' }}>Loading...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Entry' : 'Log Food'}</h1>
        <p className="page-subtitle">{isEdit ? 'Update meal, tags, or date below.' : 'What did you eat?'}</p>
      </div>

      <DateHeaderWithCalendar
        selected={selectedDate}
        onDateChange={changeLogDate}
        todayHint="Choose another day to log or edit meals."
      />

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card__label">Meals For {dateLabel}</div>
        {loadingDateEntries ? (
          <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>Loading meals...</p>
        ) : dateEntries.length === 0 ? (
          <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>No meals logged for this date yet.</p>
        ) : (
          <div className="meal-items">
            {dateEntries.map((entry) => (
              <div key={entry.id} className="meal-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginBottom: '0.1rem' }}>
                    {MEALS.find((mealOption) => mealOption.slot === entry.meal)?.label ?? entry.meal}
                    {entry.id === entryId ? ' · Editing' : ''}
                  </div>
                  <span>{entry.description}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  <span className="meal-item__tags">
                    {entry.tags.slice(0, 3).map((tag) => (
                      <span key={tag} title={tag}>{TAG_ICON[tag] ?? '🏷️'}</span>
                    ))}
                  </span>
                  <button className="meal-item__edit" onClick={() => navigate(`/log?date=${selectedDate}&edit=${entry.id}`)}>✎</button>
                  <button className="meal-item__delete" onClick={() => handleDeleteEntry(entry.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isEdit && (isToday || isYesterday) && (
        <div className="day-toggle">
          <button
            className={`day-toggle__btn ${isToday ? 'day-toggle__btn--active' : ''}`}
            onClick={() => setDayShortcut('today')}
          >
            Today
          </button>
          <button
            className={`day-toggle__btn ${isYesterday ? 'day-toggle__btn--active' : ''}`}
            onClick={() => setDayShortcut('yesterday')}
          >
            Yesterday
          </button>
        </div>
      )}

      {!isEdit && !isToday && !isYesterday && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-muted)' }}>
          Logging for <strong style={{ color: 'var(--clr-text)' }}>{dateLabel}</strong>
        </div>
      )}

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
          ref={inputRef}
          className="input"
          placeholder="e.g. Eggs, toast with butter, coffee"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && description.trim()) handleSave() }}
          autoFocus
        />
        {autoApplied && tags.size > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--clr-accent)', marginTop: '0.35rem' }}>
            {learnedApplied ? 'Auto-tagged from a meal you saved before' : 'Auto-tagged based on what you typed'}
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

      <div style={{ height: '5rem' }} />

      <div className="sticky-save">
        <button
          className="btn btn--primary btn--full"
          onClick={handleSave}
          disabled={!description.trim() || saving}
          style={{ opacity: description.trim() && !saving ? 1 : 0.45 }}
        >
          {saving ? 'Saving...' : isEdit ? 'Update Entry' : 'Save Entry'}
        </button>
      </div>

      <div className={`toast toast--success ${toast.visible ? 'toast--visible' : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}
