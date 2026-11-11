// Compact cartoon figures for the November visitors. Every figure faces
// RIGHT; callers mirror with scaleX(-1). Limb motion uses the fall-* CSS
// classes defined in FallOverlay (transform-only keyframes).

const OUTLINE = '#2b1a10'

export function Kid({ variant }: { variant: 'girl' | 'boy' }) {
  const jacket = variant === 'girl' ? '#7c3aed' : '#2563eb'
  const pants = variant === 'girl' ? '#1e3a8a' : '#374151'
  const hair = variant === 'girl' ? '#7c2d12' : '#3f2a1d'
  return (
    <svg viewBox="0 0 30 56" width="38" height="70" aria-hidden="true" overflow="visible">
      {/* legs */}
      <g className="fall-leg-a" style={{ transformOrigin: '15px 36px' }}>
        <path d="M14 36L12 50" stroke={pants} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="12.5" cy="52" rx="3.4" ry="1.8" fill="#111827" />
      </g>
      <g className="fall-leg-b" style={{ transformOrigin: '15px 36px' }}>
        <path d="M16 36L18 50" stroke={pants} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="18.5" cy="52" rx="3.4" ry="1.8" fill="#111827" />
      </g>
      {/* body + arms */}
      <path d="M9 22Q15 18 21 22L21 37L9 37Z" fill={jacket} stroke={OUTLINE} strokeWidth="0.6" />
      <g className="fall-leg-b" style={{ transformOrigin: '15px 23px' }}>
        <path d="M11 24L6 32" stroke={jacket} strokeWidth="3.4" strokeLinecap="round" />
      </g>
      <g className="fall-leg-a" style={{ transformOrigin: '15px 23px' }}>
        <path d="M19 24L24 31" stroke={jacket} strokeWidth="3.4" strokeLinecap="round" />
      </g>
      {/* head */}
      <circle cx="15" cy="13" r="7" fill="#f2c9a0" stroke={OUTLINE} strokeWidth="0.6" />
      <circle cx="18" cy="12" r="0.9" fill="#1f2937" />
      <path d="M16.5 15.6Q18 16.8 19.6 15.4" stroke="#7c2d12" strokeWidth="0.7" fill="none" />
      {variant === 'girl' ? (
        <>
          <path d="M8 13Q8 5 15 5Q21 5 22 11Q17 8 10 12Z" fill={hair} />
          <path d="M8.5 10Q2 11 3 18Q6 14 9 14Z" fill={hair} className="fall-ponytail" style={{ transformOrigin: '8.5px 11px' }} />
          <circle cx="9" cy="11" r="1.4" fill="#f472b6" />
        </>
      ) : (
        <>
          <path d="M8 11Q8 4.5 15 4.5Q21.5 4.5 22 10.5Z" fill="#dc2626" stroke={OUTLINE} strokeWidth="0.5" />
          <path d="M20 10.5L27 11.3L21 12Z" fill="#b91c1c" />
        </>
      )}
    </svg>
  )
}

export function Fox() {
  return (
    <svg viewBox="0 0 70 40" width="84" height="48" aria-hidden="true" overflow="visible">
      <path d="M4 22Q-2 30 6 34Q14 36 20 26Z" fill="#ea580c" stroke={OUTLINE} strokeWidth="0.6" className="fall-tail" style={{ transformOrigin: '18px 24px' }} />
      <path d="M2 31Q4 35 8 34L6 30Z" fill="#fff7ed" />
      <g className="fall-leg-a" style={{ transformOrigin: '22px 28px' }}><path d="M22 28L20 38" stroke="#7c2d12" strokeWidth="2.6" strokeLinecap="round" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '44px 28px' }}><path d="M44 28L47 38" stroke="#7c2d12" strokeWidth="2.6" strokeLinecap="round" /></g>
      <path d="M16 22Q30 14 48 20Q52 30 46 31L20 31Q14 28 16 22Z" fill="#f97316" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M24 30Q34 34 44 30" fill="#fff7ed" opacity="0.9" />
      <g className="fall-leg-b" style={{ transformOrigin: '26px 28px' }}><path d="M26 29L27 38" stroke="#7c2d12" strokeWidth="2.6" strokeLinecap="round" /></g>
      <g className="fall-leg-a" style={{ transformOrigin: '42px 28px' }}><path d="M42 29L40 38" stroke="#7c2d12" strokeWidth="2.6" strokeLinecap="round" /></g>
      <path d="M46 20L52 9L55 17L60 11L60 20L68 25Q62 29 54 28Q48 27 46 20Z" fill="#f97316" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M58 24L68 25Q63 29 56 27Z" fill="#fff7ed" />
      <circle cx="67.5" cy="25" r="1.1" fill="#111827" />
      <circle cx="58" cy="19" r="1" fill="#111827" />
    </svg>
  )
}

