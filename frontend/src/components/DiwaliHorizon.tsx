import { memo, useId } from 'react'
import { diwaliTheme, type DiwaliPhase } from '../lib/diwaliTheme'
import type { Quality } from './sky/useQuality'

// All architectural detail is static. Only three small flame groups animate
// on medium/high quality, including Android tablets. No geometry or blur animates.
export const DiwaliHorizon = memo(function DiwaliHorizon({ phase, quality, paused }: {
  phase: DiwaliPhase; quality: Quality; paused: boolean
}) {
  const t = diwaliTheme(phase)
  const uid = useId()
  const glow = `${uid}-glow`
  const arch = `${uid}-arch`
  const petal = `${uid}-petal`
  const animate = quality !== 'low' && !paused
  return (
    <div className="diwali-horizon absolute bottom-0 inset-x-0 pointer-events-none select-none z-[25]"
      style={{ height: 'clamp(110px, 19vh, 200px)' }} data-animate={animate} aria-hidden="true">
      <style>{`
        .diwali-horizon .diwali-flames { opacity: .9; }
        .diwali-horizon[data-animate="true"] .diwali-flames { animation: diwali-breathe 5s ease-in-out infinite; }
        .diwali-horizon[data-animate="true"] .diwali-flames:nth-of-type(even) { animation-delay: -2.4s; }
        @keyframes diwali-breathe { 0%,100% { opacity: .78; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .diwali-horizon .diwali-flames { animation: none !important; } }
      `}</style>
      {/* Architectural wings frame the photo rather than competing with it.
          Separate SVG viewports preserve proportions on portrait screens. */}
      {[false, true].map(right => (
        <svg key={String(right)} viewBox="0 0 420 190" preserveAspectRatio={right ? 'xMaxYMax meet' : 'xMinYMax meet'}
          className="absolute" style={{ width: 'min(32vw, 440px)', height: '100%', bottom: 39,
            ...(right ? { right: 0 } : { left: 0 }) }}>
          <defs>
            <radialGradient id={`${glow}-${right}`}><stop stopColor="#ffd28a" stopOpacity={t.evening ? '.3' : '.06'} /><stop offset="1" stopColor="#ffd28a" stopOpacity="0" /></radialGradient>
            <g id={`${arch}-${right}`}>
              <path d="M-9 0V-19Q-9-28 0-33Q9-28 9-19V0Z" fill={t.recess} />
              <path d="M-11 0V-19Q-11-30 0-36Q11-30 11-19V0" fill="none" stroke={t.line} strokeWidth="1" />
              <path d="M-5-3V-17M0-3V-21M5-3V-17" stroke={t.gold} strokeWidth=".7" opacity=".5" />
            </g>
          </defs>
          <g transform={right ? 'translate(420 0) scale(-1 1)' : undefined}>
            {/* Far pavilion, then the warmer foreground facade. */}
            <path d="M0 190V94H310V135H420V190Z" fill={t.recess} opacity=".5" />
            <path d="M18 137V87H68V137M12 87Q43 37 74 87Z" fill={t.stone} opacity=".65" />
            <path d="M39 55Q43 44 47 55Z" fill={t.gold} /><ellipse cx="43" cy="55" rx="4" ry="2" fill={t.gold} />
            <path d="M0 190V132H240V148H420V190Z" fill={t.stone} />
            {/* Shikhara with carved tiers and a small kalash. */}
            <path d="M92 137C95 94 105 55 132 20C159 55 169 94 172 137Z" fill={t.stoneLight} />
            <path d="M108 126Q116 64 132 28Q148 64 156 126M120 129Q126 68 132 30Q138 68 144 129" fill="none" stroke={t.stone} strokeWidth="2" />
            {[54, 70, 86, 102, 118].map((y, i) => <path key={y} d={`M${117 - i * 5} ${y}H${147 + i * 5}`} stroke={t.line} strokeWidth="1.5" />)}
            <ellipse cx="132" cy="24" rx="12" ry="3" fill={t.gold} /><path d="M127 20Q126 13 132 11Q138 13 137 20Z" fill={t.gold} /><path d="M132 12V5" stroke={t.gold} strokeWidth="1.5" /><circle cx="132" cy="4" r="2" fill={t.gold} />
            {/* Domed chhatri with scalloped openings. */}
            <path d="M210 137V102H286V137" fill={t.stoneLight} />
            <path d="M204 102Q210 76 248 66Q286 76 292 102Z" fill={t.stone} stroke={t.line} />
            <path d="M248 66V55" stroke={t.gold} strokeWidth="2" /><circle cx="248" cy="54" r="2.5" fill={t.gold} />
            <path d="M204 104H292M202 137H294" stroke={t.gold} strokeWidth="2" />
            {[224, 248, 272].map(x => <use key={x} href={`#${arch}-${right}`} transform={`translate(${x} 136) scale(.62)`} />)}
            {/* Recessed entry and repeating jali windows. */}
            <path d="M78 190V134H187V190" fill={t.stoneLight} />
            {[35, 70, 132, 200, 238, 276, 318, 356, 394].map(x => <use key={x} href={`#${arch}-${right}`} transform={`translate(${x} 183)`} />)}
            <path d="M0 142H420M0 188H420" stroke={t.line} strokeWidth="2" />
            {/* Marigold toran follows the building, not the photo area. */}
            <path d="M8 143Q54 165 100 143T192 143T284 143T376 143" fill="none" stroke="#56684a" strokeWidth="2" />
            {Array.from({ length: 25 }, (_, i) => {
              const x = 8 + i * 15
              return <circle key={i} cx={x} cy={143 + Math.abs(Math.sin((x - 8) / 92 * Math.PI)) * 11} r="2.8" fill={i % 2 ? '#e6a447' : '#c66932'} />
            })}
            {t.evening && <ellipse cx="132" cy="166" rx="46" ry="45" fill={`url(#${glow}-${right})`} />}
          </g>
        </svg>
      ))}
      {/* Shallow stone steps and still water. Broad shapes remain cheap to paint. */}
      <svg viewBox="0 0 1920 70" preserveAspectRatio="none" className="absolute bottom-0 w-full h-[70px]">
        <path d="M0 0H540L630 12H1290L1380 0H1920V70H0Z" fill={t.steps} />
        <path d="M0 12H490L610 27H1310L1430 12H1920M0 27H455L585 42H1335L1465 27H1920" fill="none" stroke={t.line} strokeOpacity=".35" />
        <path d="M0 47Q480 38 960 49T1920 47V70H0Z" fill={t.water} />
        {[110, 280, 465, 1455, 1640, 1810].map(x => <g key={x} stroke={t.evening ? '#d9a368' : '#d5c7a1'} opacity={t.evening ? '.5' : '.25'} strokeLinecap="round">
          <path d={`M${x - 9} 52h18m-22 5h26m-19 5h12`} strokeWidth="1.5" />
        </g>)}
      </svg>
      {/* Rangoli is a floor ornament: deliberately shallow, with open center above. */}
      <svg viewBox="-80 -80 160 160" preserveAspectRatio="none" className="absolute left-1/2 -translate-x-1/2 bottom-[26px]"
        style={{ width: 'clamp(100px, 18vw, 200px)', height: 58 }}>
        <defs><path id={petal} d="M0-12C-21-30-12-53 0-65C12-53 21-30 0-12Z" /></defs>
        <circle r="75" fill={t.evening ? '#302039' : '#ad7259'} />
        <circle r="72" fill="none" stroke="#f0cf9c" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, i) => <use key={i} href={`#${petal}`} transform={`rotate(${i * 30})`} fill={i % 2 ? '#c17a45' : '#9b5362'} stroke="#edc791" strokeWidth="1" />)}
        <circle r="29" fill="#516d64" stroke="#f0cf9c" strokeWidth="1.5" />
        {Array.from({ length: 8 }, (_, i) => <ellipse key={i} cy="-15" rx="5" ry="12" transform={`rotate(${i * 45})`} fill="#ebc588" />)}
        <circle r="8" fill="#98472c" /><circle r="3" fill="#f9dfaa" />
      </svg>
      {/* Three flame groups total, no per-lamp animation loops or blur filters. */}
      <svg viewBox="0 0 1200 48" preserveAspectRatio="xMidYMax meet" className="absolute bottom-[12px] w-full h-12">
        {[0, 1, 2].map(group => <g key={group} className="diwali-flames">
          {[0, 1, 2, 3].map(i => {
            const x = 44 + group * 400 + i * 104
            return <g key={i} transform={`translate(${x} 24)`}>
              {t.evening && <ellipse cy="-5" rx="15" ry="12" fill="#f6bd60" opacity=".12" />}
              <path d="M-11 0Q-9 9 1 8Q9 7 10 1L12-2L5-1Q-5-5-11 0Z" fill="#ad4931" stroke="#d4855b" strokeWidth=".8" />
              <path d="M-9 0Q-4-4 4 0L9-1Q6 5-2 4Q-7 4-9 0Z" fill="#713b27" />
              <path d="M-1 2L0-1" stroke="#eed4a1" strokeWidth="1.3" />
              <path d="M0 1Q-5-5 0-13Q5-5 0 1Z" fill={t.evening ? '#ffdf9d' : '#e9b75d'} />
              <path d="M0 0Q-2-3 0-6Q2-3 0 0Z" fill="#fff3ce" />
            </g>
          })}
        </g>)}
      </svg>
    </div>
  )
})
