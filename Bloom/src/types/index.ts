/**
 * Shared domain types for Bloom.
 * Keep this file dependency-free: data files, stores and UI all import from here.
 */

export type Trimester = 1 | 2 | 3

/** One entry of the week-by-week pregnancy guide. */
export interface WeekGuide {
  /** Gestational week, 1–42. */
  week: number
  trimester: Trimester
  /** Short headline for the week, e.g. "The heart starts beating". */
  title: string
  babySize: {
    /** Everyday object comparison, lower-case noun phrase, e.g. "a blueberry". */
    comparison: string
    /** Crown-to-rump (≤ week 20) or crown-to-heel length in centimetres. 0 when not meaningful. */
    lengthCm: number
    /** Approximate weight in grams. 0 when not meaningful. */
    weightG: number
  }
  /** 2–4 sentences on how the baby is developing this week. */
  baby: string
  /** 2–4 sentences on what the pregnant person may notice in their own body. */
  body: string
  /** 3–4 short, actionable tips. */
  tips: string[]
  /** Symptom ids (see data/symptoms.ts) commonly reported this week. */
  commonSymptoms: SymptomId[]
  /** Nutrients to emphasise this week. */
  nutritionFocus: Nutrient[]
  /** Optional key milestone, e.g. "Anatomy scan window opens". */
  milestone?: string
  /** Typical check-ups, screenings or tests that fall in this week. */
  checkups?: string[]
}

export type SymptomId =
  | 'nausea'
  | 'fatigue'
  | 'breast-tenderness'
  | 'frequent-urination'
  | 'food-aversions'
  | 'cravings'
  | 'mood-swings'
  | 'bloating'
  | 'constipation'
  | 'headache'
  | 'heartburn'
  | 'dizziness'
  | 'back-pain'
  | 'round-ligament-pain'
  | 'leg-cramps'
  | 'swelling'
  | 'insomnia'
  | 'shortness-of-breath'
  | 'braxton-hicks'
  | 'pelvic-pressure'
  | 'nasal-congestion'
  | 'skin-changes'
  | 'vivid-dreams'
  | 'increased-appetite'
  | 'carpal-tunnel'
  | 'hip-pain'

export interface SymptomDef {
  id: SymptomId
  label: string
  /** Lucide icon name is resolved in UI; keep an emoji for compact rendering. */
  emoji: string
  /** Short relief suggestion. */
  relief: string
}

export type Nutrient =
  'folate' | 'iron' | 'calcium' | 'protein' | 'omega3' | 'fiber' | 'vitaminD' | 'choline' | 'vitaminC' | 'iodine' | 'magnesium' | 'potassium'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** Dietary patterns a recipe is compatible with. */
export type DietTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'nut-free'

export type GroceryCategory = 'produce' | 'protein' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'other'

export interface Ingredient {
  item: string
  /** Human-readable quantity, e.g. "2 cups", "1 tbsp", "200 g". */
  qty: string
  category: GroceryCategory
}

export interface Recipe {
  /** kebab-case, unique, stable. */
  id: string
  name: string
  /** Meal slots this recipe fits. */
  slots: MealSlot[]
  /** One appetising sentence. */
  description: string
  prepMinutes: number
  /** Approximate kcal per serving. */
  calories: number
  /** Key pregnancy nutrients delivered. */
  nutrients: Nutrient[]
  /** Diets this recipe satisfies as written. */
  tags: DietTag[]
  ingredients: Ingredient[]
  /** 3–6 concise steps. */
  steps: string[]
  /** Trimesters it suits best (all three unless there is a reason, e.g. ginger for 1st-trimester nausea). */
  trimesters: Trimester[]
  /** One line on why this helps in pregnancy. */
  benefit: string
}

export interface FoodSafetyItem {
  id: string
  name: string
  level: 'avoid' | 'limit' | 'caution'
  reason: string
  /** Optional safer alternative. */
  alternative?: string
}

export type ReminderCategory = 'vitamin' | 'medication' | 'hydration' | 'movement' | 'appointment' | 'kick-count' | 'self-care' | 'custom'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sunday = 0

export type Recurrence = { kind: 'daily' } | { kind: 'weekly'; days: Weekday[] } | { kind: 'once'; date: string } // ISO yyyy-MM-dd

export interface Reminder {
  id: string
  title: string
  note?: string
  category: ReminderCategory
  /** 24-hour "HH:mm" local time. */
  time: string
  recurrence: Recurrence
  enabled: boolean
  /** Completion log keyed by ISO date (yyyy-MM-dd). */
  completedOn: string[]
  /** ISO timestamp the reminder was snoozed until (one-shot). */
  snoozedUntil?: string
  createdAt: string
}

export interface ReminderTemplate {
  id: string
  title: string
  note?: string
  category: ReminderCategory
  time: string
  recurrence: Recurrence
  /** Only suggest from this gestational week onward. */
  fromWeek?: number
}

export interface Appointment {
  id: string
  title: string
  /** ISO yyyy-MM-dd */
  date: string
  /** "HH:mm" */
  time?: string
  location?: string
  provider?: string
  notes?: string
  /** Questions the user wants to ask. */
  questions: string[]
  done: boolean
}

export interface AppointmentSuggestion {
  id: string
  title: string
  fromWeek: number
  toWeek: number
  description: string
}

export type Mood = 1 | 2 | 3 | 4 | 5

export interface DailyLog {
  /** ISO yyyy-MM-dd — primary key. */
  date: string
  mood?: Mood
  /** Hours of sleep. */
  sleepHours?: number
  /** Glasses of water (250 ml each). */
  waterGlasses: number
  symptoms: SymptomId[]
  /** Kick counting sessions. */
  kicks: KickSession[]
  weightKg?: number
  bloodPressure?: { systolic: number; diastolic: number }
  note?: string
  /** Minutes of gentle movement. */
  movementMinutes?: number
  /** Meal ids the user ticked as eaten. */
  mealsEaten: string[]
  updatedAt: string
}

export interface KickSession {
  id: string
  startedAt: string
  endedAt?: string
  count: number
}

export interface Contraction {
  id: string
  startedAt: string
  endedAt?: string
}

export interface ChecklistItem {
  id: string
  label: string
  /** Optional hint. */
  hint?: string
}

export interface ChecklistGroup {
  id: string
  title: string
  description: string
  /** Show from this week onward (undefined = always). */
  fromWeek?: number
  items: ChecklistItem[]
}

export type Units = 'metric' | 'imperial'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface Profile {
  name: string
  /** ISO yyyy-MM-dd of the estimated due date. */
  dueDate: string
  /** How the due date was derived. */
  dueDateSource: 'lmp' | 'due-date' | 'conception'
  heightCm?: number
  prePregnancyWeightKg?: number
  /** Expecting more than one baby changes weight-gain guidance. */
  multiples: boolean
  diet: DietTag[]
  /** Daily water target in glasses (250 ml). */
  waterGoal: number
  units: Units
  theme: ThemePreference
  /** Browser notifications opt-in. */
  notificationsEnabled: boolean
  onboardedAt: string
}
