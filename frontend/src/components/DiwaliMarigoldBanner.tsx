import { memo, useId, useMemo } from 'react'
import type { Quality } from './sky/useQuality'
import type { SkyPhase } from './sky/skyEngine'

export interface DiwaliMarigoldBannerProps {
  phase: SkyPhase
  quality?: Quality
  paused?: boolean
}

/**
 * Traditional Indian Marigold & Mango Leaf Toran (Garland Banner)
 * Drapes across the top of the display in graceful scallops.
 * Features fluffy ruffled Genda Phool (saffron & gold marigolds),
 * fresh green mango leaves, vertical drop tassels, and polished brass bells.
 *
 * Performance-optimized:
 * - Pure SVG vector geometry (no expensive filter blur).
 * - Hardware-accelerated CSS opacity pulsation for night/dusk lamps.
 * - Respects quality tiers and reduced motion preferences.
 */
export const DiwaliMarigoldBanner = memo(function DiwaliMarigoldBanner({
  phase,
  quality = 'high',
  paused = false,
}: DiwaliMarigoldBannerProps) {
  const uid = useId()
  const isEvening = phase === 'night' || phase === 'dusk'
  const isStatic = quality === 'low' || paused

  // 16 scallops across 1920px screen width (120px per scallop)
  const scallops = useMemo(() => {
    const count = 16
    const width = 1920 / count
    const items = []

    for (let s = 0; s < count; s++) {
      const startX = s * width
      const endX = (s + 1) * width
      const midX = startX + width / 2

      // Flowers along this scallop curve (7 flowers per scallop)
      const flowers = []
      const flowerCount = 7
      for (let f = 0; f < flowerCount; f++) {
        const t = (f + 0.5) / flowerCount
        // Parabolic arc from y=8 down to y=32 and back up to y=8
        const fx = startX + t * width
        const fy = 8 + Math.sin(t * Math.PI) * 26
        const isOrange = (s * flowerCount + f) % 2 === 0
        flowers.push({ x: fx, y: fy, isOrange, id: `${s}-${f}` })
      }

      // Mango leaves hanging between flowers (6 leaves per scallop)
      const leaves = []
      for (let l = 1; l < flowerCount; l++) {
        const t = l / flowerCount
        const lx = startX + t * width
        const ly = 8 + Math.sin(t * Math.PI) * 26
        // Alternating leaf angles for organic hand-strung look
        const angle = ((l % 2 === 0 ? 1 : -1) * 8 + (s % 3 - 1) * 4)
        leaves.push({ x: lx, y: ly, angle, id: `${s}-l-${l}` })
      }

      items.push({
        idx: s,
        startX,
        endX,
        midX,
        flowers,
        leaves,
        anchorX: startX,
      })
    }
    return items
  }, [])

  return (
    <div
      className="absolute top-0 left-0 right-0 h-20 pointer-events-none z-[27] select-none overflow-hidden"
      data-static={isStatic}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1920 80"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          {/* Saffron / Orange Marigold Blossom */}
          <g id={`${uid}-flower-orange`}>
            {/* Outer ruffled petals */}
            <circle cx="0" cy="0" r="8.5" fill="#ea580c" />
            <circle cx="-3" cy="-3" r="5" fill="#f97316" />
            <circle cx="3" cy="-3" r="5" fill="#f97316" />
            <circle cx="-3" cy="3" r="5" fill="#f97316" />
            <circle cx="3" cy="3" r="5" fill="#f97316" />
            <circle cx="0" cy="-4" r="4.5" fill="#fb923c" />
            <circle cx="-4" cy="0" r="4.5" fill="#fb923c" />
            <circle cx="4" cy="0" r="4.5" fill="#fb923c" />
            <circle cx="0" cy="4" r="4.5" fill="#fb923c" />
            {/* Center dense corolla */}
            <circle cx="0" cy="0" r="3.2" fill="#c2410c" />
            <circle cx="0" cy="0" r="1.6" fill="#facc15" />
          </g>

          {/* Golden Turmeric Marigold Blossom */}
          <g id={`${uid}-flower-gold`}>
            {/* Outer ruffled petals */}
            <circle cx="0" cy="0" r="8.5" fill="#ca8a04" />
            <circle cx="-3" cy="-3" r="5" fill="#eab308" />
            <circle cx="3" cy="-3" r="5" fill="#eab308" />
            <circle cx="-3" cy="3" r="5" fill="#eab308" />
            <circle cx="3" cy="3" r="5" fill="#eab308" />
            <circle cx="0" cy="-4" r="4.5" fill="#facc15" />
            <circle cx="-4" cy="0" r="4.5" fill="#facc15" />
            <circle cx="4" cy="0" r="4.5" fill="#facc15" />
            <circle cx="0" cy="4" r="4.5" fill="#facc15" />
            {/* Center dense corolla */}
            <circle cx="0" cy="0" r="3.2" fill="#a16207" />
            <circle cx="0" cy="0" r="1.6" fill="#fef08a" />
          </g>

          {/* Crisp Pointed Mango Leaf (Aam ka Patta) */}
          <g id={`${uid}-mango-leaf`}>
            <path
              d="M 0 0 C -4 8, -4 18, 0 25 C 4 18, 4 8, 0 0 Z"
              fill="#15803d"
            />
            {/* Leaf midrib */}
            <path d="M 0 0 L 0 23" stroke="#84cc16" strokeWidth="0.8" opacity="0.85" />
          </g>

          {/* Brass Bell / Ghungroo with amber glow for evening */}
          <g id={`${uid}-brass-bell`}>
            {isEvening && (
              <circle cx="0" cy="7" r="12" fill="rgba(251, 191, 36, 0.28)" />
            )}
            {/* Little top ring */}
            <circle cx="0" cy="0" r="2.2" fill="none" stroke="#b45309" strokeWidth="1" />
            {/* Bell dome */}
            <path
              d="M -4.5 3 C -4.5 1, 4.5 1, 4.5 3 L 6 9 C 6 11, -6 11, -6 9 Z"
              fill={isEvening ? '#facc15' : '#d97706'}
            />
            <ellipse cx="0" cy="9.5" rx="5.5" ry="1.5" fill="#b45309" />
            {/* Clapper / Ghungroo ball */}
            <circle cx="0" cy="11" r="1.8" fill={isEvening ? '#fef08a' : '#78350f'} />
          </g>
        </defs>

        <style>{`
          .diwali-toran-cord {
            stroke: #b45309;
            stroke-width: 2.5;
            fill: none;
            stroke-linecap: round;
          }
          .diwali-bell-shimmer {
            animation: toranBellGlow 4s ease-in-out infinite alternate;
          }
          @keyframes toranBellGlow {
            0% { opacity: 0.75; transform: scale(0.96); }
            100% { opacity: 1; transform: scale(1.04); }
          }
          div[data-static="true"] .diwali-bell-shimmer {
            animation: none !important;
          }
          @media (prefers-reduced-motion: reduce) {
            .diwali-bell-shimmer {
              animation: none !important;
            }
          }
        `}</style>

        {/* Straight top header cord */}
        <line x1="0" y1="5" x2="1920" y2="5" stroke="#92400e" strokeWidth="3" />
        <line x1="0" y1="7" x2="1920" y2="7" stroke="#f59e0b" strokeWidth="1" opacity="0.6" />

        {/* 1. Scalloped Golden Jute Cords */}
        {scallops.map((s) => (
          <path
            key={`cord-${s.idx}`}
            d={`M ${s.startX} 6 Q ${s.midX} 35, ${s.endX} 6`}
            className="diwali-toran-cord"
          />
        ))}

        {/* 2. Hanging Mango Leaves (behind the flowers) */}
        {scallops.map((s) =>
          s.leaves.map((l) => (
            <use
              key={l.id}
              href={`#${uid}-mango-leaf`}
              transform={`translate(${l.x}, ${l.y - 2}) rotate(${l.angle})`}
            />
          ))
        )}

        {/* 3. Dense Marigold Blossoms strung along each scallop */}
        {scallops.map((s) =>
          s.flowers.map((f) => (
            <use
              key={f.id}
              href={f.isOrange ? `#${uid}-flower-orange` : `#${uid}-flower-gold`}
              transform={`translate(${f.x}, ${f.y})`}
            />
          ))
        )}

        {/* 4. Junction Anchors: Vertical Tassels & Brass Ghungroos at every scallop peak */}
        {scallops.map((s) => (
          <g key={`anchor-${s.idx}`} transform={`translate(${s.anchorX}, 6)`}>
            {/* Top rosette marigold */}
            <use href={`#${uid}-flower-gold`} transform="scale(1.15)" />
            <circle cx="0" cy="0" r="3" fill="#dc2626" />

            {/* Vertical drop garland string */}
            <line x1="0" y1="8" x2="0" y2="46" stroke="#b45309" strokeWidth="1.6" />
            <use href={`#${uid}-flower-orange`} transform="translate(0, 18) scale(0.85)" />
            <use href={`#${uid}-flower-gold`} transform="translate(0, 32) scale(0.85)" />

            {/* Draped side mango leaf at junction */}
            <use href={`#${uid}-mango-leaf`} transform="translate(-5, 12) rotate(-24) scale(0.8)" />
            <use href={`#${uid}-mango-leaf`} transform="translate(5, 12) rotate(24) scale(0.8)" />

            {/* Shimmering Brass Bell at tassel tip */}
            <g
              transform="translate(0, 46)"
              className={isEvening ? 'diwali-bell-shimmer' : undefined}
            >
              <use href={`#${uid}-brass-bell`} />
            </g>
          </g>
        ))}

        {/* Right edge terminator anchor */}
        <g transform="translate(1920, 6)">
          <use href={`#${uid}-flower-gold`} transform="scale(1.15)" />
          <circle cx="0" cy="0" r="3" fill="#dc2626" />
          <line x1="0" y1="8" x2="0" y2="46" stroke="#b45309" strokeWidth="1.6" />
          <use href={`#${uid}-flower-orange`} transform="translate(0, 18) scale(0.85)" />
          <use href={`#${uid}-flower-gold`} transform="translate(0, 32) scale(0.85)" />
          <g transform="translate(0, 46)" className={isEvening ? 'diwali-bell-shimmer' : undefined}>
            <use href={`#${uid}-brass-bell`} />
          </g>
        </g>
      </svg>
    </div>
  )
})
