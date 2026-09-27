import React from 'react'
import TopClockHeader from './TopClockHeader'

export interface PageHeaderProps {
  title: string
  badge?: React.ReactNode
  leftActions?: React.ReactNode
  inlineActions?: React.ReactNode
  rightActions?: React.ReactNode
  secondaryMobileRow?: React.ReactNode
  now?: Date
  className?: string
  config?: any
}

/**
 * Standardized single-row sub-view header component adhering to MD3 guidelines
 * and the dashboard's Single-Row Sub-View Header Layout invariant.
 *
 * Keeps page title/actions on the left and the dual-timezone clock on the right
 * in a single horizontal line across 100% of screens.
 */
export default function PageHeader({
  title,
  badge,
  leftActions,
  inlineActions,
  rightActions,
  secondaryMobileRow,
  now = new Date(),
  className = '',
  config,
}: PageHeaderProps) {
  return (
    <div className={`mb-3 sm:mb-4 lg:mb-6 flex flex-col gap-2.5 sm:gap-3 shrink-0 ${className}`}>
      {/* Primary single-row header bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left cluster: left actions, title, badge, inline actions */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {leftActions}
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink shrink-0">
            {title}
          </h1>
          {badge && (
            typeof badge === 'string' || typeof badge === 'number' ? (
              <span className="rounded-full bg-sand-100 dark:bg-sand-800 px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold text-ink-soft shrink-0">
                {badge}
              </span>
            ) : (
              badge
            )
          )}
          {inlineActions}
        </div>

        {/* Right cluster: optional right actions and clock */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {rightActions}
          <TopClockHeader now={now} config={config} />
        </div>
      </div>

      {/* Secondary mobile-only controls row */}
      {secondaryMobileRow && (
        <div className="flex sm:hidden items-center gap-2 shrink-0">
          {secondaryMobileRow}
        </div>
      )}
    </div>
  )
}
