// December rotating storybook holiday photo toppers (same 96x155 twine-hung frame as FallToppers).

function HolidayTwine() {
  return (
    <>
      <ellipse cx="48" cy="88" rx="3.5" ry="2.2" fill="#b91c1c" />
      <path d="M 48 88 C 43 108 53 128 48 153" stroke="#d4af37" strokeWidth="1.8" strokeDasharray="4 2" fill="none" />
    </>
  )
}

function TopperSvg({ flip, kind, children }: { flip: boolean; kind: string; children: React.ReactNode }) {
  return (
    <svg width="112" height="181" viewBox="0 0 96 155" className="pointer-events-none" data-seasonal-topper={kind} aria-hidden="true">
      <g transform={flip ? 'translate(96, 0) scale(-1, 1)' : undefined}>{children}</g>
    </svg>
  )
}

export function HollyBowTopper({ seed = 0 }: { seed?: number }) {
  return (
    <TopperSvg flip={seed % 2 === 1} kind="holly-bow">
      {/* Left & right glossy holly leaves */}
      <path d="M 48 70 C 32 64 20 50 18 38 C 28 40 34 36 38 30 C 42 42 46 54 48 70 Z" fill="#15803d" stroke="#14532d" strokeWidth="1.2" />
      <path d="M 48 70 C 64 64 76 50 78 38 C 68 40 62 36 58 30 C 54 42 50 54 48 70 Z" fill="#166534" stroke="#14532d" strokeWidth="1.2" />
      <path d="M 48 70 L 26 44 M 48 70 L 70 44" stroke="#4ade80" strokeWidth="1" opacity="0.55" />
      {/* Crimson velvet bow */}
      <path d="M 48 72 C 34 62 24 72 30 82 C 36 88 44 80 48 74 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.1" />
      <path d="M 48 72 C 62 62 72 72 66 82 C 60 88 52 80 48 74 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.1" />
      <path d="M 44 76 L 34 94 L 41 91 L 46 78 Z" fill="#b91c1c" />
      <path d="M 52 76 L 62 94 L 55 91 L 50 78 Z" fill="#b91c1c" />
      {/* Holly berries */}
      <circle cx="48" cy="68" r="4.5" fill="#ef4444" />
      <circle cx="43" cy="73" r="4.2" fill="#dc2626" />
      <circle cx="53" cy="73" r="4.2" fill="#b91c1c" />
      <circle cx="46.5" cy="66.5" r="1.3" fill="#fecaca" />
      <HolidayTwine />
    </TopperSvg>
  )
}

export function GingerbreadTopper({ seed = 0 }: { seed?: number }) {
  return (
    <TopperSvg flip={seed % 2 === 0} kind="gingerbread">
      {/* Head & body */}
      <circle cx="48" cy="38" r="13" fill="#b45309" stroke="#78350f" strokeWidth="1.4" />
      <rect x="37" y="49" width="22" height="27" rx="9" fill="#b45309" stroke="#78350f" strokeWidth="1.4" />
      {/* Arms & legs */}
      <rect x="23" y="51" width="18" height="9" rx="4.5" transform="rotate(-14 32 55)" fill="#b45309" stroke="#78350f" strokeWidth="1.3" />
      <rect x="55" y="51" width="18" height="9" rx="4.5" transform="rotate(14 64 55)" fill="#b45309" stroke="#78350f" strokeWidth="1.3" />
      <rect x="37" y="70" width="9" height="16" rx="4.5" transform="rotate(8 41 78)" fill="#b45309" stroke="#78350f" strokeWidth="1.3" />
      <rect x="50" y="70" width="9" height="16" rx="4.5" transform="rotate(-8 54 78)" fill="#b45309" stroke="#78350f" strokeWidth="1.3" />
      {/* Icing details & gumdrop buttons */}
      <circle cx="43.5" cy="36" r="1.8" fill="#fef3c7" />
      <circle cx="52.5" cy="36" r="1.8" fill="#fef3c7" />
      <path d="M 43 42 Q 48 47 53 42" stroke="#fef3c7" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 27 56 Q 30 53 33 56 M 63 56 Q 66 53 69 56" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="57" r="2.7" fill="#ef4444" />
      <circle cx="48" cy="66" r="2.7" fill="#22c55e" />
      <HolidayTwine />
    </TopperSvg>
  )
}

