export type DiwaliPhase = 'day' | 'dawn' | 'dusk' | 'night'

export function diwaliTheme(phase: DiwaliPhase) {
  const evening = phase === 'night' || phase === 'dusk'
  return {
    evening,
    // Bright, super fun, festive Indian color gradients across all four phases
    sky: phase === 'day'
      ? 'linear-gradient(180deg, #1b6ca8 0%, #3caea3 34%, #ffd166 72%, #f77f00 100%)'
      : phase === 'dawn'
        ? 'linear-gradient(180deg, #3d1a58 0%, #7e2e74 38%, #d94f70 70%, #f77f00 100%)'
        : phase === 'dusk'
          ? 'linear-gradient(180deg, #130a2a 0%, #381245 36%, #831843 68%, #ea580c 100%)'
          : 'linear-gradient(180deg, #050818 0%, #0d1233 38%, #1e1b4b 70%, #4a154b 100%)',
    // Temple sandstone and architectural surfaces
    stone: evening ? '#261b33' : '#d07e3e',
    stoneLight: evening ? '#4a284e' : '#f5cb8e',
    recess: evening ? '#140e21' : '#873e23',
    line: evening ? '#eab308' : '#ffd166',
    gold: evening ? '#facc15' : '#eab308',
    steps: evening ? '#1b1428' : '#c26d30',
    water: evening ? '#0c162c' : '#1d8a99',
    frame: evening ? '#fcf0db' : '#fffbeb',
  }
}
