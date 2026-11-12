import type { WoodlandKind, WoodlandPhase } from './woodlandMood.ts'

export type WoodlandVignette =
  | 'chase'
  | 'sortie'
  | 'bunny'
  | 'peck'
  | 'acorn_drop'
  | 'fireflies'

export const VIGNETTE_DURATIONS_MS: Record<WoodlandVignette, number> = {
  chase: 10_600,
  sortie: 9_400,
  bunny: 8_200,
  peck: 4_500,
  acorn_drop: 4_200,
  fireflies: 9_600,
}

/** Returns which occasional woodland animations make sense for the current time & weather. */
export function eligibleWoodlandVignettes(
  phase: WoodlandPhase,
  kind: WoodlandKind,
): WoodlandVignette[] {
  const wet = kind === 'rainy' || kind === 'stormy'
  const snowy = kind === 'snowy'
  if (wet || snowy) return []

  if (phase === 'night') {
    return ['fireflies']
  }
  if (phase === 'dusk') {
    return ['fireflies', 'sortie', 'acorn_drop']
  }
  // Dawn & clear/cloudy day: full woodland cast is active!
  // Weight 'chase' and 'sortie' higher so kids see the squirrel & fox antics often.
  return ['chase', 'sortie', 'bunny', 'peck', 'acorn_drop']
}

/** Picks an eligible vignette, avoiding repeating the previous one when alternatives exist. */
export function pickWoodlandVignette(
  phase: WoodlandPhase,
  kind: WoodlandKind,
  last: WoodlandVignette | null,
  random: () => number = Math.random,
): WoodlandVignette | null {
  const pool = eligibleWoodlandVignettes(phase, kind)
  if (pool.length === 0) return null
  const filtered = pool.length > 1 && last ? pool.filter((v) => v !== last) : pool
  const idx = Math.min(filtered.length - 1, Math.floor(random() * filtered.length))
  return filtered[idx]
}
