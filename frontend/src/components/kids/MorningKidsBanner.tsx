import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const [density, setDensity] = useState<0 | 1 | 2>(0)
  const [answerDensity, setAnswerDensity] = useState<0 | 1 | 2 | 3>(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const answersPanelRef = useRef<HTMLDivElement>(null)

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

  // Start each content/hint state at the most readable scale, then step down
  // only when real rendered children leave their card. Checking descendants'
  // rectangles catches visible overflow that scrollHeight alone can miss.
  useLayoutEffect(() => {
    setDensity(0)
  }, [data, shouldDisplay, showHint5, showHint9])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || !shouldDisplay) return

    const measureContainment = () => {
      const panelRect = panel.getBoundingClientRect()
      const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-fit-card]'))
      const hasOverflow = cards.some((card) => {
        const cardRect = card.getBoundingClientRect()
        const cardOutsidePanel =
          cardRect.left < panelRect.left - 1 ||
          cardRect.right > panelRect.right + 1 ||
          cardRect.top < panelRect.top - 1 ||
          cardRect.bottom > panelRect.bottom + 1
        const childOutsideCard = Array.from(card.querySelectorAll<HTMLElement>('[data-fit-content]')).some(
          (child) => {
            const childRect = child.getBoundingClientRect()
            return (
              childRect.left < cardRect.left - 1 ||
              childRect.right > cardRect.right + 1 ||
              childRect.top < cardRect.top - 1 ||
              childRect.bottom > cardRect.bottom + 1
            )
          },
        )
        return cardOutsidePanel || childOutsideCard || card.scrollHeight > card.clientHeight + 1
      })

      if (hasOverflow) {
        setDensity((current) => (current < 2 ? ((current + 1) as 1 | 2) : current))
      }
    }

    const frame = requestAnimationFrame(measureContainment)
    const observer = new ResizeObserver(measureContainment)
    observer.observe(panel)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [data, density, shouldDisplay, showHint5, showHint9])

  // The answers can vary considerably in length. Keep the preferred, room-readable
  // scale whenever it fits, then reduce type and spacing one measured step at a time.
  // Mobile remains scrollable; this containment pass is for the two-column display.
  useLayoutEffect(() => {
    if (showAnswersModal) setAnswerDensity(0)
  }, [data, showAnswersModal])

  useLayoutEffect(() => {
    const panel = answersPanelRef.current
    if (!panel || !showAnswersModal) return

    const measureContainment = () => {
      if (window.innerWidth < 1024) return

      const panelRect = panel.getBoundingClientRect()
      const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-answer-fit-card]'))
      const panelOverflows = panel.scrollHeight > panel.clientHeight + 1
      const cardOverflows = cards.some((card) => {
        const cardRect = card.getBoundingClientRect()
        const cardOutsidePanel =
          cardRect.left < panelRect.left - 1 ||
          cardRect.right > panelRect.right + 1 ||
          cardRect.top < panelRect.top - 1 ||
          cardRect.bottom > panelRect.bottom + 1
        const contentOutsideCard = Array.from(
          card.querySelectorAll<HTMLElement>('[data-answer-fit-content]'),
        ).some((content) => {
          const contentRect = content.getBoundingClientRect()
          return (
            contentRect.left < cardRect.left - 1 ||
            contentRect.right > cardRect.right + 1 ||
            contentRect.top < cardRect.top - 1 ||
            contentRect.bottom > cardRect.bottom + 1 ||
            content.scrollHeight > content.clientHeight + 1
          )
        })

        return cardOutsidePanel || contentOutsideCard || card.scrollHeight > card.clientHeight + 1
      })

      if (panelOverflows || cardOverflows) {
        setAnswerDensity((current) =>
          current < 3 ? ((current + 1) as 1 | 2 | 3) : current,
        )
      }
    }

    const frame = requestAnimationFrame(measureContainment)
    const observer = new ResizeObserver(measureContainment)
    observer.observe(panel)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [answerDensity, data, showAnswersModal])

  const typeScale = [
    {
      word: 'lg:text-[3rem] xl:text-[3.25rem]',
      definition: 'lg:text-[1.35rem] xl:text-[1.5rem]',
      example: 'lg:text-[1.2rem] xl:text-[1.35rem]',
      fact: 'lg:text-[1.55rem] xl:text-[1.75rem]',
      support: 'lg:text-[1.2rem] xl:text-[1.35rem]',
      question: 'lg:text-[1.4rem] xl:text-[1.55rem]',
      hint: 'lg:text-base xl:text-lg',
      topic: 'lg:text-base xl:text-lg',
    },
    {
      word: 'lg:text-[2.75rem] xl:text-[3rem]',
      definition: 'lg:text-xl xl:text-[1.35rem]',
      example: 'lg:text-lg xl:text-xl',
      fact: 'lg:text-[1.4rem] xl:text-[1.55rem]',
      support: 'lg:text-lg xl:text-xl',
      question: 'lg:text-[1.3rem] xl:text-[1.4rem]',
      hint: 'lg:text-[0.95rem] xl:text-base',
      topic: 'lg:text-[0.95rem] xl:text-base',
    },
    {
      word: 'lg:text-[2.5rem] xl:text-[2.75rem]',
      definition: 'lg:text-lg xl:text-xl',
      example: 'lg:text-base xl:text-lg',
      fact: 'lg:text-[1.25rem] xl:text-[1.4rem]',
      support: 'lg:text-base xl:text-lg',
      question: 'lg:text-xl xl:text-[1.3rem]',
      hint: 'lg:text-sm xl:text-[0.95rem]',
      topic: 'lg:text-sm xl:text-[0.95rem]',
    },
  ][density]

  const answerTypeScale = [
    {
      panel: 'lg:gap-4 lg:p-6',
      header: 'lg:min-h-16',
      title: 'lg:text-4xl',
      subtitle: 'lg:text-lg',
      grid: 'lg:gap-4',
      card: 'lg:gap-3 lg:p-5',
      sectionTitle: 'lg:text-2xl',
      topic: 'lg:text-base',
      question: 'lg:text-[1.35rem] xl:text-[1.5rem]',
      answerBox: 'lg:gap-2 lg:p-4',
      label: 'lg:text-base',
      answer: 'lg:text-[1.45rem] xl:text-[1.65rem]',
      explanationWrap: 'lg:pt-3',
      explanation: 'lg:text-[1.2rem] xl:text-[1.35rem]',
    },
    {
      panel: 'lg:gap-3 lg:p-5',
      header: 'lg:min-h-14',
      title: 'lg:text-[2rem]',
      subtitle: 'lg:text-base',
      grid: 'lg:gap-3',
      card: 'lg:gap-2.5 lg:p-4',
      sectionTitle: 'lg:text-xl',
      topic: 'lg:text-sm',
      question: 'lg:text-[1.15rem] xl:text-[1.3rem]',
      answerBox: 'lg:gap-1.5 lg:p-3.5',
      label: 'lg:text-sm',
      answer: 'lg:text-[1.25rem] xl:text-[1.4rem]',
      explanationWrap: 'lg:pt-2.5',
      explanation: 'lg:text-[1.05rem] xl:text-[1.15rem]',
    },
    {
      panel: 'lg:gap-2.5 lg:p-4',
      header: 'lg:min-h-12',
      title: 'lg:text-[1.75rem]',
      subtitle: 'lg:text-sm',
      grid: 'lg:gap-2.5',
      card: 'lg:gap-2 lg:p-3.5',
      sectionTitle: 'lg:text-lg',
      topic: 'lg:text-xs',
      question: 'lg:text-base xl:text-[1.15rem]',
      answerBox: 'lg:gap-1.5 lg:p-3',
      label: 'lg:text-xs',
      answer: 'lg:text-[1.1rem] xl:text-[1.25rem]',
      explanationWrap: 'lg:pt-2',
      explanation: 'lg:text-[0.95rem] xl:text-[1.05rem]',
    },
    {
      panel: 'lg:gap-2 lg:p-3',
      header: 'lg:min-h-11',
      title: 'lg:text-2xl',
      subtitle: 'lg:text-xs',
      grid: 'lg:gap-2',
      card: 'lg:gap-1.5 lg:p-3',
      sectionTitle: 'lg:text-base',
      topic: 'lg:text-xs',
      question: 'lg:text-[0.95rem] xl:text-[1.05rem]',
      answerBox: 'lg:gap-1 lg:p-2.5',
      label: 'lg:text-xs',
      answer: 'lg:text-base xl:text-[1.1rem]',
      explanationWrap: 'lg:pt-1.5',
      explanation: 'lg:text-[0.85rem] xl:text-[0.95rem]',
    },
  ][answerDensity]

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
          data-density={density}
          ref={panelRef}
          className={`glass fixed inset-x-2 top-2 bottom-2 sm:inset-x-4 sm:top-3 sm:bottom-3 lg:inset-x-8 lg:top-4 lg:bottom-4 z-40 mx-auto flex max-w-[1856px] flex-col p-3.5 text-ink backdrop-blur-2xl sm:p-4 lg:p-5 overflow-y-auto lg:overflow-hidden ${className}`}
          style={{
            border: '1px solid color-mix(in srgb, var(--outline) 38%, transparent)',
            boxShadow:
              '0 32px 90px rgb(0 0 0 / 0.46), 0 0 0 1px color-mix(in srgb, var(--outline) 24%, transparent), 0 0 36px color-mix(in srgb, var(--primary) 16%, transparent)',
          }}
        >
          {/* Header Ribbon */}
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--outline-var)] pb-2.5 lg:min-h-16">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] shadow-inner">
                <Icon name="wb_sunny" className="text-2xl" />
              </span>
              <div>
                <h2 className="text-2xl font-extrabold leading-none tracking-tight text-ink sm:text-3xl lg:text-4xl">
                  Kids’ Brain Nuggets
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setShowAnswersModal(true)}
                title="View answers & explanations"
                className="btn-primary px-4 sm:px-5 py-2 text-sm sm:text-base font-extrabold cursor-pointer"
              >
                <Icon name="psychology" className="text-xl sm:text-2xl" />
                <span>Answers</span>
              </button>
              <button
                onClick={handleDismiss}
                title="Dismiss for today"
                aria-label="Dismiss for today"
                className="btn-glass flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center transition active:scale-90 cursor-pointer"
              >
                <Icon name="close" className="text-xl sm:text-2xl" />
              </button>
            </div>
          </div>

          {/* Full-height columns prevent one section from painting into another row. */}
          <div data-testid="kids-content-grid" className="mt-3 grid flex-1 grid-cols-1 gap-3 sm:gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.05fr)] lg:grid-rows-1 lg:gap-4">
            {/* Card 1: Word of the Day (Amber Theme) */}
            <section data-testid="kids-word-card" data-fit-card className="flex min-h-0 flex-col justify-between rounded-2xl border border-amber-500/40 bg-[var(--sc)] p-3.5 shadow-sm sm:p-4 lg:p-5">
              <div className="flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 lg:text-base">
                    <Icon name="menu_book" className="text-sm" /> Word of the Day
                  </span>
                  {data.word_of_the_day.part_of_speech && (
                    <span className="text-xs font-semibold italic text-ink-soft sm:text-sm lg:text-lg">
                      {data.word_of_the_day.part_of_speech}
                    </span>
                  )}
                </div>

                <div className="mt-1 shrink-0">
                  <h3
                    style={{ fontFamily: 'var(--font-body)' }}
                    data-fit-content
                    className={`break-words text-4xl font-black leading-tight tracking-normal text-ink drop-shadow [overflow-wrap:anywhere] sm:text-5xl ${typeScale.word}`}
                  >
                    {data.word_of_the_day.word}
                  </h3>
                  <p className="mt-0.5 break-words font-mono text-sm font-bold text-amber-700 dark:text-amber-300 [overflow-wrap:anywhere] sm:text-base lg:text-xl">
                    [{data.word_of_the_day.pronunciation}]
                  </p>
                </div>

                <div className="mt-2.5">
                  <p data-fit-content className={`break-words text-base font-medium leading-snug text-ink [overflow-wrap:anywhere] sm:text-lg ${typeScale.definition}`}>
                    {data.word_of_the_day.definition}
                  </p>
                </div>
              </div>

              <div data-fit-content className={`mt-2.5 shrink-0 break-words rounded-xl border border-amber-500/25 bg-[var(--sc-high)] p-2.5 text-base font-medium italic leading-snug text-ink-soft [overflow-wrap:anywhere] sm:p-3 sm:text-lg ${typeScale.example}`}>
                “{data.word_of_the_day.example}”
              </div>
            </section>

            {/* Card 2: Fun Fact of the Day (Emerald Theme) */}
            <section data-testid="kids-fact-card" data-fit-card className="flex min-h-0 flex-col justify-between rounded-2xl border border-emerald-500/40 bg-[var(--sc)] p-3.5 shadow-sm sm:p-4 lg:p-5">
              <div className="flex flex-col justify-start">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 lg:text-base">
                    <Icon name="lightbulb" className="text-sm" /> Fun Fact
                  </span>
                  {data.fun_fact.category && (
                    <span className="max-w-[55%] break-words rounded-md bg-emerald-500/15 px-2 py-0.5 text-right text-xs font-bold text-emerald-700 dark:text-emerald-200 [overflow-wrap:anywhere] sm:text-sm lg:text-lg">
                      {data.fun_fact.category}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-start gap-4">
                  <span className="shrink-0 select-none text-4xl drop-shadow-md sm:text-5xl lg:text-6xl">
                    {data.fun_fact.emoji || '💡'}
                  </span>
                  <p data-fit-content className={`break-words text-lg font-semibold leading-snug text-ink drop-shadow [overflow-wrap:anywhere] sm:text-xl ${typeScale.fact}`}>
                    {data.fun_fact.fact}
                  </p>
                </div>
              </div>

              {data.fun_fact.did_you_know && (
                <div data-fit-content className={`mt-2.5 shrink-0 break-words rounded-xl border border-emerald-500/25 bg-[var(--sc-high)] p-2.5 text-base font-medium leading-snug text-ink-soft [overflow-wrap:anywhere] sm:p-3 sm:text-lg ${typeScale.support}`}>
                  <strong className="font-black text-emerald-700 dark:text-emerald-300">Did you know? </strong>
                  {data.fun_fact.did_you_know}
                </div>
              )}
            </section>

            {/* Card 3: both challenges share one full-height column. */}
            <section data-testid="kids-quiz-card" className="grid gap-3 lg:min-h-0 lg:grid-rows-2">
            {/* Age 5 challenge */}
            <section data-testid="kids-age-5-card" data-fit-card className="flex min-h-0 flex-col justify-between rounded-2xl border border-purple-500/40 bg-[var(--sc)] p-3 shadow-sm sm:p-3.5 lg:p-4">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-200 lg:text-sm xl:text-base">
                      <Icon name="psychology" className="text-sm lg:text-lg" /> 🎈 Age 5 Challenge
                    </span>
                    <p data-fit-content className={`mt-1.5 break-words text-sm font-bold text-purple-700/90 dark:text-purple-200/90 [overflow-wrap:anywhere] sm:text-base ${typeScale.topic}`}>
                      {data.stem_5yo.topic}
                    </p>
                  </div>
                  {data.stem_5yo.hint && (
                    <button
                      onClick={() => setShowHint5(!showHint5)}
                      aria-expanded={showHint5}
                      className="shrink-0 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-sm font-black text-purple-700 dark:text-purple-200 transition hover:bg-purple-500/25 active:scale-95 lg:text-base"
                    >
                      {showHint5 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p data-fit-content className={`break-words text-xl font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-2xl ${typeScale.question}`}>
                  {data.stem_5yo.question}
                </p>
              </div>

              {showHint5 && data.stem_5yo.hint && (
                <div data-fit-content className="mt-2 shrink-0 rounded-xl border border-purple-500/25 bg-[var(--sc-high)] p-2.5 lg:p-3">
                  <p className={`break-words text-base font-medium italic leading-snug text-ink-soft [overflow-wrap:anywhere] sm:text-lg ${typeScale.hint}`}>
                    <strong className="font-black not-italic text-purple-700 dark:text-purple-300">Hint: </strong>{data.stem_5yo.hint}
                  </p>
                </div>
              )}
            </section>

            {/* Age 9 challenge */}
            <section data-testid="kids-age-9-card" data-fit-card className="flex min-h-0 flex-col justify-between rounded-2xl border border-indigo-500/40 bg-[var(--sc)] p-3 shadow-sm sm:p-3.5 lg:p-4">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-200 lg:text-sm xl:text-base">
                      <Icon name="psychology" className="text-sm lg:text-lg" /> 🚀 Age 9 Challenge
                    </span>
                    <p data-fit-content className={`mt-1.5 break-words text-sm font-bold text-indigo-700/90 dark:text-indigo-200/90 [overflow-wrap:anywhere] sm:text-base ${typeScale.topic}`}>
                      {data.stem_9yo.topic}
                    </p>
                  </div>
                  {data.stem_9yo.hint && (
                    <button
                      onClick={() => setShowHint9(!showHint9)}
                      aria-expanded={showHint9}
                      className="shrink-0 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-sm font-black text-indigo-700 dark:text-indigo-200 transition hover:bg-indigo-500/25 active:scale-95 lg:text-base"
                    >
                      {showHint9 ? 'Hide Hint' : '💡 Hint'}
                    </button>
                  )}
                </div>
                <p data-fit-content className={`break-words text-xl font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-2xl ${typeScale.question}`}>
                  {data.stem_9yo.question}
                </p>
              </div>

              {showHint9 && data.stem_9yo.hint && (
                <div data-fit-content className="mt-2 shrink-0 rounded-xl border border-indigo-500/25 bg-[var(--sc-high)] p-2.5 lg:p-3">
                  <p className={`break-words text-base font-medium italic leading-snug text-ink-soft [overflow-wrap:anywhere] sm:text-lg ${typeScale.hint}`}>
                    <strong className="font-black not-italic text-indigo-700 dark:text-indigo-300">Hint: </strong>{data.stem_9yo.hint}
                  </p>
                </div>
              )}
            </section>
            </section>
          </div>

          {/* Answers Pop-up Modal */}
          <AnimatePresence>
            {showAnswersModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-xl sm:p-4 lg:p-4"
                style={{ background: 'color-mix(in srgb, var(--surface) 78%, transparent)' }}
                onClick={() => setShowAnswersModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid="kids-answers-panel"
                  data-answer-density={answerDensity}
                  ref={answersPanelRef}
                  className={`glass flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-[1856px] flex-col gap-4 overflow-y-auto p-4 text-ink sm:max-h-[calc(100dvh-2rem)] sm:p-5 lg:overflow-hidden ${answerTypeScale.panel}`}
                  style={{
                    border: '1px solid color-mix(in srgb, var(--outline) 38%, transparent)',
                    boxShadow:
                      '0 32px 90px rgb(0 0 0 / 0.46), 0 0 0 1px color-mix(in srgb, var(--outline) 24%, transparent), 0 0 36px color-mix(in srgb, var(--primary) 16%, transparent)',
                  }}
                >
                  <div className={`flex min-h-14 shrink-0 items-center justify-between border-b border-[var(--outline-var)] pb-3 ${answerTypeScale.header}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary-container)] text-[var(--primary)]">
                        <Icon name="psychology" className="text-2xl" />
                      </span>
                      <div>
                        <h3 className={`text-2xl font-extrabold text-ink sm:text-3xl ${answerTypeScale.title}`}>
                          Kids’ Brain Nuggets — Answers
                        </h3>
                        <p className={`text-xs font-medium text-ink-soft sm:text-sm ${answerTypeScale.subtitle}`}>
                          Parent talking points & full explanations
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAnswersModal(false)}
                      aria-label="Close answers"
                      className="btn-glass flex h-10 w-10 cursor-pointer items-center justify-center lg:h-12 lg:w-12"
                    >
                      <Icon name="close" className="text-2xl" />
                    </button>
                  </div>

                  <div className={`grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-2 ${answerTypeScale.grid}`}>
                    {/* Age 5 Answer */}
                    <section data-testid="kids-age-5-answer" data-answer-fit-card className={`flex min-h-0 flex-col gap-3 rounded-2xl border border-purple-500/35 bg-[var(--sc)] p-4 ${answerTypeScale.card}`}>
                      <div className="flex items-center justify-between">
                        <span data-answer-fit-content className={`flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-purple-700 dark:text-purple-300 sm:text-lg ${answerTypeScale.sectionTitle}`}>
                          <span>🎈 Age 5 Challenge</span>
                          <span className={`break-words rounded bg-purple-500/15 px-2 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-200 [overflow-wrap:anywhere] ${answerTypeScale.topic}`}>
                            {data.stem_5yo.topic}
                          </span>
                        </span>
                      </div>
                      <p data-answer-fit-content className={`break-words text-base font-medium italic leading-snug text-ink-soft [overflow-wrap:anywhere] sm:text-lg ${answerTypeScale.question}`}>
                        “{data.stem_5yo.question}”
                      </p>
                      <div className={`flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-purple-500/25 bg-[var(--sc-high)] p-4 ${answerTypeScale.answerBox}`}>
                        <p className={`text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 ${answerTypeScale.label}`}>Answer</p>
                        <p data-answer-fit-content className={`break-words text-base font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-lg ${answerTypeScale.answer}`}>
                          {data.stem_5yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_5yo.parent_explanation && (
                          <div data-answer-fit-content className={`mt-auto border-t border-purple-500/20 pt-3 ${answerTypeScale.explanationWrap}`}>
                            <p className={`text-xs font-black uppercase tracking-wider text-purple-700/80 dark:text-purple-300/80 ${answerTypeScale.label}`}>Explanation for Parents</p>
                            <p className={`mt-1 break-words text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere] sm:text-base ${answerTypeScale.explanation}`}>
                              {data.stem_5yo.parent_explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Age 9 Answer */}
                    <section data-testid="kids-age-9-answer" data-answer-fit-card className={`flex min-h-0 flex-col gap-3 rounded-2xl border border-indigo-500/35 bg-[var(--sc)] p-4 ${answerTypeScale.card}`}>
                      <div className="flex items-center justify-between">
                        <span data-answer-fit-content className={`flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-indigo-700 dark:text-indigo-300 sm:text-lg ${answerTypeScale.sectionTitle}`}>
                          <span>🚀 Age 9 Challenge</span>
                          <span className={`break-words rounded bg-indigo-500/15 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-200 [overflow-wrap:anywhere] ${answerTypeScale.topic}`}>
                            {data.stem_9yo.topic}
                          </span>
                        </span>
                      </div>
                      <p data-answer-fit-content className={`break-words text-base font-medium italic leading-snug text-ink-soft [overflow-wrap:anywhere] sm:text-lg ${answerTypeScale.question}`}>
                        “{data.stem_9yo.question}”
                      </p>
                      <div className={`flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-indigo-500/25 bg-[var(--sc-high)] p-4 ${answerTypeScale.answerBox}`}>
                        <p className={`text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 ${answerTypeScale.label}`}>Answer</p>
                        <p data-answer-fit-content className={`break-words text-base font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-lg ${answerTypeScale.answer}`}>
                          {data.stem_9yo.answer || 'Discuss together with hint'}
                        </p>
                        {data.stem_9yo.parent_explanation && (
                          <div data-answer-fit-content className={`mt-auto border-t border-indigo-500/20 pt-3 ${answerTypeScale.explanationWrap}`}>
                            <p className={`text-xs font-black uppercase tracking-wider text-indigo-700/80 dark:text-indigo-300/80 ${answerTypeScale.label}`}>Explanation for Parents</p>
                            <p className={`mt-1 break-words text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere] sm:text-base ${answerTypeScale.explanation}`}>
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