export function Crow({ flapping }: { flapping: boolean }) {
  return (
    <svg viewBox="0 0 30 22" width="36" height="26" aria-hidden="true" overflow="visible">
      <path d="M3 13L-2 16L4 15Z" fill="#111827" />
      <ellipse cx="13" cy="13" rx="9" ry="5.5" fill="#1f2937" />
      <circle cx="22" cy="9" r="4" fill="#1f2937" />
      <path d="M25.5 8.5L30 10L25.5 11Z" fill="#f59e0b" />
      <circle cx="23" cy="8" r="0.8" fill="#fef3c7" />
      <g className={flapping ? 'fall-flap' : undefined} style={{ transformOrigin: '13px 11px' }}>
        <path d="M8 11Q13 2 19 11Z" fill="#111827" />
      </g>
      <path d="M12 18L11 21M15 18L15 21" stroke="#f59e0b" strokeWidth="0.9" />
    </svg>
  )
}

export function Scarecrow({ turned }: { turned: boolean }) {
  return (
    <svg viewBox="0 0 60 92" width="60" height="92" aria-hidden="true" overflow="visible">
      <path d="M30 34V92" stroke="#6b4423" strokeWidth="3" />
      <path d="M6 40H54" stroke="#6b4423" strokeWidth="2.6" />
      <path d="M4 40l-3 4M4 40l-3 -1M56 40l3 4M56 40l3 -1" stroke="#eab308" strokeWidth="1.2" />
      <path d="M18 36Q30 32 42 36L44 64L16 64Z" fill="#b91c1c" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M16 46H44M16 54H44M24 36V64M36 36V64" stroke="#7f1d1d" strokeWidth="0.6" opacity="0.6" />
      <path d="M22 50h4v4h-4z" fill="#ca8a04" />
      <path d="M18 64L16 70M24 64L23 71M36 64L37 71M42 64L44 70" stroke="#eab308" strokeWidth="1.2" />
      <g style={{ transformOrigin: '30px 30px', transform: turned ? 'rotate(-28deg)' : 'none', transition: 'transform 280ms ease-out' }}>
        <circle cx="30" cy="24" r="9" fill="#e9c88d" stroke={OUTLINE} strokeWidth="0.6" />
        <path d="M25 22l2 2M27 22l-2 2M33 22l2 2M35 22l-2 2" stroke="#3f2a1d" strokeWidth="0.9" />
        <path d="M25 28Q30 31 35 28" stroke="#3f2a1d" strokeWidth="0.8" fill="none" strokeDasharray="1.2 1" />
        <path d="M17 18H43L38 15Q36 6 30 6Q24 6 22 15Z" fill="#a16207" stroke={OUTLINE} strokeWidth="0.6" />
        <path d="M22 15H38" stroke="#7c2d12" strokeWidth="1.6" />
      </g>
    </svg>
  )
}

export function Deer({ fawn = false }: { fawn?: boolean }) {
  const s = fawn ? '#c08457' : '#a16207'
  return (
    <svg viewBox="0 0 50 50" width={fawn ? 40 : 56} height={fawn ? 40 : 56} aria-hidden="true" overflow="visible">
      <g className="fall-leg-a" style={{ transformOrigin: '14px 30px' }}><path d="M14 30L12 48" stroke={s} strokeWidth="2.2" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '34px 30px' }}><path d="M34 30L36 48" stroke={s} strokeWidth="2.2" /></g>
      <path d="M8 24Q24 16 38 22Q40 32 34 33L13 33Q6 30 8 24Z" fill={s} stroke={OUTLINE} strokeWidth="0.5" />
      <path d="M8 23Q5 21 6 26Z" fill="#fefce8" />
      {fawn && <g fill="#fef3c7" opacity="0.9"><circle cx="18" cy="24" r="1" /><circle cx="24" cy="22.5" r="1" /><circle cx="29" cy="24" r="1" /><circle cx="22" cy="27" r="0.9" /></g>}
      <g className="fall-leg-b" style={{ transformOrigin: '17px 31px' }}><path d="M17 31L18 48" stroke={s} strokeWidth="2.2" /></g>
      <g className="fall-leg-a" style={{ transformOrigin: '32px 31px' }}><path d="M32 31L30 48" stroke={s} strokeWidth="2.2" /></g>
      <g className="fall-graze" style={{ transformOrigin: '37px 23px' }}>
        <path d="M35 24L40 10L44 11L41 24Z" fill={s} />
        <path d="M39 8Q44 4 49 9L46 13L40 12Z" fill={s} stroke={OUTLINE} strokeWidth="0.5" />
        <path d="M40 8L37 4L41 6Z" fill={s} />
        <circle cx="45" cy="9" r="0.8" fill="#111827" />
        <circle cx="49" cy="10" r="0.9" fill="#111827" />
      </g>
    </svg>
  )
}

