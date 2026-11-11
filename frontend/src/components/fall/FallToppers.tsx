// Extra November photo toppers so every print doesn't wear the same leaf
// cluster. Same frame as AutumnLeafTopper (96x155 viewBox, twine ends at the
// card's top edge) so they drop into the existing slot.

function Twine() {
  return (
    <>
      <ellipse cx="48" cy="88" rx="3.5" ry="2.2" fill="#92400e" />
      <path d="M 48 88 C 43 108 53 128 48 153" stroke="#ca8a04" strokeWidth="1.8" strokeDasharray="4 2" fill="none" />
    </>
  )
}

function Svg({ flip, kind, children }: { flip: boolean; kind: string; children: React.ReactNode }) {
  return (
    <svg width="112" height="181" viewBox="0 0 96 155" className="pointer-events-none" data-seasonal-topper={kind} aria-hidden="true">
      <g transform={flip ? 'translate(96, 0) scale(-1, 1)' : undefined}>{children}</g>
    </svg>
  )
}

export function PineConeTopper({ seed = 0 }: { seed?: number }) {
  return (
    <Svg flip={seed % 2 === 0} kind="pinecone">
      {/* Evergreen sprig behind */}
      <g stroke="#3f6212" strokeWidth="1.6" strokeLinecap="round">
        <path d="M 22 60 L 72 40" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i} transform={`translate(${26 + i * 7} ${58 - i * 2.8})`}>
            <path d="M 0 0 L -3 -8 M 0 0 L 3 7" stroke={i % 2 ? '#4d7c0f' : '#365314'} />
          </g>
        ))}
      </g>
      {/* Two pine cones */}
      {[{ x: 38, y: 62, r: -18, s: 1 }, { x: 58, y: 64, r: 22, s: 0.85 }].map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r}) scale(${c.s})`}>
          <ellipse cx="0" cy="-12" rx="10" ry="15" fill="#6b3a16" />
          {[-22, -16, -10, -4, 2].map((y, j) => (
            <path key={j} d={`M -${8 - Math.abs(j - 2)} ${y} Q 0 ${y + 5} ${8 - Math.abs(j - 2)} ${y}`} stroke="#a16207" strokeWidth="1.4" fill="none" />
          ))}
          <path d="M 0 2 L 0 6" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {/* Red winterberries */}
      {[[46, 70], [51, 72], [49, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#b91c1c" />
      ))}
      <Twine />
    </Svg>
  )
}

export function MiniPumpkinTopper({ seed = 0 }: { seed?: number }) {
  return (
    <Svg flip={seed % 2 === 1} kind="minipumpkin">
      {/* Curling vine */}
      <path d="M 18 54 C 26 36, 40 48, 34 58 C 30 64, 22 58, 28 52" stroke="#4d7c0f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M 78 50 C 72 38, 62 44, 66 54" stroke="#4d7c0f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* Vine leaves */}
      <path d="M 24 46 C 14 40, 14 30, 24 30 C 30 34, 30 42, 24 46 Z" fill="#65a30d" />
      <path d="M 72 44 C 82 40, 84 30, 74 28 C 68 32, 68 40, 72 44 Z" fill="#4d7c0f" />
      {/* Pumpkin */}
      <g transform="translate(48 66)">
        <ellipse cx="-9" cy="0" rx="9" ry="12" fill="#c2410c" />
        <ellipse cx="9" cy="0" rx="9" ry="12" fill="#c2410c" />
        <ellipse cx="0" cy="0" rx="10" ry="13" fill="#ea580c" />
        <path d="M -4 -12 Q -5 0 -4 12 M 4 -12 Q 5 0 4 12" stroke="#9a3412" strokeWidth="1" fill="none" />
        <path d="M 0 -12 Q -1 -18 3 -21" stroke="#3f6212" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      {/* Little white gourd */}
      <ellipse cx="68" cy="74" rx="7" ry="6" fill="#f5efe0" />
      <path d="M 68 68 L 69 65" stroke="#4d7c0f" strokeWidth="1.5" strokeLinecap="round" />
      <Twine />
    </Svg>
  )
}

export function CornHuskTopper({ seed = 0 }: { seed?: number }) {
  return (
    <Svg flip={seed % 2 === 0} kind="cornhusk">
      {/* Three crossed Indian-corn cobs */}
      {[{ r: -28, c: ['#7c2d12', '#ca8a04', '#991b1b'] }, { r: 28, c: ['#a16207', '#7f1d1d', '#eab308'] }, { r: 0, c: ['#b45309', '#facc15', '#9a3412'] }].map((cob, i) => (
        <g key={i} transform={`translate(48 72) rotate(${cob.r})`}>
          <ellipse cx="0" cy="-30" rx="7" ry="20" fill={cob.c[0]} />
          {[-44, -38, -32, -26, -20, -14].map((y, j) => (
            <g key={j}>
              <circle cx="-3" cy={y} r="2" fill={cob.c[(j + 1) % 3]} />
              <circle cx="3" cy={y + 2} r="2" fill={cob.c[(j + 2) % 3]} />
            </g>
          ))}
        </g>
      ))}
      {/* Pale husks flaring out */}
      <path d="M 48 76 C 30 70, 20 78, 14 90 C 28 84, 38 82, 48 80 Z" fill="#e7d3a8" />
      <path d="M 48 76 C 66 70, 76 78, 82 90 C 68 84, 58 82, 48 80 Z" fill="#d6bd8a" />
      {/* Raffia tie */}
      <rect x="42" y="72" width="12" height="7" rx="2" fill="#b45309" />
      <Twine />
    </Svg>
  )
}

/** Wooden clothespin pinching the print where the twine meets it (polaroid look). */
export function Clothespin() {
  return (
    <svg width="22" height="44" viewBox="0 0 22 44" className="pointer-events-none" aria-hidden="true">
      <rect x="2" y="2" width="8" height="40" rx="2" fill="#c8a165" stroke="#8a6234" strokeWidth="0.8" />
      <rect x="12" y="2" width="8" height="40" rx="2" fill="#d7b57b" stroke="#8a6234" strokeWidth="0.8" />
      <rect x="1" y="17" width="20" height="5" rx="1.5" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.6" />
    </svg>
  )
}

/** Fabric ribbon for prints taken around a past Thanksgiving. */
export function ThanksgivingRibbon({ year }: { year: number }) {
  return (
    <div
      className="absolute -left-3 bottom-14 z-20 pointer-events-none select-none"
      style={{ transform: 'rotate(-4deg)' }}
    >
      <div
        className="relative pl-3 pr-5 py-1 text-[#fff7ea] shadow-md"
        style={{
          background: 'linear-gradient(180deg, #a3471f, #8a3a18)',
          fontFamily: "'Caveat', cursive",
          fontSize: '1.7rem',
          lineHeight: 1.1,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%)',
        }}
      >
        🍂 Thanksgiving {year}
      </div>
    </div>
  )
}
