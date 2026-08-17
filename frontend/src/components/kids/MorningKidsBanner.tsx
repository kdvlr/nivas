import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import Icon from '../Icon'
import type { KidsDailyPublicResponse } from '../../lib/types'

interface MorningKidsBannerProps {
  now?: Date
  className?: string
}

export default function MorningKidsBanner({ now = new Date(), className = '' }: MorningKidsBannerProps) {
  const [data, setData] = useState<KidsDailyPublicResponse | null>(null)
  const [dismissedDate, setDismissedDate] = useState<string | null>(null)
  const [manuallyDismissed, setManuallyDismissed] = useState(false)
  const [showHint5, setShowHint5] = useState(false)
  const [showHint9, setShowHint9] = useState(false)

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

  if (!data) return null

  // If user explicitly clicked 'X' in this session, immediately hide
  if (manuallyDismissed) return null

  const isForceActive = Boolean(data.force_active)
  const isDismissedToday = dismissedDate === data.date

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

  const shouldDisplay = isForceActive || (isScheduleActive && !isDismissedToday)

  if (!shouldDisplay) return null

  const handleDismiss = () => {
    setManuallyDismissed(true)
    if (data.date) {
      localStorage.setItem('kids_banner_dismissed_date', data.date)
      setDismissedDate(data.date)
    }
  }

  return (
    <AnimatePresence>
      {/* Floating Window spanning full width of Dashboard and auto-growing to fit all STEM questions without scrolling */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className={`fixed inset-x-3 sm:inset-x-6 lg:inset-x-0 lg:left-[5.5rem] lg:right-4 top-16 sm:top-20 z-40 h-auto max-h-[calc(100vh-5.5rem)] rounded-3xl border border-white/20 bg-slate-950/92 p-6 sm:p-7 text-white shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-black/95 flex flex-col justify-between overflow-y-auto ${className}`}
      >
        {/* Header Ribbon */}
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/15 pb-3 shrink-0">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400 shadow-inner">
              <Icon name="wb_sunny" className="text-2xl" />
            </span>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
                  Morning Kids Discovery Hub
                </h2>
                {isForceActive && (
                  <span className="rounded-md bg-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300 border border-rose-400/40">
                    TEST MODE ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-white/70 mt-0.5">
                Today's morning vocabulary, fascinating fact, and STEM challenges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#/setup"
              title="Parent answers in Setup"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs sm:text-sm font-semibold text-white/90 transition active:scale-95 border border-white/15 cursor-pointer"
            >
              <Icon name="lock" className="text-base text-amber-400" />
              <span className="hidden sm:inline">Answers in Setup</span>
            </a>
            <button
              onClick={handleDismiss}
              title="Dismiss floating window for today"
              aria-label="Dismiss floating window for today"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-rose-500/30 hover:text-white hover:border-rose-400/40 border border-white/15 transition active:scale-90 cursor-pointer"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
        </div>

        {/* 3-Column Simultaneous Layout with Large, Distance-Readable Typography */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch flex-1 min-h-0">
          {/* Card 1: Word of the Day (Reduced font sizes by 1 step) */}
          <div className="flex flex-col justify-between rounded-3xl border border-amber-500/35 bg-amber-500/10 p-6 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/40">
                  <Icon name="menu_book" className="text-sm" /> Word of the Day
                </span>
                {data.word_of_the_day.part_of_speech && (
                  <span className="text-xs italic text-white/70 font-medium">
                    {data.word_of_the_day.part_of_speech}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <h3
                  style={{ fontFamily: 'var(--font-body)' }}
                  className="text-2xl sm:text-3xl font-semibold tracking-normal text-white drop-shadow-sm leading-tight"
                >
                  {data.word_of_the_day.word}
                </h3>
                <p className="text-sm sm:text-base font-semibold text-amber-400 font-mono mt-1">
                  [{data.word_of_the_day.pronunciation}]
                </p>
              </div>

              <p className="mt-3.5 text-base sm:text-lg lg:text-xl text-white font-medium leading-relaxed">
                {data.word_of_the_day.definition}
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-amber-400/20 p-4 text-sm sm:text-base text-white/95 italic border border-amber-400/30 leading-relaxed">
              “{data.word_of_the_day.example}”
            </div>
          </div>

          {/* Card 2: Fun Fact of the Day */}
          <div className="flex flex-col justify-between rounded-3xl border border-emerald-500/35 bg-emerald-500/10 p-6 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/40">
                  <Icon name="lightbulb" className="text-base" /> Fun Fact
                </span>
                {data.fun_fact.category && (
                  <span className="text-sm font-semibold text-white/70">
                    {data.fun_fact.category}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3.5 mt-4">
                <span className="text-3xl shrink-0 select-none drop-shadow-md">
                  {data.fun_fact.emoji || '💡'}
                </span>
                <p className="text-lg font-bold text-white leading-snug">
                  {data.fun_fact.fact}
                </p>
              </div>
            </div>

            {data.fun_fact.did_you_know && (
              <div className="mt-4 rounded-2xl bg-emerald-400/20 p-4 sm:p-5 text-base sm:text-lg text-white/95 border border-emerald-400/30 leading-relaxed">
                <strong className="font-bold text-emerald-300">Did you know? </strong>
                {data.fun_fact.did_you_know}
              </div>
            )}
          </div>

          {/* Card 3: STEM Challenges (5yo & 9yo) */}
          <div className="flex flex-col justify-between rounded-3xl border border-purple-500/35 bg-purple-500/10 p-6 shadow-sm backdrop-blur-md">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-400/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300 border border-purple-400/40">
                  <Icon name="psychology" className="text-base" /> STEM Questions
                </span>
                <span className="text-sm text-white/70 font-semibold">Ages 5 & 9</span>
              </div>

              {/* 5-Year Old Question */}
              <div className="rounded-2xl bg-purple-400/20 p-4 sm:p-5 border border-purple-400/30">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-base font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🎈 Age 5</span>
                    <span className="text-xs sm:text-sm font-normal text-white/70">({data.stem_5yo.topic})</span>
                  </span>
                  {data.stem_5yo.hint && (
                    <button
                      onClick={() => setShowHint5(!showHint5)}
                      className="text-xs sm:text-sm font-bold text-purple-300 hover:text-white underline cursor-pointer"
                    >
                      {showHint5 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-base sm:text-lg font-bold text-white leading-snug">
                  {data.stem_5yo.question}
                </p>
                {showHint5 && data.stem_5yo.hint && (
                  <p className="mt-2.5 text-sm sm:text-base text-purple-100 italic bg-black/50 p-3 rounded-xl border border-purple-400/40 leading-snug">
                    Hint: {data.stem_5yo.hint}
                  </p>
                )}
              </div>

              {/* 9-Year Old Question */}
              <div className="rounded-2xl bg-indigo-400/20 p-4 sm:p-5 border border-indigo-400/30">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-base font-bold text-indigo-300 flex items-center gap-1.5">
                    <span>🚀 Age 9</span>
                    <span className="text-xs sm:text-sm font-normal text-white/70">({data.stem_9yo.topic})</span>
                  </span>
                  {data.stem_9yo.hint && (
                    <button
                      onClick={() => setShowHint9(!showHint9)}
                      className="text-xs sm:text-sm font-bold text-indigo-300 hover:text-white underline cursor-pointer"
                    >
                      {showHint9 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-base sm:text-lg font-bold text-white leading-snug">
                  {data.stem_9yo.question}
                </p>
                {showHint9 && data.stem_9yo.hint && (
                  <p className="mt-2.5 text-sm sm:text-base text-indigo-100 italic bg-black/50 p-3 rounded-xl border border-indigo-400/30 leading-snug">
                    Hint: {data.stem_9yo.hint}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-white/75 pt-2 border-t border-purple-400/20">
              <span>Discuss at breakfast!</span>
              <a href="#/setup" className="font-bold text-purple-300 hover:text-white hover:underline flex items-center gap-1">
                Answers in Setup →
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
