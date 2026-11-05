export type DiwaliPhase = 'day' | 'dawn' | 'dusk' | 'night'

export function diwaliTheme(phase: DiwaliPhase) {
  const evening = phase === 'night' || phase === 'dusk'
  return {
    evening,
    sky: phase === 'day'
      ? 'linear-gradient(180deg, #507f96 0%, #a8c4c5 48%, #eed6ad 82%, #dca674 100%)'
      : phase === 'dawn'
        ? 'linear-gradient(180deg, #635779 0%, #b78d98 45%, #f0ccad 80%, #e3b077 100%)'
        : phase === 'dusk'
          ? 'linear-gradient(180deg, #17182e 0%, #49304e 45%, #93595b 78%, #c48b62 100%)'
          : 'linear-gradient(180deg, #080e24 0%, #19172f 50%, #35233e 82%, #704348 100%)',
    stone: evening ? '#35253d' : '#c99a72',
    stoneLight: evening ? '#5b3a50' : '#e7bf91',
    recess: evening ? '#17182b' : '#8d604e',
    line: evening ? '#b08a68' : '#f3d6ae',
    gold: evening ? '#efc37c' : '#9a6131',
    steps: evening ? '#201e32' : '#bc8967',
    water: evening ? '#111b31' : '#557e87',
    frame: evening ? '#f2e0c5' : '#fff5e5',
  }
}
