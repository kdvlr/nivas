/**
 * Material 3 Expressive motion physics tokens.
 * https://m3.material.io/styles/motion/overview
 *
 * M3 defines every transition as a spring in one of two categories:
 *  - SPATIAL springs move things (x/y/scale/layout) and may overshoot/bounce.
 *  - EFFECTS springs fade things (opacity/color/shadow) and must NEVER bounce.
 * Each comes in an expressive scheme (playful, for hero moments) and a
 * standard scheme (calmer, for frequent utilitarian interactions), at three
 * speeds: fast, default, slow.
 *
 * M3 specifies springs as (damping ratio, stiffness); Framer Motion takes a
 * damping *coefficient*, so convert: damping = ratio * 2 * sqrt(stiffness * mass).
 */

const m3spring = (dampingRatio: number, stiffness: number) => ({
  type: 'spring' as const,
  stiffness,
  damping: Math.round(dampingRatio * 2 * Math.sqrt(stiffness) * 10) / 10,
  mass: 1,
})

/* Spatial springs — expressive scheme (bouncy; kid-facing, hero moments) */
export const SPATIAL_EXPRESSIVE_FAST = m3spring(0.6, 800)
export const SPATIAL_EXPRESSIVE_DEFAULT = m3spring(0.8, 380)
export const SPATIAL_EXPRESSIVE_SLOW = m3spring(0.8, 200)

/* Spatial springs — standard scheme (settled; forms, settings, dense lists) */
export const SPATIAL_STANDARD_FAST = m3spring(0.9, 1400)
export const SPATIAL_STANDARD_DEFAULT = m3spring(0.9, 700)
export const SPATIAL_STANDARD_SLOW = m3spring(0.9, 300)

/* Effects springs — critically damped, identical in both schemes */
export const EFFECTS_FAST = m3spring(1, 3800)
export const EFFECTS_DEFAULT = m3spring(1, 1600)
export const EFFECTS_SLOW = m3spring(1, 800)

/**
 * Combined transitions for elements that move *and* fade: the spatial spring
 * drives position/scale/layout while opacity gets a non-bouncing effects
 * spring, per the M3 rule that effects never overshoot.
 */
export const EXPRESSIVE_ENTER = { ...SPATIAL_EXPRESSIVE_DEFAULT, opacity: EFFECTS_DEFAULT }
export const STANDARD_ENTER = { ...SPATIAL_STANDARD_DEFAULT, opacity: EFFECTS_DEFAULT }

/** Press/hover feedback on buttons and touch targets. */
export const PRESS_SPRING = SPATIAL_EXPRESSIVE_FAST
