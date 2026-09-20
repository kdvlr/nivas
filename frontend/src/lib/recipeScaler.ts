/**
 * Utilities for parsing and dynamically scaling recipe servings and ingredient quantities.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

/**
 * Extracts a numeric base serving count from a servings string.
 * e.g. "4 servings" -> 4, "3-4" -> 4, "10" -> 10, "" -> 4.
 */
export function parseBaseServings(servingsStr?: string | null): number {
  if (!servingsStr) return 4
  const matches = servingsStr.match(/\d+/g)
  if (!matches || matches.length === 0) return 4
  // For ranges like "3-4" or "4 to 6", pick the upper bound or single value
  const num = parseInt(matches[matches.length > 1 ? 1 : 0], 10)
  return num > 0 ? num : 4
}

/**
 * Parses a numeric string token into a floating point number.
 * Supports decimals (1.5), fractions (1/2), mixed numbers (1 1/2),
 * and Unicode fraction characters (½, 1½).
 */
export function parseNumberToken(str: string): number | null {
  if (!str) return null
  const trimmed = str.trim()

  // Mixed number with Unicode fraction: '1½' or '1 ½'
  const mixedUni = trimmed.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/)
  if (mixedUni) {
    const whole = parseFloat(mixedUni[1])
    const frac = UNICODE_FRACTIONS[mixedUni[2]] || 0
    return whole + frac
  }

  // Single Unicode fraction: '½', '¼', etc.
  if (UNICODE_FRACTIONS[trimmed] !== undefined) {
    return UNICODE_FRACTIONS[trimmed]
  }

  // Mixed number with slash fraction: '1 1/2'
  const mixedSlash = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedSlash) {
    const whole = parseFloat(mixedSlash[1])
    const num = parseFloat(mixedSlash[2])
    const den = parseFloat(mixedSlash[3])
    return den !== 0 ? whole + num / den : null
  }

  // Pure slash fraction: '1/2', '3/4'
  const slash = trimmed.match(/^(\d+)\/(\d+)$/)
  if (slash) {
    const num = parseFloat(slash[1])
    const den = parseFloat(slash[2])
    return den !== 0 ? num / den : null
  }

  const fl = parseFloat(trimmed)
  return isNaN(fl) ? null : fl
}

/**
 * Formats a scaled numeric quantity into natural cooking fractions or decimals.
 * e.g. 1.5 -> "1 1/2", 0.25 -> "1/4", 2.0 -> "2", 300 -> "300"
 */
export function formatQuantity(val: number): string {
  if (val <= 0) return '0'
  if (Math.abs(val - Math.round(val)) < 0.02) {
    return String(Math.round(val))
  }

  const whole = Math.floor(val)
  const frac = val - whole

  const STANDARD_FRACTIONS = [
    { val: 1 / 8, text: '1/8' },
    { val: 1 / 6, text: '1/6' },
    { val: 1 / 4, text: '1/4' },
    { val: 1 / 3, text: '1/3' },
    { val: 3 / 8, text: '3/8' },
    { val: 1 / 2, text: '1/2' },
    { val: 5 / 8, text: '5/8' },
    { val: 2 / 3, text: '2/3' },
    { val: 3 / 4, text: '3/4' },
    { val: 7 / 8, text: '7/8' },
    { val: 1.0, text: '1' },
  ]

  let closest: { val: number; text: string } | null = null
  let minDiff = 0.045
  for (const f of STANDARD_FRACTIONS) {
    const diff = Math.abs(frac - f.val)
    if (diff < minDiff) {
      minDiff = diff
      closest = f
    }
  }

  if (closest) {
    if (closest.text === '1') {
      return String(whole + 1)
    }
    return whole > 0 ? `${whole} ${closest.text}` : closest.text
  }

  if (val >= 10) return String(Math.round(val))
  return val.toFixed(1).replace(/\.0$/, '')
}

/**
 * Automatically adjusts common English measurement units between singular and plural forms.
 * e.g. "1 cups" -> "1 cup", "2 cup" -> "2 cups"
 */
function adjustUnitPlural(rest: string, quantity: number): string {
  if (quantity <= 1) {
    return rest
      .replace(/^(\s+)cups\b/i, '$1cup')
      .replace(/^(\s+)tablespoons\b/i, '$1tablespoon')
      .replace(/^(\s+)teaspoons\b/i, '$1teaspoon')
      .replace(/^(\s+)cloves\b/i, '$1clove')
      .replace(/^(\s+)slices\b/i, '$1slice')
      .replace(/^(\s+)stalks\b/i, '$1stalk')
      .replace(/^(\s+)pinches\b/i, '$1pinch')
  } else {
    return rest
      .replace(/^(\s+)cup\b/i, '$1cups')
      .replace(/^(\s+)tablespoon\b/i, '$1tablespoons')
      .replace(/^(\s+)teaspoon\b/i, '$1teaspoons')
      .replace(/^(\s+)clove\b/i, '$1cloves')
      .replace(/^(\s+)slice\b/i, '$1slices')
      .replace(/^(\s+)stalk\b/i, '$1stalks')
      .replace(/^(\s+)pinch\b/i, '$1pinches')
  }
}

/**
 * Scales an ingredient string based on a multiplier factor.
 * Automatically identifies leading numbers, fractions, mixed numbers, and ranges.
 */
export function scaleIngredient(ingredient: string, factor: number): string {
  if (!ingredient || factor === 1 || factor <= 0) return ingredient

  // Match token representing single quantity or mixed number
  const numToken =
    '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+\\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\\d+(?:\\.\\d+)?)'
  const rangeRegex = new RegExp(
    '^(' + numToken + ')(?:\\s*(-|to|–|—)\\s*(' + numToken + '))?(.*)$',
    'i'
  )

  const match = ingredient.match(rangeRegex)
  if (!match) return ingredient

  const num1 = parseNumberToken(match[1])
  if (num1 === null) return ingredient

  const separator = match[2]
  const num2 = match[3] ? parseNumberToken(match[3]) : null
  let rest = match[4]

  const scaled1 = num1 * factor
  let formattedResult = formatQuantity(scaled1)

  if (separator && num2 !== null) {
    const scaled2 = num2 * factor
    const sepStr = separator === '-' ? '-' : ` ${separator} `
    formattedResult += sepStr + formatQuantity(scaled2)
    rest = adjustUnitPlural(rest, scaled2)
  } else {
    rest = adjustUnitPlural(rest, scaled1)
  }

  return formattedResult + rest
}
