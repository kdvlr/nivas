import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Icon from '../components/Icon'
import { api, ApiError } from '../lib/api'
import { useData, useVoiceCommands } from '../lib/hooks'
import type { Recipe } from '../lib/types'
import Modal from '../components/Modal'
import { PRESS_SPRING } from '../lib/motion'

function detailIdFromHash() {
  const m = location.hash.match(/^#\/recipes\/(\d+)/)
  return m ? Number(m[1]) : null
}

function RecipeDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data: r, error } = useData<Recipe>(`/api/recipes/${id}`, ['recipes'])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [step, setStep] = useState(-1) // -1 = overview, otherwise cook-mode step index
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // hands-free while cooking: say "next" / "previous" / "exit"
  const stepCount = r?.steps?.length ?? 0
  const listening = useVoiceCommands(step >= 0, (cmd) => {
    if (cmd === 'next') setStep((s) => Math.min(s + 1, stepCount - 1))
    else if (cmd === 'previous') setStep((s) => Math.max(s - 1, 0))
    else setStep(-1)
  })

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-2xl text-ink-soft">Recipe not found.</p>
        <button onClick={onBack} className="btn-primary px-8 py-3 text-lg">
          Back
        </button>
      </div>
    )
  }
  if (!r) return null

  if (step >= 0 && r.steps) {
    return (
      <div className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center gap-4">
          <button
            onClick={() => setStep(-1)}
            className="btn-glass px-4 py-2 text-sm lg:text-base"
          >
            ✕ Exit
          </button>
          <h1 className="text-xl lg:text-2xl font-medium text-ink-soft">{r.title}</h1>
          {listening ? (
            <span className="btn-glass flex items-center gap-2 px-3 py-1.5 text-xs lg:text-sm !text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              🎤 say “next” · “previous” · “exit”
            </span>
          ) : (
            <span className="text-xs lg:text-sm text-ink-faint">🎤 voice off (mic unavailable)</span>
          )}
          <span className="ml-auto text-base lg:text-lg font-medium text-ink-soft">
            Step {step + 1} of {r.steps.length}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center glass p-6 lg:p-10">
          <p className="max-w-4xl text-center text-2xl lg:text-3xl font-medium leading-snug">
            {r.steps[step]}
          </p>
        </div>
        <div className="mt-3 flex gap-4">
          <button
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="flex-1 btn-glass py-4 text-xl lg:text-2xl disabled:opacity-30"
          >
            ‹ Back
          </button>
          {step < r.steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-primary flex-[2] py-4 text-xl lg:text-2xl"
            >
              Next ›
            </button>
          ) : (
            <button
              onClick={() => setStep(-1)}
              className="flex-[2] rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 py-4 text-xl lg:text-2xl font-medium text-white shadow-lg shadow-emerald-400/40 active:scale-95"
            >
              Done! 🎉
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3 lg:px-8 lg:py-4">
      <button
        onClick={onBack}
        className="mb-3 btn-glass px-4 py-2 text-sm lg:text-base"
      >
        ‹ All recipes
      </button>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        <div className="w-full lg:w-[20rem] shrink-0">
          {r.image_url ? (
            <img src={r.image_url} className="aspect-square w-full rounded-xl object-cover shadow" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center glass text-9xl">
              🍲
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(r.tags ?? []).map((t) => (
              <span key={t} className="rounded-full bg-sky-400/15 px-4 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ['Prep', r.prep_time],
              ['Cook', r.cook_time],
              ['Serves', r.servings],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="glass-inset p-3">
                  <div className="text-sm font-medium uppercase text-ink-soft">{k}</div>
                  <div className="text-lg font-medium">{v}</div>
                </div>
              ))}
          </div>
          {r.source_url && (
            <p className="mt-4 truncate text-sm text-ink-soft">from {new URL(r.source_url).hostname}</p>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm lg:text-base font-medium text-rose-600 transition-all active:scale-95 dark:border-rose-900/50 dark:bg-rose-950/30"
          >
            <Icon name="delete" /> Delete Recipe
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">{r.title}</h1>
          <button
            onClick={() => setStep(0)}
            className="mt-4 btn-primary px-4 py-2.5 text-sm lg:text-base lg:px-6"
          >
            <Icon name="skillet" /> Cook step-by-step
          </button>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <section>
              <h2 className="mb-4 text-xl font-medium">Ingredients</h2>
              <ul className="flex flex-col gap-2">
                {(r.ingredients ?? []).map((ing, i) => (
                  <li key={i}>
                    <button
                      onClick={() =>
                        setChecked((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }
                      className={`flex w-full items-start gap-3 glass-inset p-2.5 text-left text-sm lg:text-base ${
                        checked.has(i) ? 'opacity-40' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium ${
                          checked.has(i)
                            ? 'border-emerald-400 bg-emerald-400 text-white'
                            : 'border-teal-300/70 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className={checked.has(i) ? 'line-through' : ''}>{ing}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="mb-4 text-xl font-medium">Steps</h2>
              <ol className="flex flex-col gap-4">
                {(r.steps ?? []).map((s, i) => (
                  <li key={i} className="flex gap-4 glass-inset p-3 text-sm lg:text-base">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sm font-medium text-sky-700 dark:text-sky-300">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <Modal title="Delete recipe?" onClose={() => setShowDeleteConfirm(false)}>
          <div className="flex flex-col gap-6">
            <p className="text-xl text-ink-soft">
              Are you sure you want to remove <strong>{r.title}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-glass flex-1 py-4 text-xl"
              >
                No, keep it
              </button>
              <button
                onClick={async () => {
                  await api.del(`/api/recipes/${r.id}`)
                  onBack()
                }}
                className="btn-primary flex-1 bg-rose-600 py-4 text-xl text-white"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function Recipes() {
  const { data: recipes, reload } = useData<Recipe[]>('/api/recipes', ['recipes'])
  const [detailId, setDetailId] = useState<number | null>(detailIdFromHash)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'url' | 'manual'>('url')

  // Manual creation state
  const [manualTitle, setManualTitle] = useState('')
  const [manualServings, setManualServings] = useState('')
  const [manualPrepTime, setManualPrepTime] = useState('')
  const [manualCookTime, setManualCookTime] = useState('')
  const [manualTags, setManualTags] = useState('')
  const [manualIngredients, setManualIngredients] = useState('')
  const [manualSteps, setManualSteps] = useState('')
  const [manualImageUrl, setManualImageUrl] = useState('')

  const resetAddForm = () => {
    setUrl('')
    setManualTitle('')
    setManualServings('')
    setManualPrepTime('')
    setManualCookTime('')
    setManualTags('')
    setManualIngredients('')
    setManualSteps('')
    setManualImageUrl('')
    setError('')
  }

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return recipes ?? []
    return (recipes ?? []).filter((r) => {
      const titleMatch = r.title?.toLowerCase().includes(q)
      const tagMatch = r.tags?.some((t) => typeof t === 'string' && t.toLowerCase().includes(q))
      const ingredientMatch = r.ingredients?.some((ing) =>
        typeof ing === 'string'
          ? ing.toLowerCase().includes(q)
          : ing && typeof ing === 'object'
          ? Object.values(ing).some((v) => String(v).toLowerCase().includes(q))
          : false
      )
      const stepMatch = r.steps?.some((step) =>
        typeof step === 'string'
          ? step.toLowerCase().includes(q)
          : step && typeof step === 'object'
          ? Object.values(step).some((v) => String(v).toLowerCase().includes(q))
          : false
      )
      return titleMatch || tagMatch || ingredientMatch || stepMatch
    })
  }, [recipes, searchQuery])

  useEffect(() => {
    const onHash = () => setDetailId(detailIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const saveFromUrl = async () => {
    const u = url.trim()
    if (!u || saving) return
    setSaving(true)
    setError('')
    try {
      const r = await api.post<Recipe>('/api/recipes', { url: u })
      resetAddForm()
      setShowAddModal(false)
      reload()
      location.hash = `#/recipes/${r.id}`
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that recipe')
    } finally {
      setSaving(false)
    }
  }

  const saveManual = async () => {
    const title = manualTitle.trim()
    if (!title || saving) return
    setSaving(true)
    setError('')
    try {
      const ingredients = manualIngredients
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const steps = manualSteps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const tags = manualTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const prep = manualPrepTime.trim()
      const cook = manualCookTime.trim()
      const total = [prep && `Prep: ${prep}`, cook && `Cook: ${cook}`].filter(Boolean).join(' · ')

      const body = {
        title,
        servings: manualServings.trim(),
        prep_time: prep,
        cook_time: cook,
        total_time: total,
        ingredients,
        steps,
        tags,
        image_url: manualImageUrl.trim(),
        source_url: '',
      }

      const r = await api.post<Recipe>('/api/recipes/manual', body)
      resetAddForm()
      setShowAddModal(false)
      reload()
      location.hash = `#/recipes/${r.id}`
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save recipe')
    } finally {
      setSaving(false)
    }
  }

  if (detailId !== null) {
    return <RecipeDetail id={detailId} onBack={() => (location.hash = '#/recipes')} />
  }

  return (
    <div className="flex h-full flex-col px-4 py-3 lg:px-8 lg:py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Recipes</h1>
          <span className="text-sm lg:text-base font-medium text-ink-soft">
            {searchQuery.trim()
              ? `${filteredRecipes.length} found`
              : `${recipes?.length ?? 0} saved`}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={PRESS_SPRING}
          onClick={() => {
            resetAddForm()
            setShowAddModal(true)
          }}
          className="btn-primary px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer flex items-center gap-1.5"
        >
          <Icon name="add" /> Add
        </motion.button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 flex w-full max-w-xl">
        <div className="relative w-full">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by title, ingredient, tag..."
            className="w-full input-glass pl-10 pr-10 py-2.5 text-sm lg:text-base"
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft select-none pointer-events-none flex items-center">
            <Icon name="search" className="text-lg lg:text-xl" />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-transform active:scale-90 cursor-pointer flex items-center justify-center"
            >
              <Icon name="close" className="text-lg lg:text-xl" />
            </button>
          )}
        </div>
      </div>

      {!recipes ? (
        <div className="flex flex-1 items-center justify-center text-ink-soft">
          <p className="text-lg font-medium">Loading recipes...</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-soft">
          <span className="text-7xl">📖</span>
          <p className="text-xl lg:text-2xl font-medium text-center">Your recipe box is empty</p>
          <button
            onClick={() => {
              resetAddForm()
              setShowAddModal(true)
            }}
            className="btn-primary px-6 py-2.5 text-base font-medium cursor-pointer"
          >
            + Add your first recipe
          </button>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-soft">
          <span className="text-5xl">🔍</span>
          <p className="text-lg lg:text-xl font-medium text-center">No recipes found matching "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-[var(--primary)] hover:underline mt-2 font-medium cursor-pointer"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-5 overflow-y-auto pb-6 xl:grid-cols-5">
          {filteredRecipes.map((r) => (
            <a
              key={r.id}
              href={`#/recipes/${r.id}`}
              className="overflow-hidden glass transition-transform active:scale-[0.98]"
            >
              {r.image_url ? (
                <img src={r.image_url} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center surface-tile text-6xl">
                  🍲
                </div>
              )}
              <div className="p-4">
                <h3 className="line-clamp-2 text-base lg:text-lg font-medium leading-tight">{r.title}</h3>
                <p className="mt-1 text-xs lg:text-sm text-ink-soft">
                  {[r.total_time, r.servings].filter(Boolean).join(' · ')}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Add Recipe Modal */}
      {showAddModal && (
        <Modal
          title="Add Recipe"
          onClose={() => {
            setShowAddModal(false)
            resetAddForm()
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Mode Tabs */}
            <div className="flex rounded-xl p-1 glass-inset">
              <button
                type="button"
                onClick={() => setAddMode('url')}
                className={`flex-1 py-2 text-sm lg:text-base font-medium rounded-lg transition-all cursor-pointer ${
                  addMode === 'url'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                Import Link
              </button>
              <button
                type="button"
                onClick={() => setAddMode('manual')}
                className={`flex-1 py-2 text-sm lg:text-base font-medium rounded-lg transition-all cursor-pointer ${
                  addMode === 'manual'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                Create Manually
              </button>
            </div>

            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

            {addMode === 'url' ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-ink-soft">
                  Paste a link from any recipe website, blog, or cooking site to automatically extract its title, photo, ingredients, and instructions.
                </p>
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveFromUrl()}
                  placeholder="https://..."
                  className="input-glass px-4 py-3 text-base focus:outline-none"
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetAddForm()
                    }}
                    className="px-4 py-2.5 text-base font-medium text-ink-soft hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={PRESS_SPRING}
                    onClick={saveFromUrl}
                    disabled={!url.trim() || saving}
                    className="btn-primary px-6 py-2.5 text-base cursor-pointer disabled:opacity-40"
                  >
                    {saving ? 'Reading recipe...' : 'Import Recipe'}
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <label className="text-xs font-medium text-ink-soft mb-1 block">Title *</label>
                  <input
                    autoFocus
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Grandma's Chocolate Chip Cookies"
                    className="input-glass w-full px-4 py-2.5 text-base focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1 block">Servings</label>
                    <input
                      value={manualServings}
                      onChange={(e) => setManualServings(e.target.value)}
                      placeholder="e.g. 4 servings"
                      className="input-glass w-full px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1 block">Prep / Cook Time</label>
                    <input
                      value={manualPrepTime}
                      onChange={(e) => setManualPrepTime(e.target.value)}
                      placeholder="e.g. 15m prep, 30m cook"
                      className="input-glass w-full px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-soft mb-1 block">Image URL (optional)</label>
                  <input
                    value={manualImageUrl}
                    onChange={(e) => setManualImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="input-glass w-full px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-soft mb-1 block">Ingredients (one per line)</label>
                  <textarea
                    rows={4}
                    value={manualIngredients}
                    onChange={(e) => setManualIngredients(e.target.value)}
                    placeholder={"2 cups flour\n1 tsp baking soda\n1/2 cup sugar"}
                    className="input-glass w-full px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-soft mb-1 block">Steps (one per line)</label>
                  <textarea
                    rows={4}
                    value={manualSteps}
                    onChange={(e) => setManualSteps(e.target.value)}
                    placeholder={"Preheat oven to 375°F.\nMix dry ingredients in a large bowl.\nBake for 10-12 minutes."}
                    className="input-glass w-full px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetAddForm()
                    }}
                    className="px-4 py-2.5 text-base font-medium text-ink-soft hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={PRESS_SPRING}
                    onClick={saveManual}
                    disabled={!manualTitle.trim() || saving}
                    className="btn-primary px-6 py-2.5 text-base cursor-pointer disabled:opacity-40"
                  >
                    {saving ? 'Saving...' : 'Save Recipe'}
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
