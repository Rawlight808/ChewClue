export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodTag = string

export type TagDef = { id: string; label: string; emoji: string }

export const BUILT_IN_TAGS: TagDef[] = [
  { id: 'dairy', label: 'Dairy', emoji: '🧀' },
  { id: 'gluten', label: 'Gluten', emoji: '🍞' },
  { id: 'bread', label: 'Bread', emoji: '🥖' },
  { id: 'sugar', label: 'Sugar', emoji: '🍬' },
  { id: 'fried', label: 'Fried', emoji: '🍟' },
  { id: 'spicy', label: 'Spicy', emoji: '🌶️' },
  { id: 'alcohol', label: 'Alcohol', emoji: '🍷' },
  { id: 'caffeine', label: 'Caffeine', emoji: '☕' },
  { id: 'processed', label: 'Processed', emoji: '📦' },
  { id: 'raw', label: 'Raw', emoji: '🥗' },
  { id: 'fermented', label: 'Fermented', emoji: '🫙' },
  { id: 'nuts', label: 'Nuts', emoji: '🥜' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'red_meat', label: 'Red Meat', emoji: '🥩' },
  { id: 'chicken', label: 'Chicken', emoji: '🍗' },
  { id: 'seafood', label: 'Seafood', emoji: '🐟' },
  { id: 'fruit', label: 'Fruit', emoji: '🍎' },
  { id: 'vegetables', label: 'Vegetables', emoji: '🥦' },
  { id: 'tomato', label: 'Tomato', emoji: '🍅' },
  { id: 'organic', label: 'Organic', emoji: '🌿' },
  { id: 'non_organic', label: 'Non-Organic', emoji: '🏭' },
  { id: 'seed_oil', label: 'Seed Oil', emoji: '🫗' },
  { id: 'supplements', label: 'Supplements', emoji: '💊' },
]

/** @deprecated Use BUILT_IN_TAGS instead */
export const FOOD_TAGS = BUILT_IN_TAGS

export type FoodEntry = {
  id: string
  date: string        // YYYY-MM-DD
  meal: MealSlot
  description: string
  tags: FoodTag[]
  createdAt: string   // ISO timestamp
}

export type BowelRating = 1 | 2 | 3 | 4 | 5

export type DailyCheckin = {
  id: string
  date: string        // YYYY-MM-DD
  sleepQuality: number   // 1–5
  energy: number         // 1–5
  mood: number           // 1–5
  pain: number           // 1–5 (1 = no pain, 5 = severe)
  bowel: BowelRating     // 1 = bad, 5 = great
  notes: string
  createdAt: string
}

export type ReminderSettings = {
  eveningReminderEnabled: boolean
  eveningReminderTime: string // HH:MM
  morningReminderEnabled: boolean
  morningReminderTime: string
}

export type TriggerInsight = {
  tag: FoodTag
  label: string
  symptom: string
  score: number        // 0–1 confidence
  occurrences: number
  avgSymptomAfter: number
  avgSymptomWithout: number
}
