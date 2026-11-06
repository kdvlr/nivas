import { useId } from 'react'
import { diwaliTheme, type DiwaliPhase } from '../lib/diwaliTheme'

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

export function DiyaTopper({ seed = 0, phase = 'day' }: { seed?: number; phase?: DiwaliPhase }) {
  const uid = useId()
  const { evening } = diwaliTheme(phase)
  const isBrass = Math.abs(seed) % 2 === 1

  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none"
      data-seasonal-topper="diwali"
      aria-hidden="true"
    >
      <defs>
        {/* Flame Halo Aura Glow */}
        <radialGradient id={`${uid}-flame-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity={evening ? 0.75 : 0.45} />
          <stop offset="35%" stopColor="#f59e0b" stopOpacity={evening ? 0.38 : 0.22} />
          <stop offset="70%" stopColor="#ea580c" stopOpacity={evening ? 0.14 : 0.08} />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>

        {/* Outer Sacred Flame Gradient */}
        <linearGradient id={`${uid}-flame-outer`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="20%" stopColor="#ea580c" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="85%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Inner Flame Core Gradient */}
        <linearGradient id={`${uid}-flame-inner`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fffbeb" />
          <stop offset="80%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>

        {/* Liquid Ghee Pool Gradient */}
        <radialGradient id={`${uid}-ghee-oil`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="85%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>

        {/* Terracotta Earthenware Gradients */}
        <linearGradient id={`${uid}-terracotta-belly`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="15%" stopColor="#ea580c" />
          <stop offset="45%" stopColor="#c2410c" />
          <stop offset="80%" stopColor="#9a3412" />
          <stop offset="100%" stopColor="#5c1d0b" />
        </linearGradient>
        <linearGradient id={`${uid}-terracotta-rim`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="25%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#fef08a" />
          <stop offset="75%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>

        {/* Brass Panchaloha Gradients */}
        <linearGradient id={`${uid}-brass-belly`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="18%" stopColor="#d97706" />
          <stop offset="45%" stopColor="#fef08a" />
          <stop offset="65%" stopColor="#f59e0b" />
          <stop offset="85%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id={`${uid}-brass-rim`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="30%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes diyaFlameSway-${uid} {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(0.96, 1.04) rotate(-1.5deg);
          }
          50% {
            transform: scale(1.03, 0.97) rotate(0.8deg);
          }
          75% {
            transform: scale(0.98, 1.02) rotate(-0.8deg);
          }
        }
        .diya-flame-motion-${uid} {
          transform-origin: 48px 62px;
          animation: diyaFlameSway-${uid} 2.4s ease-in-out infinite;
        }
        @keyframes diyaHaloPulse-${uid} {
          0%, 100% { transform: scale(1); opacity: ${evening ? '0.9' : '0.75'}; }
          50% { transform: scale(1.1); opacity: ${evening ? '1' : '0.9'}; }
        }
        .diya-halo-motion-${uid} {
          transform-origin: 48px 38px;
          animation: diyaHaloPulse-${uid} 3.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .diya-flame-motion-${uid}, .diya-halo-motion-${uid} {
            animation: none !important;
          }
        }
      `}</style>

      {/* 1. Ambient Golden Halo Glow */}
      <circle cx="48" cy="38" r="34" fill={`url(#${uid}-flame-glow)`} className={`diya-halo-motion-${uid}`} />

      {/* 2. Sacred Jyoti Flame (Akhand Deepam) */}
      <g className={`diya-flame-motion-${uid}`}>
        {/* Outer Teardrop Flame */}
        <path
          d="M 48 13 C 38 27, 30 44, 38 56 C 42 62, 54 62, 58 56 C 66 44, 58 27, 48 13 Z"
          fill={`url(#${uid}-flame-outer)`}
        />
        {/* Mid Golden Mantle */}
        <path
          d="M 48 23 C 42 33, 36 44, 41 52 C 44 57, 52 57, 55 52 C 60 44, 54 33, 48 23 Z"
          fill={`url(#${uid}-flame-inner)`}
        />
        {/* Pure White-Hot Core */}
        <path
          d="M 48 33 C 45 39, 42 45, 45 50 C 46 52, 50 52, 51 50 C 54 45, 51 39, 48 33 Z"
          fill="#ffffff"
        />
        {/* Cerulean Blue Combustion Base */}
        <ellipse cx="48" cy="57" rx="5.5" ry="2.4" fill="#0284c7" opacity="0.8" />
        <ellipse cx="48" cy="57.5" rx="3.5" ry="1.5" fill="#38bdf8" opacity="0.95" />

        {/* Cotton Wick (Rui ki Baati) nestled in spout with charred tip */}
        <path d="M 48 64 L 48 55" stroke="#fef3c7" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="48" cy="55" r="1.3" fill="#292524" />
      </g>

      {/* 3. Traditional Diya Body (Terracotta Mitti or Brass Temple Vilakku) */}
      {/* Base Drop Shadow */}
      <ellipse cx="48" cy="98" rx="32" ry="4.5" fill="#020617" opacity={evening ? 0.5 : 0.25} />

      {/* Rear Rim of Oil Reservoir */}
      <ellipse
        cx="48"
        cy="63"
        rx="34"
        ry="7.5"
        fill={isBrass ? '#78350f' : '#5c1d0b'}
        stroke={isBrass ? '#b45309' : '#7c2d12'}
        strokeWidth="1.2"
      />
      {/* Liquid Golden Ghee Pool */}
      <ellipse cx="48" cy="64" rx="30" ry="5.5" fill={`url(#${uid}-ghee-oil)`} />

      {/* Front Diya Bowl with authentic pinched center spout */}
      <path
        d="M 14 63
           C 12 79, 26 94, 43 96
           L 40 102 L 56 102 L 53 96
           C 70 94, 84 79, 82 63
           C 76 69, 64 73, 53 71
           C 51 70, 49 67, 48 64
           C 47 67, 45 70, 43 71
           C 32 73, 20 69, 14 63 Z"
        fill={isBrass ? `url(#${uid}-brass-belly)` : `url(#${uid}-terracotta-belly)`}
        stroke={isBrass ? '#78350f' : '#5c1d0b'}
        strokeWidth="1"
      />

      {/* Pinched Spout Center Accent */}
      <path
        d="M 43 64 C 45 61, 51 61, 53 64 L 51 68 C 49 69, 47 69, 45 68 Z"
        fill={isBrass ? '#fef08a' : '#ea580c'}
        stroke="#fde047"
        strokeWidth="0.8"
      />

      {/* Fluted Rim Band */}
      <path
        d="M 14 63 C 24 70, 34 73, 44 71 L 48 64 L 52 71 C 62 73, 72 70, 82 63"
        fill="none"
        stroke={isBrass ? `url(#${uid}-brass-rim)` : `url(#${uid}-terracotta-rim)`}
        strokeWidth={isBrass ? '3' : '2.6'}
        strokeLinecap="round"
      />

      {/* Decorative Traditional Motifs on Clay / Brass */}
      {!isBrass ? (
        <>
          {/* Stamped Diwali Dots (Chitrakari) along Rim */}
          <g fill="#fef08a">
            <circle cx="20" cy="66.5" r="1.4" />
            <circle cx="27" cy="69" r="1.4" />
            <circle cx="35" cy="70.8" r="1.4" />
            <circle cx="61" cy="70.8" r="1.4" />
            <circle cx="69" cy="69" r="1.4" />
            <circle cx="76" cy="66.5" r="1.4" />
          </g>
          {/* Auspicious Kumkum Dots */}
          <g fill="#dc2626">
            <circle cx="23.5" cy="67.8" r="1.1" />
            <circle cx="31" cy="70" r="1.1" />
            <circle cx="39.5" cy="71.2" r="1.1" />
            <circle cx="56.5" cy="71.2" r="1.1" />
            <circle cx="65" cy="70" r="1.1" />
            <circle cx="72.5" cy="67.8" r="1.1" />
          </g>
          {/* Central Sacred Kumkum Floral Motif on Belly */}
          <g transform="translate(48, 83)">
            <ellipse cx="0" cy="0" rx="3.8" ry="4.2" fill="#991b1b" stroke="#f59e0b" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="1.8" fill="#fde047" />
            <circle cx="0" cy="0" r="0.8" fill="#991b1b" />
            <path d="M -16 -6 C -12 2, -6 6, 0 3" fill="none" stroke="#ea580c" strokeWidth="1.2" opacity="0.85" />
            <path d="M 16 -6 C 12 2, 6 6, 0 3" fill="none" stroke="#ea580c" strokeWidth="1.2" opacity="0.85" />
            <path d="M -22 -10 C -18 -1, -10 6, 0 5" fill="none" stroke="#f59e0b" strokeWidth="0.8" opacity="0.75" />
            <path d="M 22 -10 C 18 -1, 10 6, 0 5" fill="none" stroke="#f59e0b" strokeWidth="0.8" opacity="0.75" />
          </g>
        </>
      ) : (
        <>
          {/* Engraved Brass Beading Dots */}
          <g fill="#ffffff" opacity="0.95">
            <circle cx="20" cy="66.5" r="1.4" />
            <circle cx="27" cy="69" r="1.4" />
            <circle cx="35" cy="70.8" r="1.4" />
            <circle cx="61" cy="70.8" r="1.4" />
            <circle cx="69" cy="69" r="1.4" />
            <circle cx="76" cy="66.5" r="1.4" />
          </g>
          {/* Ornate Brass Filigree Ribs */}
          <g stroke="#92400e" strokeWidth="1.2" fill="none" opacity="0.7">
            <path d="M 28 72 C 32 82, 40 92, 44 96" />
            <path d="M 68 72 C 64 82, 56 92, 52 96" />
            <path d="M 48 74 L 48 96" stroke="#fef08a" strokeWidth="1.4" />
          </g>
        </>
      )}

      {/* Pedestal Stand (Peetham / Base) */}
      <path
        d="M 39 101 L 34 107 L 62 107 L 57 101 Z"
        fill={isBrass ? `url(#${uid}-brass-belly)` : '#5c1d0b'}
        stroke={isBrass ? '#78350f' : '#7c2d12'}
        strokeWidth="0.8"
      />
      <ellipse
        cx="48"
        cy="107"
        rx="14"
        ry="2.2"
        fill={isBrass ? '#f59e0b' : '#7c2d12'}
        stroke={isBrass ? '#78350f' : '#ea580c'}
        strokeWidth="0.8"
      />
      <line x1="33" y1="107" x2="63" y2="107" stroke="#fde047" strokeWidth="1.4" />

      {/* 4. Fresh Marigold Garland (Genda Phool) & Auspicious Mango Leaves (Maavilai) */}
      <g>
        {/* Mango Leaves */}
        <path d="M 34 105 C 22 103, 8 108, 4 114 C 12 117, 25 115, 35 108 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.7" />
        <path d="M 6 113 Q 20 110 34 106" fill="none" stroke="#22c55e" strokeWidth="0.7" opacity="0.7" />

        <path d="M 62 105 C 74 103, 88 108, 92 114 C 84 117, 71 115, 61 108 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.7" />
        <path d="M 90 113 Q 76 110 62 106" fill="none" stroke="#22c55e" strokeWidth="0.7" opacity="0.7" />

        {/* Marigold Blossom Cluster */}
        <g transform="translate(24, 110)">
          <circle r="7" fill="#ea580c" />
          <circle r="5" fill="#f59e0b" />
          <path d="M-5 0H5M0-5V5M-3.5-3.5L3.5 3.5M-3.5 3.5L3.5-3.5" stroke="#fde047" strokeWidth="2.4" strokeLinecap="round" />
          <circle r="2" fill="#b45309" />
        </g>
        <g transform="translate(72, 110)">
          <circle r="7" fill="#ea580c" />
          <circle r="5" fill="#f59e0b" />
          <path d="M-5 0H5M0-5V5M-3.5-3.5L3.5 3.5M-3.5 3.5L3.5-3.5" stroke="#fde047" strokeWidth="2.4" strokeLinecap="round" />
          <circle r="2" fill="#b45309" />
        </g>
        <g transform="translate(36, 112)">
          <circle r="7.5" fill="#c2410c" />
          <circle r="5.5" fill="#ea580c" />
          <path d="M-5 0H5M0-5V5M-3.5-3.5L3.5 3.5M-3.5 3.5L3.5-3.5" stroke="#facc15" strokeWidth="2.6" strokeLinecap="round" />
          <circle r="2.2" fill="#7c2d12" />
        </g>
        <g transform="translate(60, 112)">
          <circle r="7.5" fill="#c2410c" />
          <circle r="5.5" fill="#ea580c" />
          <path d="M-5 0H5M0-5V5M-3.5-3.5L3.5 3.5M-3.5 3.5L3.5-3.5" stroke="#facc15" strokeWidth="2.6" strokeLinecap="round" />
          <circle r="2.2" fill="#7c2d12" />
        </g>
        <g transform="translate(48, 114)">
          <circle r="8.5" fill="#ea580c" />
          <circle r="7" fill="#f59e0b" />
          <circle r="4.5" fill="#fde047" />
          <path d="M-6 0H6M0-6V6M-4.5-4.5L4.5 4.5M-4.5 4.5L4.5-4.5" stroke="#fef08a" strokeWidth="2.8" strokeLinecap="round" />
          <circle r="2.4" fill="#b45309" />
        </g>
      </g>

      {/* 5. Sacred Suspender Cord with Golden Beads, Temple Bell & Frame Anchor */}
      {/* Dangling golden temple bell (Ghanti) beneath center blossom */}
      <g transform="translate(48, 124)">
        <path d="M -4 0 L 4 0 L 5 6 L -5 6 Z" fill="#d97706" stroke="#fef08a" strokeWidth="0.8" />
        <ellipse cx="0" cy="6" rx="5" ry="1.4" fill="#f59e0b" />
        <circle cx="0" cy="8" r="1.5" fill="#fde047" />
      </g>

      {/* Sacred Red & Gold Kalava Thread */}
      <g strokeLinecap="round">
        <path d="M 48 130 C 47 137, 49 143, 48 149" stroke="#dc2626" strokeWidth="2" fill="none" />
        <path d="M 48 130 C 49 137, 47 143, 48 149" stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="2.5 2.5" fill="none" />
      </g>

      {/* Polished Golden Beads & Pearl */}
      <circle cx="48" cy="134" r="2.2" fill="#facc15" stroke="#b45309" strokeWidth="0.6" />
      <circle cx="48" cy="142" r="2.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.6" />

      {/* Frame Anchor Hook / Brass Filigree Rosette Clip */}
      <g transform="translate(48, 149)">
        <rect x="-7" y="-1" width="14" height="4.5" rx="2" fill="#d97706" stroke="#fde047" strokeWidth="0.8" />
        <circle cx="0" cy="1.2" r="2.2" fill="#f59e0b" />
        <circle cx="0" cy="1.2" r="1.1" fill="#dc2626" />
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
