import type { SkyKind, SkyPhase } from './skyEngine'
import { getHolidayOverride, getQueryParam } from './queryParam'

// Dev/test override: append ?sky=night&skyfx=rainy anywhere in the URL to preview any sky state.
export const PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night']
export const KINDS: SkyKind[] = ['clear', 'cloudy', 'rainy', 'snowy', 'stormy']

export const getPhaseOverride = () => {
  const p = PHASES.find((x) => x === getQueryParam('sky') || x === getQueryParam('phase'))
  if (p) return p
  const h = getHolidayOverride()?.toLowerCase()
  if (h === 'spooky') return 'night'
  return null
}

export const getKindOverride = () => KINDS.find((k) => k === getQueryParam('skyfx')) ?? null

/** True when the URL carries a valid sky/skyfx/holiday preview override. */
export const hasSkyOverride = () =>
  getPhaseOverride() !== null ||
  getKindOverride() !== null ||
  getHolidayOverride() !== null
