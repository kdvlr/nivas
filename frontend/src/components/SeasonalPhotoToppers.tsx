import { useId } from 'react'

// Static SVGs share the photo attachment geometry; no filters or animation loops.
export function AutumnLeafTopper({ seed = 0 }: { seed?: number }) {
  const flip = seed % 2 === 0
  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none" data-seasonal-topper="autumn"
      aria-hidden="true"
    >
      <g transform={flip ? 'translate(96, 0) scale(-1, 1)' : undefined}>
        {/* Amber Birch Leaf (Background tilted right) */}
        <g transform="translate(56, 52) rotate(28)">
          <path
            d="M 0 0 C 12 -12, 18 -26, 0 -38 C -18 -26, -12 -12, 0 0 Z"
            fill="#d97706"
          />
          <path d="M 0 0 L 0 -34" stroke="#92400e" strokeWidth="0.8" fill="none" />
        </g>

        {/* Golden Oak Leaf (Background tilted left) */}
        <g transform="translate(38, 54) rotate(-32)">
          <path
            d="M 0 0 C -10 -8, -14 -16, -6 -20 C -15 -25, -12 -34, -2 -38 C -8 -44, 2 -50, 0 -52 C -2 -50, 8 -44, 2 -38 C 12 -34, 15 -25, 6 -20 C 14 -16, 10 -8, 0 0 Z"
            fill="#eab308"
          />
          <path d="M 0 0 L 0 -48" stroke="#ca8a04" strokeWidth="1" fill="none" />
        </g>

        {/* Crimson Sugar Maple Leaf (Foreground Center) */}
        <g transform="translate(48, 56) rotate(-4)">
          <path
            d="M 0 0 L 0 -8 
               L -10 -4 L -18 -8 L -12 -14 
               L -22 -22 L -10 -22 
               L 0 -36 
               L 10 -22 L 22 -22 
               L 12 -14 L 18 -8 L 10 -4 
               L 0 -8 Z"
            fill="#dc2626"
          />
          {/* Maple veins */}
          <path d="M 0 0 L 0 -32 M 0 -12 L -15 -19 M 0 -12 L 15 -19" stroke="#991b1b" strokeWidth="1.2" fill="none" />
        </g>

        {/* Acorn clustered in front */}
        <g transform="translate(48, 62)">
          {/* Nut */}
          <path
            d="M -7 4 C -7 14, 7 14, 7 4 Z"
            fill="#78350f"
          />
          {/* Nut highlight */}
          <ellipse cx="-2.5" cy="7" rx="1.5" ry="3" fill="#92400e" opacity="0.6" />
          {/* Textured Cupule Cap */}
          <ellipse cx="0" cy="3" rx="8" ry="4" fill="#451a03" />
          <path d="M -6 3 Q 0 1 6 3 M -5 4 Q 0 2 5 4" stroke="#5c2607" strokeWidth="0.8" fill="none" />
          {/* Stem */}
          <path d="M 0 0 Q -2 -5 -4 -7" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>

        {/* Rustic Twine Bow */}
        <g transform="translate(48, 60)">
          <path d="M 0 0 C -12 -6, -14 4, 0 2 Z" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 0 C 12 -6, 14 4, 0 2 Z" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="1" r="2.2" fill="#b45309" />
          {/* Bow tails */}
          <path d="M -2 2 Q -8 10 -10 16" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 2 2 Q 8 10 11 15" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>

        {/* Tether Knot & Rustic Twine lifting photo */}
        <ellipse cx="48" cy="88" rx="3.5" ry="2.2" fill="#92400e" />
        <path
          d="M 48 88 C 43 108 53 128 48 153"
          stroke="#ca8a04"
          strokeWidth="1.8"
          strokeDasharray="4 2"
          fill="none"
        />
      </g>
    </svg>
  )
}

