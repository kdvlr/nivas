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

  // If force_active is true, show anytime regardless of dismissal or hour
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
    if (data.date) {
      localStorage.setItem('kids_banner_dismissed_date', data.date)
      setDismissedDate(data.date)
    }
  }

  return (
    <AnimatePresence>
      {/* Floating Window Anchored on top of Home Screen */}
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className={`fixed inset-x-3 sm:inset-x-6 top-16 sm:top-20 z-40 max-w-6xl mx-auto rounded-3xl border border-white/20 bg-slate-950/80 p-5 sm:p-6 text-white shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-black/85 max-h-[calc(100dvh-5.5rem)] overflow-y-auto ${className}`}
      >
        {/* Header Ribbon */}
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/15 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-400 shadow-inner">
              <Icon name="wb_sunny" className="text-2xl" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Morning Kids Discovery Hub
                </h2>
                {isForceActive && (
                  <span className="rounded-lg bg-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300 border border-rose-400/40">
                    TEST MODE ACTIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70 mt-0.5">
                Today's morning vocabulary, fascinating fact, and STEM questions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#/setup"
              title="Parent answers in Setup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white/90 transition active:scale-95 border border-white/15 cursor-pointer"
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
              <Icon name="close" className="text-lg" />
            </button>
          </div>
        </div>

        {/* 3-Column Simultaneous Layout with Large Legible Typography */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {/* Card 1: Word of the Day */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                  <Icon name="menu_book" className="text-sm" /> Word of the Day
                </span>
                {data.word_of_the_day.part_of_speech && (
                  <span className="text-xs italic text-white/60 font-medium">
                    {data.word_of_the_day.part_of_speech}
                  </span>
                )}
              </div>

              <div className="mt-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {data.word_of_the_day.word}
                </h3>
                <p className="text-sm font-semibold text-amber-400 font-mono mt-0.5">
                  [{data.word_of_the_day.pronunciation}]
                </p>
              </div>

              <p className="mt-3 text-base sm:text-lg text-white/95 font-medium leading-snug">
                {data.word_of_the_day.definition}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-amber-400/15 p-3 text-sm text-white/90 italic border border-amber-400/20 leading-relaxed">
              “{data.word_of_the_day.example}”
            </div>
          </div>

          {/* Card 2: Fun Fact of the Day */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                  <Icon name="lightbulb" className="text-sm" /> Fun Fact
                </span>
                {data.fun_fact.category && (
                  <span className="text-xs font-semibold text-white/60">
                    {data.fun_fact.category}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3.5 mt-2">
                <span className="text-4xl sm:text-5xl shrink-0 select-none drop-shadow">
                  {data.fun_fact.emoji || '💡'}
                </span>
                <p className="text-base sm:text-lg font-medium text-white leading-snug">
                  {data.fun_fact.fact}
                </p>
              </div>
            </div>

            {data.fun_fact.did_you_know && (
              <div className="mt-4 rounded-xl bg-emerald-400/15 p-3 text-sm text-white/90 border border-emerald-400/20 leading-relaxed">
                <strong className="font-bold text-emerald-300">Did you know? </strong>
                {data.fun_fact.did_you_know}
              </div>
            )}
          </div>

          {/* Card 3: STEM Challenges (5yo & 9yo) */}
          <div className="flex flex-col justify-between rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 sm:p-5 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-400/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-purple-300 border border-purple-400/30">
                  <Icon name="psychology" className="text-sm" /> STEM Questions
                </span>
                <span className="text-xs text-white/60 font-semibold">Ages 5 & 9</span>
              </div>

              {/* 5-Year Old Question */}
              <div className="mb-3.5 rounded-xl bg-purple-400/15 p-3 border border-purple-400/20">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🎈 Age 5</span>
                    <span className="text-xs font-normal text-white/60">({data.stem_5yo.topic})</span>
                  </span>
                  {data.stem_5yo.hint && (
                    <button
                      onClick={() => setShowHint5(!showHint5)}
                      className="text-xs font-semibold text-purple-300 hover:text-white underline cursor-pointer"
                    >
                      {showHint5 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                  {data.stem_5yo.question}
                </p>
                {showHint5 && data.stem_5yo.hint && (
                  <p className="mt-2 text-xs text-purple-200 italic bg-black/30 p-2 rounded-lg border border-purple-400/30">
                    Hint: {data.stem_5yo.hint}
                  </p>
                )}
              </div>

              {/* 9-Year Old Question */}
              <div className="rounded-xl bg-indigo-400/15 p-3 border border-indigo-400/20">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <span>🚀 Age 9</span>
                    <span className="text-xs font-normal text-white/60">({data.stem_9yo.topic})</span>
                  </span>
                  {data.stem_9yo.hint && (
                    <button
                      onClick={() => setShowHint9(!showHint9)}
                      className="text-xs font-semibold text-indigo-300 hover:text-white underline cursor-pointer"
                    >
                      {showHint9 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                  {data.stem_9yo.question}
                </p>
                {showHint9 && data.stem_9yo.hint && (
                  <p className="mt-2 text-xs text-indigo-200 italic bg-black/30 p-2 rounded-lg border border-indigo-400/30">
                    Hint: {data.stem_9yo.hint}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/60 pt-1">
              <span>Discuss at breakfast!</span>
              <a href="#/setup" className="font-semibold text-purple-300 hover:text-white hover:underline flex items-center gap-1">
                Answers in Setup →
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
