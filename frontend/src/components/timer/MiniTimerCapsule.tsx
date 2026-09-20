import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icon'
import { useTimer } from '../../context/TimerContext'
import { getStageStyles, formatTimerDisplay } from '../../lib/timer'
import { PRESS_SPRING, SPATIAL_EXPRESSIVE_DEFAULT } from '../../lib/motion'

export default function MiniTimerCapsule() {
  const { timer, isFullScreen, openFullScreen } = useTimer()

  // Only render if a timer is active and fullscreen is minimized
  if (!timer || isFullScreen) return null

  const styles = getStageStyles(timer.stage)
  const timeInfo = formatTimerDisplay(timer.remainingSeconds)
  const isPaused = timer.status === 'paused'
  const isRinging = timer.status === 'ringing'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        transition={SPATIAL_EXPRESSIVE_DEFAULT}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 lg:bottom-6 lg:left-24 z-30 pointer-events-auto select-none"
      >
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={PRESS_SPRING}
          onClick={openFullScreen}
          className={`glass flex items-center gap-3 px-4 py-2.5 rounded-full shadow-xl border cursor-pointer backdrop-blur-xl ${
            styles.isFlashing ? 'animate-timer-ambient-flash border-red-500' : 'border-white/15'
          }`}
          style={{
            boxShadow: `0 8px 24px ${styles.bgGlow}`,
          }}
          title="Click to view fullscreen timer"
        >
          {/* Pulsing indicator dot */}
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              isPaused ? 'bg-amber-400' : isRinging ? 'bg-red-500 animate-ping' : ''
            }`}
            style={!isPaused && !isRinging ? { backgroundColor: styles.strokeColor } : undefined}
          />

          <Icon
            name={isRinging ? 'notifications_active' : isPaused ? 'pause' : 'timer'}
            className={`text-lg ${isRinging ? 'text-red-500 animate-bounce' : ''}`}
            style={!isRinging ? { color: styles.strokeColor } : undefined}
          />

          <div className="flex flex-col text-left">
            <span
              className="text-base font-extrabold tabular-nums tracking-tight leading-none"
              style={{ color: styles.strokeColor }}
            >
              {isRinging ? "TIME'S UP!" : timeInfo.formatted}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              {isRinging ? 'Ringing' : isPaused ? 'Paused' : timer.label || 'Timer'}
            </span>
          </div>

          <Icon name="fullscreen" className="text-base text-ink-soft ml-1" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