export function Raccoon({ withPie }: { withPie: boolean }) {
  return (
    <svg viewBox="0 0 54 40" width="66" height="49" aria-hidden="true" overflow="visible">
      <path d="M8 24Q-2 22 0 30Q4 34 12 30Z" fill="#6b7280" stroke={OUTLINE} strokeWidth="0.5" />
      <path d="M2 24.5L3.5 31M5.5 24L6.5 31.5" stroke="#1f2937" strokeWidth="1.6" />
      <g className="fall-leg-a" style={{ transformOrigin: '16px 30px' }}><path d="M16 30L14 39" stroke="#374151" strokeWidth="3" strokeLinecap="round" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '34px 30px' }}><path d="M34 30L36 39" stroke="#374151" strokeWidth="3" strokeLinecap="round" /></g>
      <path d="M10 26Q22 16 38 20Q42 30 36 33L14 33Q8 31 10 26Z" fill="#9ca3af" stroke={OUTLINE} strokeWidth="0.5" />
      <path d="M38 20Q42 12 48 16Q54 20 52 24Q46 27 40 26Z" fill="#9ca3af" stroke={OUTLINE} strokeWidth="0.5" />
      <path d="M41 15L42 10L45 14Z" fill="#6b7280" />
      <path d="M41 19Q46 17 51 20L50 22Q46 20 42 22Z" fill="#111827" />
      <circle cx="47" cy="20" r="0.9" fill="#f9fafb" />
      <circle cx="52.6" cy="23" r="1" fill="#111827" />
      {withPie && (
        <g transform="translate(40 26)">
          <ellipse cx="6" cy="2" rx="8" ry="2.4" fill="#d97706" stroke="#7c2d12" strokeWidth="0.5" />
          <ellipse cx="6" cy="1.3" rx="6.5" ry="1.6" fill="#c2410c" />
        </g>
      )}
    </svg>
  )
}

export function TurkeyFigure({ disguise = false }: { disguise?: boolean }) {
  return (
    <svg viewBox="0 0 60 62" width="66" height="68" aria-hidden="true" overflow="visible">
      {/* fan */}
      {['#b45309', '#dc2626', '#f59e0b', '#ea580c', '#92400e', '#dc2626', '#f59e0b'].map((c, i) => (
        <ellipse key={i} cx="18" cy="18" rx="5" ry="16" fill={c} stroke={OUTLINE} strokeWidth="0.4" transform={`rotate(${-60 + i * 20} 22 34)`} />
      ))}
      <g className="fall-leg-a" style={{ transformOrigin: '26px 46px' }}><path d="M26 46L24 58M24 58l-3 2M24 58l2 2" stroke="#f59e0b" strokeWidth="1.8" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '32px 46px' }}><path d="M32 46L34 58M34 58l-2 2M34 58l3 2" stroke="#f59e0b" strokeWidth="1.8" /></g>
      <ellipse cx="29" cy="38" rx="13" ry="11" fill="#78350f" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M38 34Q44 20 44 14" stroke="#78350f" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="13" r="6" fill="#92400e" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M49 12L55 14L49 16Z" fill="#f59e0b" />
      <path d="M48 16Q50 22 47 24Q45 20 47 16Z" fill="#dc2626" />
      <circle cx="46" cy="11" r="1.1" fill="#111827" />
      {disguise && (
        <g>
          <circle cx="45.5" cy="11" r="2.6" fill="none" stroke="#111827" strokeWidth="1" />
          <path d="M42.9 11H40" stroke="#111827" strokeWidth="0.9" />
          <path d="M44 7.5Q46 6.4 48 7.6" stroke="#111827" strokeWidth="1.4" fill="none" />
          <path d="M48 15Q51 14 53 16" stroke="#111827" strokeWidth="1.4" fill="none" />
          <g transform="translate(16 28) rotate(-6)">
            <path d="M9 0V10" stroke="#a16207" strokeWidth="1.2" />
            <rect x="0" y="-9" width="22" height="10" rx="1" fill="#fef3c7" stroke="#a16207" strokeWidth="0.8" />
            <text x="11" y="-1.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#7c2d12" fontFamily="system-ui, sans-serif">MOO</text>
          </g>
        </g>
      )}
    </svg>
  )
}

