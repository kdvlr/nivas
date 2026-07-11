import Modal from './Modal'
import type { WeatherData } from '../lib/types'

const dayName = (iso: string, i: number) =>
  i === 0 ? 'Today' : new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })

const hourLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' })

export default function WeatherModal({
  weather,
  onClose,
}: {
  weather: WeatherData
  onClose: () => void
}) {
  const cur = weather.current
  const hourly = weather.hourly ?? []
  const days = weather.daily.slice(0, 5)

  return (
    <Modal title="Weather" onClose={onClose} wide>
      <div className="flex flex-col gap-6">
        {/* current conditions */}
        {cur && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-6xl leading-none">{cur.icon}</span>
              <div>
                <div className="text-5xl font-semibold text-ink">{cur.temp}°</div>
                <div className="text-lg text-ink-soft">{cur.label}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-ink-soft">
              {cur.feels_like != null && <span>Feels like <b className="text-ink">{cur.feels_like}°</b></span>}
              {cur.humidity != null && <span>Humidity <b className="text-ink">{cur.humidity}%</b></span>}
              {cur.wind != null && <span>Wind <b className="text-ink">{cur.wind}</b></span>}
            </div>
          </div>
        )}

        {/* hourly */}
        {hourly.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Hourly</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {hourly.map((h) => (
                <div
                  key={h.time}
                  className="glass-inset flex min-w-[4.2rem] flex-col items-center gap-1 px-2 py-3"
                >
                  <span className="text-xs font-medium text-ink-soft">{hourLabel(h.time)}</span>
                  <span className="text-2xl leading-none">{h.icon}</span>
                  <span className="text-lg font-semibold text-ink">{h.temp}°</span>
                  {h.precip > 0 && (
                    <span className="text-[0.7rem] font-medium text-sky-600 dark:text-sky-400">
                      {h.precip}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5-day */}
        {days.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Next {days.length} days
            </h3>
            <div className="flex flex-col">
              {days.map((d, i) => (
                <div
                  key={d.date}
                  className="flex items-center gap-3 border-b border-[var(--outline-var)] py-2.5 last:border-0"
                >
                  <span className="w-12 text-base font-semibold text-ink">{dayName(d.date, i)}</span>
                  <span className="text-2xl leading-none">{d.icon}</span>
                  <span className="flex-1 text-base text-ink-soft">{d.label}</span>
                  {!!d.precip && d.precip > 0 && (
                    <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                      💧 {d.precip}%
                    </span>
                  )}
                  <span className="text-base font-semibold text-ink">{d.tmax}°</span>
                  <span className="w-8 text-right text-base text-ink-soft">{d.tmin}°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
