import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icon'
import { useTimer } from '../../context/TimerContext'
import { getStageStyles, formatTimerDisplay } from '../../lib/timer'
import { PRESS_SPRING, SPATIAL_EXPRESSIVE_DEFAULT } from '../../lib/motion'

export default function FullScreenTimer() {
  const {
    timer,
    isFullScreen,
    closeFullScreen,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addSeconds,
    cancelTimer,
    dismissAlarm,
  } = useTimer()

  if (!isFullScreen || !timer) return null

  const isRinging = timer.status === 'ringing'
  const isPaused = timer.status === 'paused'
  const isRunning = timer.status === 'running'

  const styles = useMemo(() => getStageStyles(timer.stage), [timer.stage])
  const timeInfo = useMemo(() => formatTimerDisplay(timer.remainingSeconds), [timer.remainingSeconds])

  // Progress computation (1.0 at start down to 0.0 at completion)
  const progress = timer.totalSeconds > 0 ? Math.max(0, Math.min(1, timer.remainingSeconds / timer.totalSeconds)) : 0

  const radius = 164
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={SPATIAL_EXPRESSIVE_DEFAULT}
        className={`fixed inset-0 z-[95] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden bg-slate-950/96 backdrop-blur-2xl text-white ${
          styles.isFlashing ? 'animate-timer-ambient-flash border-4 border-red-500/50' : ''
        }`}
      >
        {/* Top Bar / Header */}
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-10 shrink-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={PRESS_SPRING}
            onClick={closeFullScreen}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white/90 text-sm font-semibold backdrop-blur-md transition-colors cursor-pointer"
            title="Minimize to floating widget"
          >
            <Icon name="fullscreen_exit" className="text-xl" />
            <span className="hidden sm:inline">Minimize</span>
          </motion.button>

          <div className="flex flex-col items-center">
            <span className="text-sm font-bold tracking-widest uppercase text-white/60">
              {timer.label || 'Timer'}
            </span>
            {isPaused && (
              <span className="text-xs font-bold px-2 py-0.5 mt-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase tracking-wider">
                Paused
              </span>
            )}
            {isRinging && (
              <span className="text-xs font-bold px-2.5 py-0.5 mt-0.5 rounded-full bg-red-500/30 text-red-300 uppercase tracking-wider animate-pulse">
                Time Expired
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isRinging && (
              <>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={PRESS_SPRING}
                  onClick={() => addSeconds(60)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-colors cursor-pointer"
                  title="Add 1 minute"
                >
                  +1m
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={PRESS_SPRING}
                  onClick={() => addSeconds(300)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-colors cursor-pointer"
                  title="Add 5 minutes"
                >
                  +5m
                </motion.button>
              </>
            )}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={PRESS_SPRING}
              onClick={isRinging ? dismissAlarm : cancelTimer}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white/80 flex items-center justify-center transition-colors cursor-pointer"
              title={isRinging ? 'Dismiss' : 'Cancel Timer'}
            >
              <Icon name="close" className="text-xl" />
            </motion.button>
          </div>
        </div>

        {/* Center: Animated Circular Gauge & Digits */}
        <div className="flex flex-col items-center justify-center flex-1 my-1 sm:my-2 z-10 min-h-0 w-full overflow-hidden">
          <div className="relative flex items-center justify-center w-[min(58vh,80vw,550px)] h-[min(58vh,80vw,550px)] max-w-[550px] max-h-[550px] aspect-square shrink-0">
            {/* Ambient Radial Color Glow */}
            <div
              className={`absolute -inset-8 sm:-inset-12 rounded-full transition-all duration-700 pointer-events-none ${
                styles.isFlashing ? 'animate-timer-flash' : ''
              }`}
              style={{
                background: `radial-gradient(circle, ${styles.bgGlow} 0%, transparent 68%)`,
                filter: 'blur(20px)',
              }}
            />

            {/* SVG Circular Progress Ring */}
            <svg
              className="w-full h-full transform -rotate-90 pointer-events-none drop-shadow-md"
              viewBox="0 0 380 380"
            >
              {/* Track */}
              <circle
                cx="190"
                cy="190"
                r={radius}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="15"
                fill="none"
              />
              {/* Active Animated Ring */}
              <circle
                cx="190"
                cy="190"
                r={radius}
                stroke={styles.strokeColor}
                strokeWidth="15"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-[stroke-dashoffset,stroke] duration-300 ease-out"
                style={{
                  filter: `drop-shadow(0 0 12px ${styles.strokeColor}) drop-shadow(0 0 24px ${styles.strokeColor}66)`,
                }}
              />
            </svg>

            {/* Centered Countdown Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              {isRinging ? (
                <div className="flex flex-col items-center animate-timer-alarm">
                  <Icon name="notifications_active" className="text-7xl sm:text-8xl text-red-500 animate-bounce mb-2" />
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-red-400 tracking-tight leading-none drop-shadow-md">
                    TIME'S UP!
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-white/70 mt-2 uppercase tracking-widest">
                    Timer Completed
                  </span>
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center w-full ${styles.isFlashing ? 'animate-timer-flash' : ''}`}>
                  <div
                    className="font-black tabular-nums tracking-tight leading-none select-text"
                    style={{
                      fontSize: timeInfo.hasHours
                        ? 'clamp(2.75rem, 7.5vw, 5.25rem)'
                        : 'clamp(4.25rem, 13vw, 8.5rem)',
                      color: styles.strokeColor,
                      filter: `drop-shadow(0 0 16px ${styles.strokeColor}88)`,
                    }}
                  >
                    {timeInfo.formatted}
                  </div>
                  <span className="mt-2 sm:mt-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-white/70">
                    {styles.badgeText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Action Controls */}
        <div className="flex items-center justify-center gap-6 w-full max-w-md mx-auto z-10 shrink-0 pb-2 sm:pb-4">
          {isRinging ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={PRESS_SPRING}
              onClick={dismissAlarm}
              className="flex-1 py-4 px-8 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-lg sm:text-xl tracking-wide shadow-xl flex items-center justify-center gap-3 cursor-pointer animate-pulse"
            >
              <Icon name="alarm_off" className="text-2xl" />
              <span>DISMISS ALARM</span>
            </motion.button>
          ) : (
            <>
              {/* Reset Button */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={PRESS_SPRING}
                onClick={resetTimer}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Restart timer"
              >
                <Icon name="restart_alt" className="text-2xl sm:text-3xl" />
              </motion.button>

              {/* Pause / Resume Button */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={PRESS_SPRING}
                onClick={isRunning ? pauseTimer : resumeTimer}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center shadow-xl cursor-pointer transition-all"
                style={{
                  backgroundColor: styles.strokeColor,
                  color: '#0f172a',
                  boxShadow: `0 0 24px ${styles.strokeColor}66, 0 4px 16px rgba(0,0,0,0.4)`,
                }}
                title={isRunning ? 'Pause timer' : 'Resume timer'}
              >
                <Icon
                  name={isRunning ? 'pause' : 'play_arrow'}
                  className="text-4xl sm:text-5xl font-black"
                />
              </motion.button>

              {/* Stop / Cancel Button */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={PRESS_SPRING}
                onClick={cancelTimer}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Stop and discard timer"
              >
                <Icon name="stop" className="text-2xl sm:text-3xl" />
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
