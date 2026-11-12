export type WoodlandPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type WoodlandKind = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'

export interface WoodlandMood {
  owl: 'sleeping' | 'awake'
  fox: 'stretching' | 'watching' | 'curled'
  squirrel: 'sleeping' | 'umbrella' | 'cozy' | 'foraging'
  lanternsLit: boolean
  wet: boolean
}

/** Daily & weather routine for all Storybook Woodland creatures. */
export function computeWoodlandMood(phase: WoodlandPhase, kind: WoodlandKind): WoodlandMood {
  const wet = kind === 'rainy' || kind === 'stormy'
  const snowy = kind === 'snowy'
  const owl = phase === 'dusk' || phase === 'night' ? 'awake' : 'sleeping'
  const fox =
    wet || snowy || phase === 'dusk' || phase === 'night'
      ? 'curled'
      : phase === 'dawn'
        ? 'stretching'
        : 'watching'
  const squirrel =
    phase === 'night'
      ? 'sleeping'
      : wet
        ? 'umbrella'
        : snowy
          ? 'cozy'
          : 'foraging'
  const lanternsLit = phase === 'dusk' || phase === 'night' || wet || snowy
  return { owl, fox, squirrel, lanternsLit, wet }
}

/** 4 acorns on Nov 1 -> 22 acorns on Nov 30. */
export function computeHollowAcorns(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  return 4 + Math.round(clamped * 18)
}

/** Canopy foliage fullness tier (3 = early Nov, 2 = mid-Nov, 1 = late Nov). */
export function computeCanopyDensity(progress: number): 3 | 2 | 1 {
  if (progress < 0.38) return 3
  if (progress < 0.74) return 2
  return 1
}
