import React, { useEffect, useRef, useState } from 'react'
import { getQueryParam } from '../sky/queryParam'
import { HARVEST_EXPRESS_CSS, HARVEST_EXPRESS_SVG } from './harvestExpressMarkup'
import {
  HARVEST_REGIONS,
  mountHarvestExpress,
  type HarvestExpressController,
} from './harvestExpressEngine'

export type HarvestExpressPhase = 'dawn' | 'day' | 'dusk' | 'night'

interface HarvestExpressStageProps {
  phase: HarvestExpressPhase
  paused: boolean
  slideTick: number
}

function phaseToThemeClass(phase: HarvestExpressPhase): string {
  if (phase === 'night') return 'theme-night'
  if (phase === 'dusk' || phase === 'dawn') return 'theme-dusk'
  return 'theme-day'
}

function HarvestExpressStageInner({ phase, paused, slideTick }: HarvestExpressStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<HarvestExpressController | null>(null)
  const lastTickRef = useRef<number>(slideTick)

  const initialRegion = (() => {
    const raw = getQueryParam('region')
    const n = raw !== null ? Number(raw) : NaN
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) % HARVEST_REGIONS.length : 0
  })()

  const [regionIdx, setRegionIdx] = useState<number>(initialRegion)
  const regionIdxRef = useRef<number>(initialRegion)
  regionIdxRef.current = regionIdx

  // Mount the procedural SVG scene & 60fps kinematics engine once
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = HARVEST_EXPRESS_SVG
    const svg = host.querySelector('svg.scene') as SVGSVGElement | null
    if (!svg) return

    const isStatic = getQueryParam('static') === '1'
    const ctrl = mountHarvestExpress(svg, {
      initialRegion,
      initialPaused: paused,
      isStatic,
      onRegionChange: (idx) => {
        setRegionIdx(idx)
      },
    })
    controllerRef.current = ctrl

    return () => {
      ctrl.destroy()
      controllerRef.current = null
      host.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep rAF engine in sync with Nivas pause state (video playback, screen sleep, overlays)
  useEffect(() => {
    controllerRef.current?.setPaused(paused)
  }, [paused])

  // Surge the train forward to the next US coast-to-coast stop on every photo transition
  useEffect(() => {
    if (slideTick === lastTickRef.current) return
    lastTickRef.current = slideTick
    const nextIdx = (regionIdxRef.current + 1) % HARVEST_REGIONS.length
    controllerRef.current?.surgeToRegion(nextIdx)
  }, [slideTick])

  const activeRegion = HARVEST_REGIONS[regionIdx] ?? HARVEST_REGIONS[0]

  return (
    <div
      className={`harvest-express-stage ${phaseToThemeClass(phase)} ${paused ? 'is-paused' : ''}`}
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      <style>{HARVEST_EXPRESS_CSS}</style>
      <div ref={hostRef} className="absolute inset-0 w-full h-full" />

      {/* Coast-to-Coast Route Progress Pill (passive, bottom-left) */}
      <div
        className="absolute bottom-[18px] left-[28px] z-30 flex items-center gap-3 px-4 py-2 rounded-full pointer-events-none select-none"
        style={{
          background: 'rgba(18, 10, 5, 0.78)',
          border: '1px solid rgba(253, 224, 71, 0.28)',
          color: '#fef3c7',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        }}
      >
        <span>{activeRegion.name}</span>
        <div className="flex items-center gap-1.5">
          {HARVEST_REGIONS.map((r, i) => (
            <div
              key={r.name}
              style={{
                width: i === regionIdx ? '22px' : '8px',
                height: '8px',
                borderRadius: '999px',
                background:
                  i === regionIdx
                    ? '#fbbf24'
                    : i < regionIdx
                      ? 'rgba(251, 191, 36, 0.65)'
                      : 'rgba(255, 255, 255, 0.22)',
                boxShadow: i === regionIdx ? '0 0 10px rgba(251, 191, 36, 0.75)' : 'none',
                transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export const HarvestExpressStage = React.memo(HarvestExpressStageInner)
