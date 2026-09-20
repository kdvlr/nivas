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
 * Formats a scaled numeric quantity into natural cooking fractions (using Unicode fractions) or decimals.
 * e.g. 1.5 -> "1 ½", 0.5 -> "½", 0.25 -> "¼", 2.0 -> "2", 300 -> "300"
 */
export function formatQuantity(val: number): string {
  if (val <= 0) return '0'
  if (Math.abs(val - Math.round(val)) < 0.02) {
    return String(Math.round(val))
  }

  const whole = Math.floor(val)
  const frac = val - whole

  const STANDARD_FRACTIONS = [
    { val: 1 / 8, text: '⅛' },
    { val: 1 / 6, text: '⅙' },
    { val: 1 / 4, text: '¼' },
    { val: 1 / 3, text: '⅓' },
    { val: 3 / 8, text: '⅜' },
    { val: 1 / 2, text: '½' },
    { val: 5 / 8, text: '⅝' },
    { val: 2 / 3, text: '⅔' },
    { val: 3 / 4, text: '¾' },
    { val: 7 / 8, text: '⅞' },
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
 * Common regex token matching numeric quantities, fractions, mixed numbers, or decimals.
 */
const NUM_TOKEN =
  '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+\\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\\d+(?:\\.\\d+)?)'

/**
 * Checks if a parenthetical string contains preparation instructions or dimensional measurements
 * that must NEVER be scaled.
 */
function shouldSkipParenthetical(inner: string): boolean {
  // Dimensions like "¾ x ¾ inch", "1 x 1 inch", "2x2 cm"
  if (/\d+\s*(?:x|×|by)\s*\d+/i.test(inner)) {
    return true
  }
  // Preceded by preparation / cutting verbs (e.g. "cubed to", "chopped to", "cut into")
  if (/\b(?:cubed|chopped|cut|sliced|diced|grated|minced|shredded)\s+(?:in|into|to|about)\b/i.test(inner)) {
    return true
  }
  // Thickness / dimension geometry qualifiers
  if (/\b(?:thick|thickness|wide|width|diameter)\b/i.test(inner)) {
    return true
  }
  // Cooking temperatures or durations
  if (/(?:\d+°\s*[FC]|\d+\s*(?:minutes?|mins?|hours?|hrs?|sec|seconds?))\b/i.test(inner)) {
    return true
  }
  // Substitution clauses (e.g. "or 1/4 cup tomato puree...") but allow item count choices like "2 large or 3 medium"
  if (/\b(?:or|substitute|mixed with)\b/i.test(inner) && !/\d+\s*(?:large|medium|small)\s+or\s+\d+/i.test(inner)) {
    return true
  }
  return false
}

/**
 * Scales secondary quantities inside a parenthetical clause if eligible.
 * Examples:
 * - "(2 medium)" -> "(4 medium)"
 * - "(180 grams)" -> "(360 grams)"
 * - "(3 to 4)" -> "(6 to 8)"
 * - "(½ inch)" -> "(1 inch)"
 * - "(2 large or 3 medium)" -> "(4 large or 6 medium)"
 */
function scaleParenthetical(inner: string, factor: number): string {
  let trimmed = inner.trim()
  // Clean nested redundant parens e.g. "((foo))" -> "foo"
  while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    trimmed = trimmed.slice(1, -1).trim()
  }

  if (shouldSkipParenthetical(trimmed)) {
    return trimmed
  }

  // Pattern 1: Pure number range inside paren, e.g. "3 to 4", "6 to 8", "1-2"
  const rangeRegex = new RegExp(`^(\\s*)(${NUM_TOKEN})(\\s*(?:-|to|–|—)\\s*)(${NUM_TOKEN})(\\s*.*)$`, 'i')
  const rangeMatch = trimmed.match(rangeRegex)
  if (rangeMatch) {
    const n1 = parseNumberToken(rangeMatch[2])
    const n2 = parseNumberToken(rangeMatch[4])
    if (n1 !== null && n2 !== null) {
      const sep = rangeMatch[3]
      const sepStr = sep.includes('-') ? '-' : ` ${sep.trim()} `
      const rest = rangeMatch[5]
      return `${rangeMatch[1]}${formatQuantity(n1 * factor)}${sepStr}${formatQuantity(n2 * factor)}${rest}`
    }
  }

  // Pattern 2: Choice between counts, e.g. "2 large or 3 medium"
  const choiceRegex = new RegExp(`^(\\s*)(${NUM_TOKEN})(\\s*(?:large|medium|small)\\b\\s+or\\s+)(${NUM_TOKEN})(\\s*(?:large|medium|small)\\b.*)$`, 'i')
  const choiceMatch = trimmed.match(choiceRegex)
  if (choiceMatch) {
    const n1 = parseNumberToken(choiceMatch[2])
    const n2 = parseNumberToken(choiceMatch[4])
    if (n1 !== null && n2 !== null) {
      return `${choiceMatch[1]}${formatQuantity(n1 * factor)}${choiceMatch[3]}${formatQuantity(n2 * factor)}${choiceMatch[5]}`
    }
  }

  // Pattern 3: Single number with unit or descriptor, e.g. "2 medium", "180 grams", "6 oz", "½ inch", "palak - 3½ cups"
  const singleRegex = new RegExp(`(\\b|^)(${NUM_TOKEN})(\\s*(?:medium|large|small|grams?|g|oz|ounces?|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|lbs?|pounds?|inch|inches|cm)\\b)`, 'i')
  const singleMatch = trimmed.match(singleRegex)
  if (singleMatch && singleMatch.index !== undefined) {
    const val = parseNumberToken(singleMatch[2])
    if (val !== null) {
      const scaled = formatQuantity(val * factor)
      const start = singleMatch.index + singleMatch[1].length
      const end = start + singleMatch[2].length
      return trimmed.slice(0, start) + scaled + trimmed.slice(end)
    }
  }

  return trimmed
}

/**
 * Walks a string and transforms all top-level parenthetical expressions while respecting nesting.
 */
function processParentheticals(text: string, factor: number): string {
  const result: string[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '(') {
      let depth = 1
      let j = i + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth++
        else if (text[j] === ')') depth--
        j++
      }
      if (depth === 0) {
        const inner = text.slice(i + 1, j - 1)
        result.push('(' + scaleParenthetical(inner, factor) + ')')
        i = j
        continue
      }
    }
    result.push(text[i])
    i++
  }
  return result.join('')
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
 * Automatically identifies:
 * 1. Primary leading quantity / range at the start of the ingredient.
 * 2. Secondary parenthetical quantities/weights/counts (e.g. (2 medium), (180 grams), (3 to 4)).
 * 3. Preserves cutting dimensions (e.g. cubed to ¾ x ¾ inch), temperatures, and notes.
 */
export function scaleIngredient(ingredient: string, factor: number): string {
  if (!ingredient || factor === 1 || factor <= 0) return ingredient

  const trimmed = ingredient.trim()
  const rangeRegex = new RegExp(`^(${NUM_TOKEN})(?:(\\s*(?:-|to|–|—)\\s*)(${NUM_TOKEN}))?(.*)$`, 'i')
  const match = trimmed.match(rangeRegex)

  if (!match) {
    return processParentheticals(trimmed, factor)
  }

  const num1 = parseNumberToken(match[1])
  if (num1 === null) {
    return processParentheticals(trimmed, factor)
  }

  const sep = match[2]
  const num2 = match[3] ? parseNumberToken(match[3]) : null
  let rest = match[4]

  const scaled1 = num1 * factor
  let formattedResult = formatQuantity(scaled1)

  if (sep && num2 !== null) {
    const scaled2 = num2 * factor
    const sepStr = sep.includes('-') ? '-' : ` ${sep.trim()} `
    formattedResult += sepStr + formatQuantity(scaled2)
    rest = adjustUnitPlural(rest, scaled2)
  } else {
    rest = adjustUnitPlural(rest, scaled1)
  }

  rest = processParentheticals(rest, factor)
  return formattedResult + rest
}
