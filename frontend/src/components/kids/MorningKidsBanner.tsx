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
        /* Wall-display card: designed to remain fully visible at 1920x1080. */
        <motion.div
          key="morning-kids-banner"
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          data-testid="kids-nuggets-panel"
          className={`fixed inset-x-2 top-2 bottom-2 sm:inset-x-4 sm:top-3 sm:bottom-3 lg:inset-x-8 lg:top-4 lg:bottom-4 z-40 mx-auto flex max-w-[1856px] flex-col rounded-3xl border border-white/20 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-2xl sm:p-4 lg:p-5 dark:border-white/15 dark:bg-black/95 overflow-y-auto lg:overflow-hidden ${className}`}
        >
          {/* Header Ribbon */}
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-white/15 pb-2.5 lg:min-h-16">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400 shadow-inner">
                <Icon name="wb_sunny" className="text-2xl" />
              </span>
              <div>
                <h2 className="text-2xl font-extrabold leading-none tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Kids’ Brain Nuggets
                </h2>
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

          {/* 2x2 wall-display grid: wide reading measures and no hidden copy. */}
          <div className="mt-3 grid flex-1 grid-cols-1 gap-3 sm:gap-4 lg:min-h-0 lg:grid-cols-12 lg:grid-rows-[minmax(0,0.54fr)_minmax(0,0.46fr)] lg:gap-4">
            {/* Card 1: Word of the Day (Amber Theme) */}
            <section data-testid="kids-word-card" className="flex min-h-0 flex-col justify-between rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 shadow-sm backdrop-blur-md sm:p-4 lg:col-span-5 lg:p-5">
              <div className="flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300 lg:text-base">
                    <Icon name="menu_book" className="text-sm" /> Word of the Day
                  </span>
                  {data.word_of_the_day.part_of_speech && (
                    <span className="text-xs font-semibold italic text-white/80 sm:text-sm lg:text-lg">
                      {data.word_of_the_day.part_of_speech}
                    </span>
                  )}
                </div>

                <div className="mt-1 shrink-0">
                  <h3
                    style={{ fontFamily: 'var(--font-body)' }}
                    className="break-words text-4xl font-black leading-tight tracking-normal text-white drop-shadow [overflow-wrap:anywhere] sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
                  >
                    {data.word_of_the_day.word}
                  </h3>
                  <p className="mt-0.5 break-words font-mono text-sm font-bold text-amber-300 [overflow-wrap:anywhere] sm:text-base lg:text-xl">
                    [{data.word_of_the_day.pronunciation}]
                  </p>
                </div>

                <div className="mt-2.5">
                  <p className="break-words text-base font-medium leading-snug text-white/95 [overflow-wrap:anywhere] sm:text-lg lg:text-[1.55rem] xl:text-[1.7rem]">
                    {data.word_of_the_day.definition}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 shrink-0 break-words rounded-xl border border-amber-400/30 bg-amber-400/20 p-2.5 text-base font-medium italic leading-snug text-amber-100 [overflow-wrap:anywhere] sm:p-3 sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                “{data.word_of_the_day.example}”
              </div>
            </section>

            {/* Card 2: Fun Fact of the Day (Emerald Theme) */}
            <section data-testid="kids-fact-card" className="flex min-h-0 flex-col justify-between rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 shadow-sm backdrop-blur-md sm:p-4 lg:col-span-7 lg:p-5">
              <div className="flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-300 lg:text-base">
                    <Icon name="lightbulb" className="text-sm" /> Fun Fact
                  </span>
                  {data.fun_fact.category && (
                    <span className="max-w-[55%] break-words rounded-md bg-emerald-400/20 px-2 py-0.5 text-right text-xs font-bold text-emerald-200 [overflow-wrap:anywhere] sm:text-sm lg:text-lg">
                      {data.fun_fact.category}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-start gap-4">
                  <span className="shrink-0 select-none text-4xl drop-shadow-md sm:text-5xl lg:text-6xl">
                    {data.fun_fact.emoji || '💡'}
                  </span>
                  <p className="break-words text-lg font-semibold leading-snug text-white drop-shadow [overflow-wrap:anywhere] sm:text-xl lg:text-[1.75rem] xl:text-[2rem]">
                    {data.fun_fact.fact}
                  </p>
                </div>
              </div>

              {data.fun_fact.did_you_know && (
                <div className="mt-2.5 shrink-0 break-words rounded-xl border border-emerald-400/30 bg-emerald-400/20 p-2.5 text-base font-medium leading-snug text-emerald-50 [overflow-wrap:anywhere] sm:p-3 sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                  <strong className="font-black text-emerald-300">Did you know? </strong>
                  {data.fun_fact.did_you_know}
                </div>
              )}
            </section>

            {/* Card 3: Age 5 challenge */}
            <section data-testid="kids-age-5-card" className="flex min-h-0 flex-col justify-between rounded-2xl border border-purple-500/35 bg-purple-500/10 p-3.5 shadow-sm backdrop-blur-md sm:p-4 lg:col-span-6 lg:p-5">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/40 bg-purple-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-purple-300 lg:text-base">
                      <Icon name="psychology" className="text-sm lg:text-xl" /> 🎈 Age 5 Challenge
                    </span>
                    <p className="mt-2 break-words text-sm font-bold text-purple-200/90 [overflow-wrap:anywhere] sm:text-base lg:text-xl">
                      {data.stem_5yo.topic}
                    </p>
                  </div>
                  {data.stem_5yo.hint && (
                    <button
                      onClick={() => setShowHint5(!showHint5)}
                      aria-expanded={showHint5}
                      className="shrink-0 rounded-xl border border-purple-400/30 bg-purple-400/20 px-3 py-1.5 text-sm font-black text-purple-200 transition hover:bg-purple-400/30 hover:text-white active:scale-95 lg:text-lg"
                    >
                      {showHint5 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="break-words text-xl font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-2xl lg:text-[1.8rem] xl:text-[2rem]">
                  {data.stem_5yo.question}
                </p>
              </div>

              <div className="mt-3 flex min-h-20 shrink-0 items-center rounded-xl border border-purple-400/30 bg-black/35 p-3 lg:min-h-24 lg:p-4">
                {showHint5 && data.stem_5yo.hint ? (
                  <p className="break-words text-base font-medium italic leading-snug text-purple-100 [overflow-wrap:anywhere] sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                    <strong className="font-black not-italic text-purple-300">Hint: </strong>{data.stem_5yo.hint}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-purple-200/70 sm:text-base lg:text-lg">Think it through together—or reveal a hint.</p>
                )}
              </div>
            </section>

            {/* Card 4: Age 9 challenge */}
            <section data-testid="kids-age-9-card" className="flex min-h-0 flex-col justify-between rounded-2xl border border-indigo-500/35 bg-indigo-500/10 p-3.5 shadow-sm backdrop-blur-md sm:p-4 lg:col-span-6 lg:p-5">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-400/25 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-indigo-300 lg:text-base">
                      <Icon name="psychology" className="text-sm lg:text-xl" /> 🚀 Age 9 Challenge
                    </span>
                    <p className="mt-2 break-words text-sm font-bold text-indigo-200/90 [overflow-wrap:anywhere] sm:text-base lg:text-xl">
                      {data.stem_9yo.topic}
                    </p>
                  </div>
                  {data.stem_9yo.hint && (
                    <button
                      onClick={() => setShowHint9(!showHint9)}
                      aria-expanded={showHint9}
                      className="shrink-0 rounded-xl border border-indigo-400/30 bg-indigo-400/20 px-3 py-1.5 text-sm font-black text-indigo-200 transition hover:bg-indigo-400/30 hover:text-white active:scale-95 lg:text-lg"
                    >
                      {showHint9 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="break-words text-xl font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-2xl lg:text-[1.8rem] xl:text-[2rem]">
                  {data.stem_9yo.question}
                </p>
              </div>

              <div className="mt-3 flex min-h-20 shrink-0 items-center rounded-xl border border-indigo-400/30 bg-black/35 p-3 lg:min-h-24 lg:p-4">
                {showHint9 && data.stem_9yo.hint ? (
                  <p className="break-words text-base font-medium italic leading-snug text-indigo-100 [overflow-wrap:anywhere] sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                    <strong className="font-black not-italic text-indigo-300">Hint: </strong>{data.stem_9yo.hint}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-indigo-200/70 sm:text-base lg:text-lg">Make a prediction first—then reveal a hint.</p>
                )}
              </div>
            </section>
          </div>

          {/* Answers Pop-up Modal */}
          <AnimatePresence>
            {showAnswersModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-xl sm:p-4 lg:p-4"
                onClick={() => setShowAnswersModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid="kids-answers-panel"
                  className="flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-[1856px] flex-col gap-4 overflow-y-auto rounded-3xl border border-white/20 bg-[#161618] p-4 text-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-5 lg:overflow-hidden lg:p-6"
                >
                  <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/15 pb-3 lg:min-h-16">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400">
                        <Icon name="psychology" className="text-2xl" />
                      </span>
                      <div>
                        <h3 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                          Kids’ Brain Nuggets — Answers
                        </h3>
                        <p className="text-xs font-medium text-white/70 sm:text-sm lg:text-lg">
                          Parent talking points & full explanations
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAnswersModal(false)}
                      aria-label="Close answers"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-white/10 text-white/80 transition hover:bg-white/20 lg:h-12 lg:w-12"
                    >
                      <Icon name="close" className="text-2xl" />
                    </button>
                  </div>

                  <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-2">
                    {/* Age 5 Answer */}
                    <section data-testid="kids-age-5-answer" className="flex min-h-0 flex-col gap-3 rounded-2xl border border-purple-500/35 bg-purple-500/10 p-4 lg:p-5">
                      <div className="flex items-center justify-between">
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-purple-300 sm:text-lg lg:text-2xl">
                          <span>🎈 Age 5 Challenge</span>
                          <span className="break-words rounded bg-purple-400/25 px-2 py-0.5 text-xs font-bold text-purple-200 [overflow-wrap:anywhere] lg:text-base">
                            {data.stem_5yo.topic}
                          </span>
                        </span>
                      </div>
                      <p className="break-words text-base font-medium italic leading-snug text-white/95 [overflow-wrap:anywhere] sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                        “{data.stem_5yo.question}”
                      </p>
                      <div className="flex flex-1 flex-col gap-2 rounded-xl border border-purple-400/30 bg-purple-950/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-purple-300 lg:text-base">Answer</p>
                        <p className="break-words text-base font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-lg lg:text-[1.45rem] xl:text-[1.65rem]">
                          {data.stem_5yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_5yo.parent_explanation && (
                          <div className="mt-auto border-t border-purple-400/20 pt-3">
                            <p className="text-xs font-black uppercase tracking-wider text-purple-300/80 lg:text-base">Explanation for Parents</p>
                            <p className="mt-1 break-words text-sm leading-relaxed text-purple-100/95 [overflow-wrap:anywhere] sm:text-base lg:text-[1.2rem] xl:text-[1.35rem]">
                              {data.stem_5yo.parent_explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Age 9 Answer */}
                    <section data-testid="kids-age-9-answer" className="flex min-h-0 flex-col gap-3 rounded-2xl border border-indigo-500/35 bg-indigo-500/10 p-4 lg:p-5">
                      <div className="flex items-center justify-between">
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-indigo-300 sm:text-lg lg:text-2xl">
                          <span>🚀 Age 9 Challenge</span>
                          <span className="break-words rounded bg-indigo-400/25 px-2 py-0.5 text-xs font-bold text-indigo-200 [overflow-wrap:anywhere] lg:text-base">
                            {data.stem_9yo.topic}
                          </span>
                        </span>
                      </div>
                      <p className="break-words text-base font-medium italic leading-snug text-white/95 [overflow-wrap:anywhere] sm:text-lg lg:text-[1.35rem] xl:text-[1.5rem]">
                        “{data.stem_9yo.question}”
                      </p>
                      <div className="flex flex-1 flex-col gap-2 rounded-xl border border-indigo-400/30 bg-indigo-950/70 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-300 lg:text-base">Answer</p>
                        <p className="break-words text-base font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-lg lg:text-[1.45rem] xl:text-[1.65rem]">
                          {data.stem_9yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_9yo.parent_explanation && (
                          <div className="mt-auto border-t border-indigo-400/20 pt-3">
                            <p className="text-xs font-black uppercase tracking-wider text-indigo-300/80 lg:text-base">Explanation for Parents</p>
                            <p className="mt-1 break-words text-sm leading-relaxed text-indigo-100/95 [overflow-wrap:anywhere] sm:text-base lg:text-[1.2rem] xl:text-[1.35rem]">
                              {data.stem_9yo.parent_explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
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
