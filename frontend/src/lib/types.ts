export interface CalEvent {
  id: number
  selection_id: number
  title: string
  start: string
  end: string
  all_day: boolean
  location: string
  description: string
  color: string
  person_name: string
}

export interface Selection {
  id: number
  account_id: number
  calendar_id: string
  name: string
  person_name: string
  color: string
  enabled: boolean
}

export interface CalendarStatus {
  client_config: boolean
  redirect_uri: string
  accounts: { id: number; email: string; selections: Selection[] }[]
}

export interface Task {
  id: number
  source: 'icloud' | 'alexa' | 'local'
  list_name: string
  title: string
  notes: string
  due_date: string
  person_name: string
  completed: boolean
  completed_at: string | null
}

export interface ShoppingItem {
  id: number
  title: string
  completed: boolean
  sources: string[]
}

export interface Recipe {
  id: number
  title: string
  image_url: string
  total_time: string
  servings: string
  tags: string[]
  source_url: string
  prep_time?: string
  cook_time?: string
  ingredients?: string[]
  steps?: string[]
}

export interface MealSlot {
  date: string
  slot: string
  text: string
  recipe_id: number | null
  recipe_title: string | null
  recipe_image: string | null
}

export interface MealDay {
  date: string
  slots: { breakfast: MealSlot | null; lunch: MealSlot | null; dinner: MealSlot | null }
}

export interface SetupStatus {
  sync: Record<string, { ok: boolean; detail: string; at: string }>
  icloud: { connected: boolean; needs_2fa: boolean; error: string }
  alexa: { connected: boolean; error: string }
  gemini_configured: boolean
  gemini_model: string
  icloud_configured: boolean
  amazon_configured: boolean
  settings: {
    icloud_shopping_list: string
    icloud_task_lists: string[] | null
    list_person_map: Record<string, string>
    secondary_tz?: string
    secondary_tz_emoji?: string
  }
}

export interface WeatherInfo {
  code: number
  icon: string
  label: string
  kind: string
}

export interface WeatherDay extends WeatherInfo {
  date: string
  tmax: number
  tmin: number
  precip?: number
  sunrise?: string
  sunset?: string
}

export interface WeatherHour extends WeatherInfo {
  time: string
  temp: number
  precip: number
}

export interface WeatherData {
  configured: boolean
  unit?: string
  current: (WeatherInfo & {
    temp: number
    feels_like?: number
    humidity?: number
    wind?: number
  }) | null
  hourly?: WeatherHour[]
  daily: WeatherDay[]
}

export interface ChoreItem {
  id: number
  title: string
  assigned_to: string
  coins: number
  due_date: string
  notes: string
  recurrence: string
  completed: boolean
  completed_at: string | null
  created_at: string
}

export interface RewardStoreItem {
  id: number
  title: string
  coin_cost: number
  emoji: string
}

export interface CoinBalance {
  person_name: string
  color: string
  avatar: string
  earned: number
  lost: number
  spent: number
  balance: number
}

export interface CoinTransaction {
  id: number
  person_name: string
  amount: number
  reason: string
  reference_id: number | null
  created_at: string
}

export interface RewardRedemptionItem {
  id: number
  person_name: string
  reward_title: string
  reward_emoji: string
  coins_spent: number
  redeemed_at: string
}