export function DiyaTopper({ seed = 0 }: { seed?: number }) {
  const diyaGradId = useId()
  const flameGradId = useId()

  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none" data-seasonal-topper="diwali"
      aria-hidden="true"
    >
      {/* Soft warm flame aura glow (clean SVG vector, zero blur filter overhead) */}
      <circle cx="48" cy="50" r="38" fill="rgba(251, 191, 36, 0.22)" />
      <defs>
        <linearGradient id={diyaGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="60%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <radialGradient id={flameGradId} cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="65%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>



      {/* Static ambient glow halo */}
      <circle cx="48" cy="38" r="24" fill="rgba(251, 191, 36, 0.25)" />

      {/* Still Teardrop Flame */}
      <g>
        {/* Outer flame */}
        <path
          d="M 48 20 C 42 30, 40 42, 48 46 C 56 42, 54 30, 48 20 Z"
          fill={`url(#${flameGradId})`}
        />
        {/* Inner white flame core */}
        <ellipse cx="48" cy="40" rx="3.5" ry="5.5" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Cotton wick */}
      <path d="M 48 46 L 48 50" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />

      {/* Ornate Terracotta Diya Bowl */}
      <g>
        {/* Base shadow / foot */}
        <ellipse cx="48" cy="74" rx="14" ry="4" fill="#5c1d06" />

        {/* Diya Clay Body */}
        <path
          d="M 22 56 
             C 22 72, 34 76, 48 76 
             C 62 76, 74 72, 74 56 
             C 74 54, 70 52, 65 52 
             C 56 52, 52 48, 48 48 
             C 44 48, 40 52, 31 52 
             C 26 52, 22 54, 22 56 Z"
          fill={`url(#${diyaGradId})`}
        />

        {/* Diya Rim Beading / Gold Filigree */}
        <path
          d="M 23 54 Q 48 58 73 54"
          stroke="#facc15"
          strokeWidth="1.8"
          strokeDasharray="2.5 2.5"
          fill="none"
        />

        {/* Decorative floral carving on bowl */}
        <path
          d="M 38 64 Q 48 70 58 64 M 44 67 Q 48 71 52 67"
          stroke="#fbbf24"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="48" cy="62" r="2" fill="#facc15" />
      </g>

      {/* Marigolds distinguish the festival topper without animated particles. */}
      <g transform={seed % 2 === 0 ? 'translate(96 0) scale(-1 1)' : undefined}>
        {[{x: 22, y: 74}, {x: 32, y: 80}, {x: 43, y: 82}].map(({x, y}) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <circle r="5.5" fill="#ea580c" />
            <path d="M-4 0H4M0-4V4M-3-3L3 3M-3 3L3-3" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <circle r="1.8" fill="#b45309" />
          </g>
        ))}
      </g>

      {/* Golden Bead Tether Suspender lifting photo */}
      <ellipse cx="48" cy="78" rx="3.5" ry="2" fill="#ca8a04" />
      <g stroke="#facc15" strokeWidth="1.6" fill="none">
        <path d="M 48 79 C 45 98 52 118 48 153" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3 3" />
        <circle cx="48" cy="85" r="1.6" fill="#facc15" />
        <circle cx="47" cy="102" r="1.6" fill="#facc15" />
        <circle cx="49" cy="120" r="1.6" fill="#facc15" />
        <circle cx="48" cy="138" r="1.6" fill="#facc15" />
      </g>
    </svg>
  )
}

// Matching dimensions and tether endpoints keep all three above the photo.
export function ThanksgivingTopper({ seed = 0 }: { seed?: number }) {
  return (
    <svg width="112" height="181" viewBox="0 0 96 155"
      className="pointer-events-none" data-seasonal-topper="thanksgiving" aria-hidden="true">
      <g transform={seed % 2 === 0 ? 'translate(96 0) scale(-1 1)' : undefined}>
        {/* Wheat, squash and apples: a still harvest arrangement. */}
        <g stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" fill="#fbbf24">
          <path d="M24 60L18 18M28 60L29 14" fill="none" />
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <ellipse cx={15 + i} cy={22 + i * 7} rx="2.5" ry="4" transform={`rotate(-32 ${15 + i} ${22 + i * 7})`} />
              <ellipse cx={21 + i} cy={25 + i * 7} rx="2.5" ry="4" transform={`rotate(32 ${21 + i} ${25 + i * 7})`} />
              <ellipse cx="26" cy={20 + i * 7} rx="2.5" ry="4" />
              <ellipse cx="32" cy={23 + i * 7} rx="2.5" ry="4" />
            </g>
          ))}
        </g>
        <path d="M26 58C24 22 73 22 72 58" fill="none" stroke="#78350f" strokeWidth="4" />
        <path d="M26 58C24 22 73 22 72 58" fill="none" stroke="#d97706" strokeWidth="1" />
        <g transform="translate(51 49)">
          <ellipse cx="-7" cy="0" rx="10" ry="13" fill="#c2410c" />
          <ellipse cx="7" cy="0" rx="10" ry="13" fill="#ea580c" />
          <ellipse cy="0" rx="8" ry="14" fill="#f97316" />
          <path d="M0-13Q-3-20 2-22" fill="none" stroke="#4d7c0f" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M24 49C13 44 13 63 25 64C36 65 37 45 27 49Z" fill="#991b1b" />
        <path d="M25 49L24 43" stroke="#451a03" strokeWidth="2" />
        <path d="M25 45Q34 37 36 44Q31 48 25 45" fill="#65752b" />
        <path d="M72 43C83 40 85 54 76 59C65 58 63 49 72 43Z" fill="#ca8a04" />
        <path d="M73 44L74 39" stroke="#451a03" strokeWidth="2" />
        <path d="M14 59H83L75 85Q48 93 22 85Z" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
        <path d="M19 68H79M21 77H77M32 62L35 87M48 62V88M64 62L61 87"
          fill="none" stroke="#d97706" strokeWidth="2" />
        <path d="M14 59H83" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
        {/* Cream linen bow, without text that would be tiny on the tablet. */}
        <path d="M48 76C28 62 29 84 46 79M48 76C68 62 67 84 50 79" fill="#fef3c7" stroke="#d6b67b" />
        <path d="M46 79L41 92L47 89L50 93L51 79" fill="#fef3c7" />
        <circle cx="48" cy="77" r="3" fill="#d6b67b" />
      </g>
      <path d="M48 94C44 112 52 132 48 153" fill="none" stroke="#b45309" strokeWidth="1.8" strokeDasharray="4 2" />
    </svg>
  )
}