export function JingleBellTopper({ seed = 0 }: { seed?: number }) {
  return (
    <TopperSvg flip={seed % 2 === 1} kind="jingle-bell">
      {/* Pine sprig behind bell */}
      <path d="M 24 44 L 72 44" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" />
      {[-18, -10, -2, 6, 14].map((dx, i) => (
        <path key={i} d={`M ${48 + dx} 44 L ${45 + dx} 35 M ${48 + dx} 44 L ${51 + dx} 53`} stroke={i % 2 ? '#16a34a' : '#166534'} strokeWidth="1.6" strokeLinecap="round" />
      ))}
      {/* Burnished gold sleigh bell */}
      <circle cx="48" cy="64" r="18" fill="#eab308" stroke="#854d0e" strokeWidth="1.5" />
      <path d="M 34 56 A 14 14 0 0 1 58 50" stroke="#fef08a" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M 30 65 L 66 65" stroke="#a16207" strokeWidth="2.2" />
      <path d="M 41 72 L 55 72" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="41" cy="72" r="2.6" fill="#451a03" />
      <circle cx="55" cy="72" r="2.6" fill="#451a03" />
      {/* Red ribbon knot */}
      <circle cx="48" cy="44" r="4.5" fill="#dc2626" />
      <HolidayTwine />
    </TopperSvg>
  )
}

export function SnowflakeWreathTopper({ seed = 0 }: { seed?: number }) {
  return (
    <TopperSvg flip={seed % 2 === 0} kind="snowflake-wreath">
      {/* Frosted evergreen wreath */}
      <circle cx="48" cy="58" r="20" fill="none" stroke="#166534" strokeWidth="7" />
      <circle cx="48" cy="58" r="20" fill="none" stroke="#4ade80" strokeWidth="2" strokeDasharray="5 7" opacity="0.7" />
      {/* Crystal snowflake center */}
      <g stroke="#e0f2fe" strokeWidth="2.1" strokeLinecap="round">
        <path d="M 48 44 L 48 72 M 36 51 L 60 65 M 60 51 L 36 65" />
        <path d="M 44 47 L 48 51 L 52 47 M 44 69 L 48 65 L 52 69" fill="none" strokeWidth="1.4" />
      </g>
      <circle cx="48" cy="58" r="3" fill="#ffffff" />
      {/* Red berries around wreath */}
      <circle cx="34" cy="46" r="2.5" fill="#ef4444" />
      <circle cx="62" cy="46" r="2.5" fill="#ef4444" />
      <circle cx="48" cy="78" r="3" fill="#dc2626" />
      <HolidayTwine />
    </TopperSvg>
  )
}

/** Storybook evergreen-and-gold ribbon for prints taken during a past Christmas. */
export function ChristmasRibbon({ year }: { year: number }) {
  return (
    <div
      className="absolute -left-3.5 bottom-14 z-20 pointer-events-none select-none"
      style={{ transform: 'rotate(-3.2deg)' }}
    >
      <div
        className="relative pl-3.5 pr-5 py-1 text-[#fef9e7] shadow-lg border-y border-l border-amber-300/50"
        style={{
          background: 'linear-gradient(180deg, #166534 0%, #14532d 100%)',
          fontFamily: "'Caveat', cursive",
          fontSize: '1.7rem',
          lineHeight: 1.1,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%)',
        }}
      >
        🎄 Christmas {year}
      </div>
    </div>
  )
}
