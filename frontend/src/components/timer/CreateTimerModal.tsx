import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '../Modal'
import Icon from '../Icon'
import { useTimer } from '../../context/TimerContext'
import { clampCustomTimer, formatTimerDisplay } from '../../lib/timer'
import { PRESS_SPRING } from '../../lib/motion'

const QUICK_PRESETS = [
  { label: '5 min', seconds: 5 * 60, icon: 'bolt', color: 'border-red-500/40 text-red-500 hover:bg-red-500/10' },
  { label: '10 min', seconds: 10 * 60, icon: 'bolt', color: 'border-amber-500/40 text-amber-500 hover:bg-amber-500/10' },
  { label: '15 min', seconds: 15 * 60, icon: 'timer', color: 'border-lime-500/40 text-lime-500 hover:bg-lime-500/10' },
  { label: '30 min', seconds: 30 * 60, icon: 'timer', color: 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10' },
  { label: '45 min', seconds: 45 * 60, icon: 'hourglass_bottom', color: 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10' },
]

export default function CreateTimerModal() {
  const { isCreateModalOpen, closeCreateModal, startTimer, timer, openFullScreen } = useTimer()

  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(15)

  if (!isCreateModalOpen) return null

  const handleStartQuick = (seconds: number, label: string) => {
    startTimer(seconds, label)
  }

  const handleStartCustom = () => {
    const totalSeconds = clampCustomTimer(hours, minutes)
    const label = hours > 0 ? `${hours}h ${minutes}m Timer` : `${minutes}m Timer`
    startTimer(totalSeconds, label)
  }

  const adjustHours = (delta: number) => {
    setHours((prev) => Math.max(0, Math.min(23, prev + delta)))
  }

  const adjustMinutes = (delta: number) => {
    setMinutes((prev) => {
      let next = prev + delta
      if (next >= 60) {
        if (hours < 23) {
          adjustHours(1)
          return next - 60
        }
        return 59
      }
      if (next < 0) {
        if (hours > 0) {
          adjustHours(-1)
          return next + 60
        }
        return 0
      }
      return next
    })
  }

  const totalCustomSeconds = hours * 3600 + minutes * 60
  const isCustomValid = totalCustomSeconds > 0

  return (
    <Modal title="Set Timer" onClose={closeCreateModal}>
      <div className="flex flex-col gap-6 select-none">
        {/* Active Timer Banner if currently running */}
        {timer && (
          <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icon name="timer" className="text-2xl text-[var(--primary)] animate-pulse" />
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-ink-soft">
                  Active Timer
                </div>
                <div className="text-xl font-bold tabular-nums text-ink">
                  {formatTimerDisplay(timer.remainingSeconds).formatted}
                  <span className="ml-2 text-xs font-normal text-ink-soft">({timer.label})</span>
                </div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={PRESS_SPRING}
              onClick={() => {
                closeCreateModal()
                openFullScreen()
              }}
              className="btn-glass !bg-[var(--primary)] !text-[var(--on-primary)] px-4 py-2 text-sm font-semibold rounded-xl"
            >
              View Fullscreen
            </motion.button>
          </div>
        )}

        {/* Quick Timers Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Quick Timers
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {QUICK_PRESETS.map((preset) => (
              <motion.button
                key={preset.seconds}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={PRESS_SPRING}
                onClick={() => handleStartQuick(preset.seconds, `${preset.label} Timer`)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer bg-slate-500/5 dark:bg-slate-400/5 ${preset.color}`}
              >
                <Icon name={preset.icon} className="text-2xl mb-1" />
                <span className="text-base font-bold text-ink">{preset.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Custom Timer Section (Max 23:59) */}
        <div className="flex flex-col gap-3 pt-2 border-t border-[var(--outline-var)]/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Custom Timer (Max 23:59)
            </span>
            <button
              type="button"
              onClick={() => {
                setHours(0)
                setMinutes(0)
              }}
              className="text-xs font-medium text-ink-soft hover:text-ink transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Stepper Controls & Digit Display */}
          <div className="glass-inset rounded-2xl p-5 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-4 sm:gap-6 text-ink">
              {/* Hours Column */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={PRESS_SPRING}
                  onClick={() => adjustHours(1)}
                  disabled={hours >= 23}
                  className="btn-glass !p-2 rounded-xl text-ink-soft hover:text-ink disabled:opacity-30 cursor-pointer"
                  title="+1 Hour"
                >
                  <Icon name="keyboard_arrow_up" className="text-2xl" />
                </motion.button>
                <div className="flex flex-col items-center">
                  <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight text-[var(--primary)] leading-none">
                    {String(hours).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-soft mt-1">Hours</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={PRESS_SPRING}
                  onClick={() => adjustHours(-1)}
                  disabled={hours <= 0}
                  className="btn-glass !p-2 rounded-xl text-ink-soft hover:text-ink disabled:opacity-30 cursor-pointer"
                  title="-1 Hour"
                >
                  <Icon name="keyboard_arrow_down" className="text-2xl" />
                </motion.button>
              </div>

              {/* Separator */}
              <span className="text-4xl sm:text-5xl font-black text-ink-soft/60 mb-5">:</span>

              {/* Minutes Column */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={PRESS_SPRING}
                  onClick={() => adjustMinutes(1)}
                  disabled={hours === 23 && minutes >= 59}
                  className="btn-glass !p-2 rounded-xl text-ink-soft hover:text-ink disabled:opacity-30 cursor-pointer"
                  title="+1 Minute"
                >
                  <Icon name="keyboard_arrow_up" className="text-2xl" />
                </motion.button>
                <div className="flex flex-col items-center">
                  <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight text-[var(--primary)] leading-none">
                    {String(minutes).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-soft mt-1">Minutes</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={PRESS_SPRING}
                  onClick={() => adjustMinutes(-1)}
                  disabled={hours <= 0 && minutes <= 0}
                  className="btn-glass !p-2 rounded-xl text-ink-soft hover:text-ink disabled:opacity-30 cursor-pointer"
                  title="-1 Minute"
                >
                  <Icon name="keyboard_arrow_down" className="text-2xl" />
                </motion.button>
              </div>
            </div>

            {/* Quick Adjustment Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => adjustMinutes(1)}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-ink transition-colors"
              >
                +1m
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(5)}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-ink transition-colors"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => adjustMinutes(10)}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-ink transition-colors"
              >
                +10m
              </button>
              <button
                type="button"
                onClick={() => adjustHours(1)}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-ink transition-colors"
              >
                +1h
              </button>
            </div>
          </div>

          {/* Start Custom Timer Button */}
          <motion.button
            whileHover={isCustomValid ? { scale: 1.02 } : {}}
            whileTap={isCustomValid ? { scale: 0.97 } : {}}
            transition={PRESS_SPRING}
            disabled={!isCustomValid}
            onClick={handleStartCustom}
            className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-[var(--primary)] text-[var(--on-primary)] font-bold text-base shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Icon name="play_arrow" className="text-2xl" />
            <span>Start Custom Timer</span>
          </motion.button>
        </div>
      </div>
    </Modal>
  )
}
