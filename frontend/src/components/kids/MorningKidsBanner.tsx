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

  // Check schedule condition
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
      <motion.section
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`relative mb-4 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-purple-500/10 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:from-amber-900/20 dark:via-sky-900/20 dark:to-purple-900/20 ${className}`}
      >
        {/* Header Ribbon */}
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/15 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 shadow-sm">
              <Icon name="wb_sunny" className="text-xl" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
                Morning Kids Discovery Hub
                {isForceActive && (
                  <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-500 border border-rose-500/30">
                    TEST MODE ACTIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-ink-soft">
                Explore today's word, fun fact, and STEM challenges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#/setup"
              title="Parent answers in Setup"
              className="hidden sm:inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-white/15 hover:text-ink transition active:scale-95"
            >
              <Icon name="lock" className="text-sm" />
              <span>Answers in Setup</span>
            </a>
            <button
              onClick={handleDismiss}
              title="Dismiss banner for today"
              aria-label="Dismiss banner for today"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-ink-soft hover:bg-white/20 hover:text-ink transition active:scale-90 cursor-pointer"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        </div>

        {/* 3-Column Simultaneous Layout */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {/* Card 1: Word of the Day */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-amber-50/50 p-3.5 shadow-sm backdrop-blur-md dark:border-amber-500/15 dark:bg-amber-950/30">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <Icon name="menu_book" className="text-xs" /> Word of the Day
                </span>
                {data.word_of_the_day.part_of_speech && (
                  <span className="text-[11px] italic text-ink-faint">
                    {data.word_of_the_day.part_of_speech}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-black tracking-tight text-ink">
                  {data.word_of_the_day.word}
                </h3>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 font-mono">
                  [{data.word_of_the_day.pronunciation}]
                </span>
              </div>

              <p className="mt-1.5 text-xs text-ink leading-relaxed">
                {data.word_of_the_day.definition}
              </p>
            </div>

            <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[11px] text-ink-soft italic">
              “{data.word_of_the_day.example}”
            </div>
          </div>

          {/* Card 2: Fun Fact of the Day */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-3.5 shadow-sm backdrop-blur-md dark:border-emerald-500/15 dark:bg-emerald-950/30">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Icon name="lightbulb" className="text-xs" /> Fun Fact
                </span>
                {data.fun_fact.category && (
                  <span className="text-[11px] font-semibold text-ink-faint">
                    {data.fun_fact.category}
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <span className="text-3xl shrink-0 select-none">
                  {data.fun_fact.emoji || '💡'}
                </span>
                <p className="text-xs font-medium text-ink leading-relaxed">
                  {data.fun_fact.fact}
                </p>
              </div>
            </div>

            {data.fun_fact.did_you_know && (
              <div className="mt-3 rounded-xl bg-emerald-500/10 p-2.5 text-[11px] text-ink-soft">
                <strong className="font-semibold text-emerald-700 dark:text-emerald-300">Did you know? </strong>
                {data.fun_fact.did_you_know}
              </div>
            )}
          </div>

          {/* Card 3: STEM Challenges (5yo & 9yo) */}
          <div className="flex flex-col justify-between rounded-2xl border border-purple-500/20 bg-purple-50/50 p-3.5 shadow-sm backdrop-blur-md dark:border-purple-500/15 dark:bg-purple-950/30">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  <Icon name="psychology" className="text-xs" /> STEM Challenges
                </span>
                <span className="text-[10px] text-ink-faint font-medium">5yo & 9yo</span>
              </div>

              {/* 5-Year Old Question */}
              <div className="mb-3 rounded-xl bg-purple-500/[0.08] p-2.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <span>🎈 Age 5</span>
                    <span className="text-[10px] font-normal text-ink-faint">({data.stem_5yo.topic})</span>
                  </span>
                  {data.stem_5yo.hint && (
                    <button
                      onClick={() => setShowHint5(!showHint5)}
                      className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      {showHint5 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-ink leading-snug">
                  {data.stem_5yo.question}
                </p>
                {showHint5 && data.stem_5yo.hint && (
                  <p className="mt-1 text-[11px] text-purple-800 dark:text-purple-200 italic bg-white/40 dark:bg-black/20 p-1.5 rounded-lg">
                    Hint: {data.stem_5yo.hint}
                  </p>
                )}
              </div>

              {/* 9-Year Old Question */}
              <div className="rounded-xl bg-indigo-500/[0.08] p-2.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <span>🚀 Age 9</span>
                    <span className="text-[10px] font-normal text-ink-faint">({data.stem_9yo.topic})</span>
                  </span>
                  {data.stem_9yo.hint && (
                    <button
                      onClick={() => setShowHint9(!showHint9)}
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {showHint9 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-ink leading-snug">
                  {data.stem_9yo.question}
                </p>
                {showHint9 && data.stem_9yo.hint && (
                  <p className="mt-1 text-[11px] text-indigo-800 dark:text-indigo-200 italic bg-white/40 dark:bg-black/20 p-1.5 rounded-lg">
                    Hint: {data.stem_9yo.hint}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-ink-faint">
              <span>Discuss together at breakfast!</span>
              <a href="#/setup" className="font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                Answers in Setup →
              </a>
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  )
}