export function Cook() {
  return (
    <svg viewBox="0 0 36 66" width="40" height="73" aria-hidden="true" overflow="visible">
      <g className="fall-leg-a" style={{ transformOrigin: '15px 44px' }}><path d="M15 44L14 62" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '21px 44px' }}><path d="M21 44L23 62" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" /></g>
      <path d="M8 26Q18 21 28 26L28 46L8 46Z" fill="#f8fafc" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M12 30L24 30L24 46L12 46Z" fill="#fca5a5" opacity="0.6" />
      <path d="M26 30L33 36" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
      {/* roasting pan */}
      <path d="M26 36H38L36 41H28Z" fill="#6b7280" stroke={OUTLINE} strokeWidth="0.5" />
      <circle cx="18" cy="16" r="7" fill="#f2c9a0" stroke={OUTLINE} strokeWidth="0.6" />
      <circle cx="21" cy="15" r="0.9" fill="#111827" />
      <path d="M17 19.5Q20 18.5 23 19.5" stroke="#3f2a1d" strokeWidth="1.3" fill="none" />
      <path d="M11 10Q9 2 14 3Q16 -1 20 2Q25 0 25 5Q28 8 25 10Z" fill="#ffffff" stroke={OUTLINE} strokeWidth="0.6" />
    </svg>
  )
}

export function Squirrel() {
  return (
    <svg viewBox="0 0 42 34" width="50" height="40" aria-hidden="true" overflow="visible">
      <path d="M12 24Q0 26 2 12Q4 2 12 6Q8 12 14 18Z" fill="#a0522d" stroke={OUTLINE} strokeWidth="0.5" className="fall-tail" style={{ transformOrigin: '12px 22px' }} />
      <g className="fall-leg-a" style={{ transformOrigin: '16px 26px' }}><path d="M16 26L14 32" stroke="#7c2d12" strokeWidth="2.4" strokeLinecap="round" /></g>
      <g className="fall-leg-b" style={{ transformOrigin: '28px 26px' }}><path d="M28 26L30 32" stroke="#7c2d12" strokeWidth="2.4" strokeLinecap="round" /></g>
      <ellipse cx="22" cy="23" rx="10" ry="6.5" fill="#b4693a" stroke={OUTLINE} strokeWidth="0.5" />
      <circle cx="32" cy="16" r="5.5" fill="#b4693a" stroke={OUTLINE} strokeWidth="0.5" />
      <path d="M30 11L31 7L33 11Z" fill="#b4693a" />
      <circle cx="34" cy="15" r="1" fill="#111827" />
      <circle cx="37.4" cy="17" r="0.8" fill="#3f2a1d" />
    </svg>
  )
}

export function Acorn({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 14 18" width={size} height={size * 1.28} aria-hidden="true">
      <path d="M2 7Q2 16 7 17Q12 16 12 7Z" fill="#b45309" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M1 7Q1 3 7 3Q13 3 13 7Z" fill="#78350f" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M7 3V0.8" stroke="#3f2a1d" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 9Q4 13 6 15" stroke="#fde68a" strokeWidth="0.8" opacity="0.6" fill="none" />
    </svg>
  )
}

export function Football() {
  return (
    <svg viewBox="0 0 26 14" width="30" height="16" aria-hidden="true">
      <ellipse cx="13" cy="7" rx="12" ry="6.2" fill="#7c2d12" stroke={OUTLINE} strokeWidth="0.6" />
      <path d="M8 7H18M10 5.5V8.5M12 5.5V8.5M14 5.5V8.5M16 5.5V8.5" stroke="#fef3c7" strokeWidth="0.8" />
    </svg>
  )
}

export function MiniTurkey() {
  return (
    <svg viewBox="0 0 30 24" width="40" height="32" aria-hidden="true" overflow="visible">
      {['#dc2626', '#f59e0b', '#ea580c', '#b45309', '#f59e0b'].map((c, i) => (
        <ellipse key={i} cx="15" cy="8" rx="3.2" ry="8" fill={c} transform={`rotate(${-50 + i * 25} 15 18)`} />
      ))}
      <ellipse cx="15" cy="18" rx="7" ry="6" fill="#78350f" />
      <circle cx="15" cy="12" r="4" fill="#92400e" />
      <circle cx="13.6" cy="11.4" r="0.9" fill="#111827" />
      <circle cx="16.4" cy="11.4" r="0.9" fill="#111827" />
      <path d="M14 13.4L15 15.4L16 13.4Z" fill="#f59e0b" />
      <path d="M15.6 14Q17 17 15.4 18" stroke="#dc2626" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

const LEAF_PATH = 'M0 -6C3 -4 4 0 0 6C-4 0 -3 -4 0 -6Z'
export function LeafSvg({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg viewBox="-6 -7 12 14" width={size} height={size} aria-hidden="true">
      <path d={LEAF_PATH} fill={color} />
      <path d="M0 -5V6" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
    </svg>
  )
}

export const FALL_LEAF_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#b45309', '#c2410c', '#eab308', '#9a3412']
