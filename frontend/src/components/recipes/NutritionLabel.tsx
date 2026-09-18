import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icon'
import { api } from '../../lib/api'
import { PRESS_SPRING } from '../../lib/motion'
import type { NutritionFacts, Recipe, RecipeNutrition } from '../../lib/types'

interface NutritionLabelProps {
  recipeId: number
  nutrition?: RecipeNutrition | null
  onUpdated?: (recipe: Recipe) => void
}

// FDA Daily Values based on 2,000 calorie reference diet
const DAILY_VALUES: Record<string, number> = {
  fat: 78,        // 78g
  sat_fat: 20,    // 20g
  cholesterol: 300, // 300mg
  sodium: 2300,   // 2,300mg
  carbs: 275,     // 275g
  fiber: 28,      // 28g
  protein: 50,    // 50g
}

function parseNumber(valStr?: string | number): number | null {
  if (valStr === undefined || valStr === null) return null
  if (typeof valStr === 'number') return valStr
  const m = String(valStr).match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

function getPercentDV(valStr?: string | number, nutrientKey?: string): string | null {
  if (!valStr || !nutrientKey || !DAILY_VALUES[nutrientKey]) return null
  const n = parseNumber(valStr)
  if (n === null) return null
  const pct = Math.round((n / DAILY_VALUES[nutrientKey]) * 100)
  return `${pct}%`
}

export default function NutritionLabel({ recipeId, nutrition, onUpdated }: NutritionLabelProps) {
  const hasWebsite = Boolean(nutrition?.website && (nutrition.website.calories || nutrition.website.protein || nutrition.website.total_fat))
  const hasAi = Boolean(nutrition?.ai && (nutrition.ai.calories || nutrition.ai.protein || nutrition.ai.total_fat))

  const initialSource = useMemo<'website' | 'ai'>(() => {
    if (nutrition?.active_source === 'ai' && hasAi) return 'ai'
    if (hasWebsite) return 'website'
    if (hasAi) return 'ai'
    return 'website'
  }, [nutrition, hasWebsite, hasAi])

  const [activeTab, setActiveTab] = useState<'website' | 'ai'>(initialSource)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Determine current active facts to display
  const currentFacts: NutritionFacts | undefined =
    activeTab === 'website'
      ? (nutrition?.website || undefined)
      : (nutrition?.ai || undefined)

  const handleToggleSource = async (tab: 'website' | 'ai') => {
    setActiveTab(tab)
    try {
      const updated = await api.post<Recipe>(`/api/recipes/${recipeId}/nutrition`, { active_source: tab })
      onUpdated?.(updated)
    } catch (e) {
      console.warn('Failed to save active nutrition source preference', e)
    }
  }

  const handleGenerateAiEstimate = async () => {
    setLoading(true)
    setError('')
    try {
      const updated = await api.post<Recipe>(`/api/recipes/${recipeId}/nutrition/ai-estimate`)
      onUpdated?.(updated)
      setActiveTab('ai')
    } catch (e: any) {
      console.error('Failed to calculate AI nutrition', e)
      setError(e?.detail || e?.message || 'Failed to estimate nutrition with AI.')
    } finally {
      setLoading(false)
    }
  }

  const handleFetchWebsiteOrAi = async () => {
    setLoading(true)
    setError('')
    try {
      const updated = await api.post<Recipe>(`/api/recipes/${recipeId}/nutrition`)
      onUpdated?.(updated)
      if (updated.nutrition?.website) {
        setActiveTab('website')
      } else if (updated.nutrition?.ai) {
        setActiveTab('ai')
      }
    } catch (e: any) {
      console.error('Failed to calculate nutrition', e)
      setError(e?.detail || e?.message || 'Failed to compute nutrition.')
    } finally {
      setLoading(false)
    }
  }

  // If no nutrition data is available at all
  if (!hasWebsite && !hasAi) {
    return (
      <div className="glass-inset rounded-2xl p-4 mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥗</span>
          <div>
            <h3 className="font-semibold text-sm lg:text-base text-ink">Nutrition Facts</h3>
            <p className="text-xs text-ink-soft">Not calculated for this recipe yet</p>
          </div>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={PRESS_SPRING}
          disabled={loading}
          onClick={handleFetchWebsiteOrAi}
          className="btn-primary flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs lg:text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Analyzing with AI (Gemini 3.8)...</span>
            </>
          ) : (
            <>
              <Icon name="auto_awesome" className="text-base" />
              <span>Calculate Nutrition (AI)</span>
            </>
          )}
        </motion.button>
      </div>
    )
  }

  return (
    <div className="glass-inset rounded-2xl p-4 mt-3 flex flex-col gap-3 text-ink">
      {/* Source Toggle Tabs */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-full">
            {hasWebsite && (
              <button
                type="button"
                onClick={() => handleToggleSource('website')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'website'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon name="language" className="text-sm" />
                <span>Website</span>
              </button>
            )}
            {hasAi && (
              <button
                type="button"
                onClick={() => handleToggleSource('ai')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'ai'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon name="auto_awesome" className="text-sm" />
                <span>AI Estimate</span>
              </button>
            )}
            {!hasAi && hasWebsite && (
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerateAiEstimate}
                className="py-1 px-2.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                title="Generate Gemini 3.8 AI estimation to compare accuracy with website numbers"
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                ) : (
                  <>
                    <Icon name="auto_awesome" className="text-sm" />
                    <span>+ AI Estimate</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Accuracy Comparison Note if both exist */}
        {hasWebsite && hasAi && (
          <div className="flex items-center justify-between px-1 text-[0.7rem] text-ink-soft">
            <span>
              Comparing: <strong>Website</strong> vs <strong>Gemini 3.8 AI</strong>
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerateAiEstimate}
              className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-0.5"
            >
              {loading ? 'Recalculating...' : '↻ Re-estimate AI'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

      {/* FDA-style Nutrition Facts Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl border-2 border-ink/40 bg-white/70 dark:bg-black/40 p-3.5 shadow-sm text-ink select-none font-sans"
        >
          {/* Header */}
          <div className="border-b-8 border-ink pb-1">
            <h2 className="text-2xl font-black uppercase tracking-tight leading-none">
              Nutrition Facts
            </h2>
            <div className="mt-1 flex flex-col text-xs text-ink font-medium leading-tight">
              {currentFacts?.servings_per_recipe && (
                <div>Servings Per Recipe: {currentFacts.servings_per_recipe}</div>
              )}
              <div className="font-bold">
                Serving size: {currentFacts?.serving_size || '1 serving'}
              </div>
            </div>
          </div>

          {/* Amount Per Serving / Calories */}
          <div className="border-b-4 border-ink py-1.5">
            <div className="text-[0.7rem] font-bold text-ink-soft uppercase tracking-wide">
              Amount per serving
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black">Calories</span>
              <span className="text-3xl font-black tracking-tight">
                {currentFacts?.calories !== undefined ? currentFacts.calories : '—'}
              </span>
            </div>
          </div>

          {/* % Daily Value Header */}
          <div className="border-b border-ink/40 py-1 text-right">
            <span className="text-[0.68rem] font-bold text-ink">% Daily Value*</span>
          </div>

          {/* Macro Rows */}
          <div className="divide-y divide-ink/20 text-xs">
            {/* Total Fat */}
            <div className="py-1">
              <div className="flex justify-between">
                <span>
                  <strong>Total Fat</strong> {currentFacts?.total_fat || '0g'}
                </span>
                <span className="font-bold">
                  {getPercentDV(currentFacts?.total_fat, 'fat') || '—'}
                </span>
              </div>
              {/* Saturated Fat */}
              {currentFacts?.saturated_fat && (
                <div className="flex justify-between pl-4 text-ink-soft text-[0.7rem] pt-0.5">
                  <span>Saturated Fat {currentFacts.saturated_fat}</span>
                  <span className="font-bold text-ink">
                    {getPercentDV(currentFacts.saturated_fat, 'sat_fat') || ''}
                  </span>
                </div>
              )}
              {/* Trans Fat */}
              {currentFacts?.trans_fat && (
                <div className="flex justify-between pl-4 text-ink-soft text-[0.7rem] pt-0.5">
                  <span><em>Trans</em> Fat {currentFacts.trans_fat}</span>
                </div>
              )}
            </div>

            {/* Cholesterol */}
            {currentFacts?.cholesterol && (
              <div className="flex justify-between py-1">
                <span>
                  <strong>Cholesterol</strong> {currentFacts.cholesterol}
                </span>
                <span className="font-bold">
                  {getPercentDV(currentFacts.cholesterol, 'cholesterol') || '—'}
                </span>
              </div>
            )}

            {/* Sodium */}
            <div className="flex justify-between py-1">
              <span>
                <strong>Sodium</strong> {currentFacts?.sodium || '0mg'}
              </span>
              <span className="font-bold">
                {getPercentDV(currentFacts?.sodium, 'sodium') || '—'}
              </span>
            </div>

            {/* Total Carbohydrate */}
            <div className="py-1">
              <div className="flex justify-between">
                <span>
                  <strong>Total Carbohydrate</strong> {currentFacts?.total_carbohydrate || '0g'}
                </span>
                <span className="font-bold">
                  {getPercentDV(currentFacts?.total_carbohydrate, 'carbs') || '—'}
                </span>
              </div>
              {/* Dietary Fiber */}
              {currentFacts?.dietary_fiber && (
                <div className="flex justify-between pl-4 text-ink-soft text-[0.7rem] pt-0.5">
                  <span>Dietary Fiber {currentFacts.dietary_fiber}</span>
                  <span className="font-bold text-ink">
                    {getPercentDV(currentFacts.dietary_fiber, 'fiber') || ''}
                  </span>
                </div>
              )}
              {/* Sugars */}
              {currentFacts?.sugars && (
                <div className="flex justify-between pl-4 text-ink-soft text-[0.7rem] pt-0.5">
                  <span>Total Sugars {currentFacts.sugars}</span>
                </div>
              )}
            </div>

            {/* Protein */}
            <div className="py-1">
              <div className="flex justify-between">
                <span>
                  <strong>Protein</strong> {currentFacts?.protein || '0g'}
                </span>
                <span className="font-bold">
                  {getPercentDV(currentFacts?.protein, 'protein') || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="border-t-4 border-ink pt-1.5 mt-1 text-[0.65rem] text-ink-soft leading-tight">
            * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet of 2,000 calories.
          </div>

          {/* Provenance Badge */}
          <div className="mt-2.5 pt-2 border-t border-ink/20 flex items-center justify-between text-[0.7rem]">
            {activeTab === 'website' ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <Icon name="verified" className="text-sm" /> Verified from recipe website
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400">
                <Icon name="auto_awesome" className="text-sm" /> Estimated with Gemini 3.8
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
