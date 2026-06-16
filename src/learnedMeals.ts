// Remembers which tags a user applies to a given meal description, so the next
// time they type the same thing ChewClue can auto-apply those tags. Learning
// happens on save; matching is on the normalized description (case/spacing
// insensitive). Stored locally, same as custom tags.

const STORAGE_KEY = 'chewclue_learned_meals'

export type LearnedMeal = {
  name: string       // original (normalized) description as last saved
  tags: string[]     // tag ids
  updatedAt: string  // ISO timestamp
}

type LearnedMealMap = Record<string, LearnedMeal>

function normalizeName(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readMap(): LearnedMealMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as LearnedMealMap) : {}
  } catch {
    return {}
  }
}

function writeMap(map: LearnedMealMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* Safari private mode / storage blocked */
  }
}

export function getLearnedMeals(): LearnedMeal[] {
  return Object.values(readMap()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * Record (or update) the tags for a meal description. Saving a meal with no
 * tags forgets it, treating "cleared all tags" as a correction.
 */
export function learnMeal(description: string, tags: string[]): void {
  const key = normalizeName(description)
  if (!key) return

  const map = readMap()
  const uniqueTags = [...new Set(tags)]

  if (uniqueTags.length === 0) {
    if (map[key]) {
      delete map[key]
      writeMap(map)
    }
    return
  }

  map[key] = { name: key, tags: uniqueTags, updatedAt: new Date().toISOString() }
  writeMap(map)
}

/** Tags previously learned for an exact (normalized) description match. */
export function getLearnedTagsFor(description: string): string[] {
  const key = normalizeName(description)
  if (!key) return []
  return readMap()[key]?.tags ?? []
}

export function forgetMeal(description: string): void {
  const key = normalizeName(description)
  const map = readMap()
  if (map[key]) {
    delete map[key]
    writeMap(map)
  }
}
