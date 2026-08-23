import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import Icon from '../Icon'
import type { KidsDailyPublicResponse } from '../../lib/types'

interface MorningKidsBannerProps {
  now?: Date
  className?: string
  forceOpen?: boolean
  onClose?: () => void
}

export default function MorningKidsBanner({
  now = new Date(),
  className = '',
  forceOpen = false,
  onClose,
}: MorningKidsBannerProps) {
  const [data, setData] = useState<KidsDailyPublicResponse | null>(null)
  const [dismissedDate, setDismissedDate] = useState<string | null>(null)
  const [manuallyDismissed, setManuallyDismissed] = useState(false)
  const [showHint5, setShowHint5] = useState(false)
  const [showHint9, setShowHint9] = useState(false)
  const [showAnswersModal, setShowAnswersModal] = useState(false)

  // Fetch daily bundle
  const loadDailyContent = async () => {
    try {
      const res = await api.get<KidsDailyPublicResponse>('/api/kids-daily/today')
      if (res) {
        setData(res)
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  useEffect(() => {
    loadDailyContent()
    const storedDismissed = localStorage.getItem('kids_banner_dismissed_date')
    if (storedDismissed) {
      setDismissedDate(storedDismissed)
    }
    const interval = setInterval(loadDailyContent, 60000)
    return () => clearInterval(interval)
  }, [])

  // When forceOpen is triggered (e.g. user clicked date in header), reset manuallyDismissed
  useEffect(() => {
    if (forceOpen) {
      setManuallyDismissed(false)
    }
  }, [forceOpen])

  const isForceActive = Boolean(data?.force_active)
  const isDismissedToday = dismissedDate === data?.date

  // Active time window check:
  // Weekday (0-4): 6am - 8am
  // Weekend (5-6): 9am - 11am
  const currentDay = now.getDay()
  const isWeekend = currentDay === 0 || currentDay === 6
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const minuteOfDay = currentHour * 60 + currentMinute

  const isScheduleActive = isWeekend
    ? minuteOfDay >= 9 * 60 && minuteOfDay < 11 * 60
    : minuteOfDay >= 6 * 60 && minuteOfDay < 8 * 60

  const shouldDisplay = Boolean(
    data &&
      (forceOpen ||
        (!manuallyDismissed && (isForceActive || (isScheduleActive && !isDismissedToday))))
  )

  const handleDismiss = () => {
    setManuallyDismissed(true)
    if (data?.date) {
      localStorage.setItem('kids_banner_dismissed_date', data.date)
      setDismissedDate(data.date)
    }
    if (onClose) {
      onClose()
    }
  }

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAnswersModal) {
          setShowAnswersModal(false)
        } else if (shouldDisplay) {
          handleDismiss()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shouldDisplay, showAnswersModal])

  return (
    <AnimatePresence>
      {shouldDisplay && data && (
        /* Zero-Scroll 7ft Kiosk Card: Viewport-fitted, high contrast, auto-stretching */
        <motion.div
          key="morning-kids-banner"
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className={`fixed inset-x-2 sm:inset-x-4 lg:inset-x-6 top-2 sm:top-3 lg:top-4 bottom-2 sm:bottom-3 lg:bottom-4 z-40 max-w-[1820px] mx-auto rounded-3xl border border-white/20 bg-slate-950/95 p-3.5 sm:p-4 lg:p-5 text-white shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-black/95 flex flex-col justify-between overflow-hidden ${className}`}
        >
          {/* Header Ribbon */}
          <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-2.5 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400 shadow-inner">
                <Icon name="wb_sunny" className="text-2xl" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-none">
                    Kid's Brain Nuggets
                  </h2>
                  {isForceActive && (
                    <span className="rounded-md bg-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300 border border-rose-400/40">
                      TEST MODE
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-medium text-amber-200/90 mt-0.5">
                  Daily Vocabulary, Fun Fact & STEM Challenges
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setShowAnswersModal(true)}
                title="View answers & explanations"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 text-black hover:bg-amber-300 px-4 sm:px-5 py-2 text-sm sm:text-base font-extrabold transition active:scale-95 shadow-md cursor-pointer"
              >
                <Icon name="psychology" className="text-xl sm:text-2xl text-black" />
                <span>Answers</span>
              </button>
              <button
                onClick={handleDismiss}
                title="Dismiss for today"
                aria-label="Dismiss for today"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 hover:bg-rose-500/30 hover:text-white hover:border-rose-400/40 border border-white/15 transition active:scale-90 cursor-pointer"
              >
                <Icon name="close" className="text-xl sm:text-2xl" />
              </button>
            </div>
          </div>

          {/* 3-Column Simultaneous Full-Height Grid (Zero Scroll on 1080p) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 flex-1 min-h-0 items-stretch mt-3">
            {/* Card 1: Word of the Day (Amber Theme) */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 sm:p-4 lg:p-5 shadow-sm backdrop-blur-md overflow-hidden min-h-0">
              <div className="flex-1 min-h-0 flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-400/40">
                    <Icon name="menu_book" className="text-sm" /> Word of the Day
                  </span>
                  {data.word_of_the_day.part_of_speech && (
                    <span className="text-xs sm:text-sm italic text-white/80 font-semibold">
                      {data.word_of_the_day.part_of_speech}
                    </span>
                  )}
                </div>

                <div className="mt-1 shrink-0">
                  <h3
                    style={{ fontFamily: 'var(--font-body)' }}
                    className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-normal text-white drop-shadow leading-tight"
                  >
                    {data.word_of_the_day.word}
                  </h3>
                  <p className="text-sm sm:text-base font-bold text-amber-300 font-mono mt-0.5">
                    [{data.word_of_the_day.pronunciation}]
                  </p>
                </div>

                <div className="mt-2.5 flex-1 min-h-0 overflow-hidden">
                  <p className="text-base sm:text-lg xl:text-xl font-medium text-white/95 leading-snug line-clamp-4">
                    {data.word_of_the_day.definition}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 rounded-xl bg-amber-400/20 p-2.5 sm:p-3 text-sm sm:text-base xl:text-lg text-amber-100 italic border border-amber-400/30 leading-snug shrink-0">
                “{data.word_of_the_day.example}”
              </div>
            </div>

            {/* Card 2: Fun Fact of the Day (Emerald Theme) */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 sm:p-4 lg:p-5 shadow-sm backdrop-blur-md overflow-hidden min-h-0">
              <div className="flex-1 min-h-0 flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-300 border border-emerald-400/40">
                    <Icon name="lightbulb" className="text-sm" /> Fun Fact
                  </span>
                  {data.fun_fact.category && (
                    <span className="text-xs sm:text-sm font-bold text-emerald-200 bg-emerald-400/20 px-2 py-0.5 rounded-md">
                      {data.fun_fact.category}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3 mt-1.5 flex-1 min-h-0 overflow-hidden">
                  <span className="text-3xl sm:text-4xl xl:text-5xl shrink-0 select-none drop-shadow-md">
                    {data.fun_fact.emoji || '💡'}
                  </span>
                  <p className="text-lg sm:text-xl xl:text-2xl font-semibold text-white leading-snug drop-shadow line-clamp-5">
                    {data.fun_fact.fact}
                  </p>
                </div>
              </div>

              {data.fun_fact.did_you_know && (
                <div className="mt-2.5 rounded-xl bg-emerald-400/20 p-2.5 sm:p-3 text-sm sm:text-base xl:text-lg text-emerald-50 border border-emerald-400/30 leading-snug shrink-0">
                  <strong className="font-black text-emerald-300">Did you know? </strong>
                  {data.fun_fact.did_you_know}
                </div>
              )}
            </div>

            {/* Card 3: STEM Challenges (Purple/Indigo Theme) */}
            <div className="flex flex-col justify-between rounded-2xl border border-purple-500/35 bg-purple-500/10 p-3.5 sm:p-4 lg:p-5 shadow-sm backdrop-blur-md overflow-hidden min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-purple-300 border border-purple-400/40">
                  <Icon name="psychology" className="text-sm" /> STEM Questions
                </span>
                <span className="text-xs sm:text-sm font-bold text-purple-200">Ages 5 & 9</span>
              </div>

              <div className="flex-1 min-h-0 flex flex-col justify-between gap-2">
                {/* 5-Year Old Question Tile */}
                <div className="rounded-xl bg-purple-400/20 p-2.5 sm:p-3 border border-purple-400/30 flex-1 min-h-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-sm sm:text-base font-extrabold text-purple-200 flex items-center gap-1.5">
                        <span>🎈 Age 5</span>
                        <span className="text-[11px] font-bold text-purple-300/80">• {data.stem_5yo.topic}</span>
                      </span>
                      {data.stem_5yo.hint && (
                        <button
                          onClick={() => setShowHint5(!showHint5)}
                          className="text-xs font-bold text-purple-300 hover:text-white underline cursor-pointer"
                        >
                          {showHint5 ? 'Hide Hint' : '💡 Hint'}
                        </button>
                      )}
                    </div>
                    <p className="text-sm sm:text-base xl:text-lg font-medium text-white leading-snug line-clamp-3">
                      {data.stem_5yo.question}
                    </p>
                  </div>
                  {showHint5 && data.stem_5yo.hint && (
                    <p className="mt-1 text-xs sm:text-sm text-purple-100 italic bg-black/60 p-2 rounded-lg border border-purple-400/40 leading-snug">
                      Hint: {data.stem_5yo.hint}
                    </p>
                  )}
                </div>

                {/* 9-Year Old Question Tile */}
                <div className="rounded-xl bg-indigo-400/20 p-2.5 sm:p-3 border border-indigo-400/30 flex-1 min-h-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-sm sm:text-base font-extrabold text-indigo-200 flex items-center gap-1.5">
                        <span>🚀 Age 9</span>
                        <span className="text-[11px] font-bold text-indigo-300/80">• {data.stem_9yo.topic}</span>
                      </span>
                      {data.stem_9yo.hint && (
                        <button
                          onClick={() => setShowHint9(!showHint9)}
                          className="text-xs font-bold text-indigo-300 hover:text-white underline cursor-pointer"
                        >
                          {showHint9 ? 'Hide Hint' : '💡 Hint'}
                        </button>
                      )}
                    </div>
                    <p className="text-sm sm:text-base xl:text-lg font-medium text-white leading-snug line-clamp-3">
                      {data.stem_9yo.question}
                    </p>
                  </div>
                  {showHint9 && data.stem_9yo.hint && (
                    <p className="mt-1 text-xs sm:text-sm text-indigo-100 italic bg-black/60 p-2 rounded-lg border border-indigo-400/30 leading-snug">
                      Hint: {data.stem_9yo.hint}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-white/80 pt-1.5 border-t border-purple-400/20 shrink-0">
                <span className="font-semibold text-purple-200">Discuss at breakfast!</span>
                <button
                  onClick={() => setShowAnswersModal(true)}
                  className="font-extrabold text-amber-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="psychology" className="text-base" /> Answers Modal →
                </button>
              </div>
            </div>
          </div>

          {/* Answers Pop-up Modal */}
          <AnimatePresence>
            {showAnswersModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl"
                onClick={() => setShowAnswersModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#161618] p-5 sm:p-7 text-white shadow-2xl flex flex-col gap-5"
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400">
                        <Icon name="psychology" className="text-2xl" />
                      </span>
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                          Kid's Brain Nuggets — Answers
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-white/70">
                          Parent talking points & full explanations
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAnswersModal(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 hover:bg-white/20 transition cursor-pointer"
                    >
                      <Icon name="close" className="text-2xl" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Age 5 Answer */}
                    <div className="rounded-2xl border border-purple-500/35 bg-purple-500/10 p-4.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base sm:text-lg font-bold text-purple-300 flex items-center gap-2">
                          <span>🎈 Age 5 Challenge</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-400/25 text-purple-200">
                            {data.stem_5yo.topic}
                          </span>
                        </span>
                      </div>
                      <p className="text-base text-white/90 italic font-medium">
                        “{data.stem_5yo.question}”
                      </p>
                      <div className="rounded-xl bg-purple-950/70 p-4 border border-purple-400/30 space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-purple-300">Answer</p>
                        <p className="text-base sm:text-lg font-bold text-white leading-snug">
                          {data.stem_5yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_5yo.parent_explanation && (
                          <div className="mt-2.5 pt-2.5 border-t border-purple-400/20">
                            <p className="text-xs font-black uppercase tracking-wider text-purple-300/80">Explanation for Parents</p>
                            <p className="mt-1 text-sm sm:text-base text-purple-100/95 leading-relaxed">
                              {data.stem_5yo.parent_explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Age 9 Answer */}
                    <div className="rounded-2xl border border-indigo-500/35 bg-indigo-500/10 p-4.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base sm:text-lg font-bold text-indigo-300 flex items-center gap-2">
                          <span>🚀 Age 9 Challenge</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-400/25 text-indigo-200">
                            {data.stem_9yo.topic}
                          </span>
                        </span>
                      </div>
                      <p className="text-base text-white/90 italic font-medium">
                        “{data.stem_9yo.question}”
                      </p>
                      <div className="rounded-xl bg-indigo-950/70 p-4 border border-indigo-400/30 space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-300">Answer</p>
                        <p className="text-base sm:text-lg font-bold text-white leading-snug">
                          {data.stem_9yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_9yo.parent_explanation && (
                          <div className="mt-2.5 pt-2.5 border-t border-indigo-400/20">
                            <p className="text-xs font-black uppercase tracking-wider text-indigo-300/80">Explanation for Parents</p>
                            <p className="mt-1 text-sm sm:text-base text-indigo-100/95 leading-relaxed">
                              {data.stem_9yo.parent_explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 shrink-0">
                    <button
                      onClick={() => setShowAnswersModal(false)}
                      className="flex items-center gap-2 rounded-2xl bg-white px-6 py-2.5 text-base font-black text-black hover:bg-white/90 active:scale-95 transition shadow-md cursor-pointer"
                    >
                      <Icon name="check" className="text-xl" />
                      Got it!
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
