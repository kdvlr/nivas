import React from 'react'

export function GouacheMapleLeaf({
  x,
  y,
  scale = 1,
  rot = 0,
  fill = '#dc2626',
  vein = 'rgba(255, 232, 185, 0.55)',
  opacity = 1,
}: {
  x: number
  y: number
  scale?: number
  rot?: number
  fill?: string
  vein?: string
  opacity?: number
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={opacity}>
      <path
        d="M0,-36 L6,-21 L19,-26 L14,-11 L32,-9 L20,3 L26,14 L10,12 L12,26 L0,18 L-12,26 L-10,12 L-26,14 L-20,3 L-32,-9 L-14,-11 L-19,-26 L-6,-21 Z"
        fill={fill}
        stroke={vein}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M0,24 L0,-26 M0,4 L-16,-7 M0,-3 L16,-13 M0,10 L-10,17 M0,10 L10,17"
        stroke="rgba(68, 20, 8, 0.42)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}

export function GouacheOakLeaf({
  x,
  y,
  scale = 1,
  rot = 0,
  fill = '#d97706',
  vein = 'rgba(255, 232, 185, 0.48)',
  opacity = 1,
}: {
  x: number
  y: number
  scale?: number
  rot?: number
  fill?: string
  vein?: string
  opacity?: number
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={opacity}>
      <path
        d="M0,-42 C8,-42 11,-33 7,-27 C17,-29 22,-21 15,-13 C23,-13 26,-3 17,4 C22,9 19,18 11,18 C13,25 7,31 2,29 L0,42 L-2,29 C-7,31 -13,25 -11,18 C-19,18 -22,9 -17,4 C-26,-3 -23,-13 -15,-13 C-22,-21 -17,-29 -7,-27 C-11,-33 -8,-42 0,-42 Z"
        fill={fill}
        stroke={vein}
        strokeWidth="1.15"
      />
      <path
        d="M0,38 L0,-34 M0,-18 L10,-23 M0,-9 L-12,-14 M0,0 L13,-4 M0,9 L-10,5"
        stroke={vein}
        strokeWidth="1.05"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  )
}

/** Wise Barred Owl on the upper-left oak bough (sleeps dawn/day, wide awake dusk/night). */
export function WoodlandOwl({
  mode,
  snowy,
  hoot,
  hideOwl = false,
}: {
  mode: 'sleeping' | 'awake'
  snowy: boolean
  hoot: boolean
  hideOwl?: boolean
}) {
  if (hideOwl) return null
  const awake = mode === 'awake' || hoot
  return (
    <g transform="translate(238, 174)">
      {/* Talons gripping branch */}
      <g fill="#d97706">
        <ellipse cx="-8" cy="40" rx="4.5" ry="2.5" />
        <ellipse cx="8" cy="40" rx="4.5" ry="2.5" />
      </g>
      <g className={hoot ? 'wd-hoot' : 'wd-breathe'} style={{ transformOrigin: '0px 36px' }}>
        {/* Wings (spread slightly on hoot) */}
        <path
          d={hoot ? 'M-18,4 C-38,-2 -42,22 -22,30 Z' : 'M-19,6 C-26,16 -24,30 -16,35 Z'}
          fill="#573c28"
        />
        <path
          d={hoot ? 'M18,4 C38,-2 42,22 22,30 Z' : 'M19,6 C26,16 24,30 16,35 Z'}
          fill="#573c28"
        />
        {/* Plump body & speckled chest */}
        <ellipse cx="0" cy="16" rx="22" ry="27" fill="#6e4e37" />
        <ellipse cx="0" cy="20" rx="14.5" ry="19" fill="#e6d7be" />
        <g stroke="#7c5a40" strokeWidth="1.6" strokeLinecap="round" opacity="0.65">
          <path d="M-7,12 L-3,12 M3,12 L7,12" />
          <path d="M-9,19 L-4,19 M0,19 L4,19 M6,19 L9,19" />
          <path d="M-6,26 L-2,26 M3,26 L7,26" />
        </g>

        {/* Head & ear tufts (tucked slightly lower when sleeping) */}
        <g transform={awake ? 'translate(0, 0)' : 'translate(0, 3)'}>
          <polygon points="-16,-14 -21,-26 -8,-17" fill="#573c28" />
          <polygon points="16,-14 21,-26 8,-17" fill="#573c28" />
          <ellipse cx="0" cy="-6" rx="18" ry="15" fill="#78563c" />
          <circle cx="-7.5" cy="-6" r="8.5" fill="#f5ead6" />
          <circle cx="7.5" cy="-6" r="8.5" fill="#f5ead6" />

          {awake ? (
            <g className="wd-blink" style={{ transformOrigin: '0px -6px' }}>
              <circle cx="-7.5" cy="-6" r="5" fill="#1c1917" />
              <circle cx="7.5" cy="-6" r="5" fill="#1c1917" />
              <circle cx="-7.5" cy="-6" r="4.8" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
              <circle cx="7.5" cy="-6" r="4.8" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
              <circle cx="-6" cy="-7.8" r="1.6" fill="#fffbeb" />
              <circle cx="9" cy="-7.8" r="1.6" fill="#fffbeb" />
            </g>
          ) : (
            <g stroke="#3b2618" strokeWidth="2" fill="none" strokeLinecap="round">
              <path d="M-12,-5 Q-7.5,-1 -3,-5" />
              <path d="M3,-5 Q7.5,-1 12,-5" />
            </g>
          )}
          <polygon points="0,-3 -4,3.5 4,3.5" fill="#d97706" />

          {snowy && (
            <path d="M-13,-18 Q0,-24 13,-18 Q7,-14 -13,-18 Z" fill="#f1f5f9" opacity="0.92" />
          )}
        </g>
      </g>
    </g>
  )
}

const ACORN_SLOTS: [number, number, string][] = [
  [-20, 32, '#78350f'], [-8, 34, '#92400e'], [5, 34, '#b45309'], [18, 31, '#78350f'],
  [-24, 24, '#b45309'], [-12, 25, '#d97706'], [0, 26, '#92400e'], [12, 25, '#b45309'], [23, 23, '#92400e'],
  [-19, 16, '#92400e'], [-7, 17, '#b45309'], [6, 17, '#d97706'], [18, 16, '#78350f'],
  [-21, 8, '#d97706'], [-9, 9, '#92400e'], [3, 9, '#b45309'], [15, 8, '#d97706'],
  [-15, 1, '#78350f'], [-3, 1, '#d97706'], [9, 1, '#92400e'],
  [-8, -6, '#b45309'], [4, -6, '#d97706'],
]

/** Glowing oak hollow packed with winter acorns + Squirrel following daily/weather routine. */
export function HollowScene({
  mode,
  acornCount,
  frosty,
  windy,
  excited,
  hideSquirrel = false,
}: {
  mode: 'sleeping' | 'umbrella' | 'cozy' | 'foraging'
  acornCount: number
  frosty: boolean
  windy: boolean
  excited: boolean
  hideSquirrel?: boolean
}) {
  const visibleAcorns = ACORN_SLOTS.slice(0, Math.max(4, Math.min(ACORN_SLOTS.length, acornCount)))

  return (
    <g transform="translate(104, 482)">
      {/* Warm amber interior glow */}
      <circle cx="0" cy="0" r="82" fill="url(#wdWarmOrb)" opacity={mode === 'sleeping' || mode === 'umbrella' || mode === 'cozy' ? 0.95 : 0.62} />

      {/* Carved hollow opening */}
      <ellipse cx="0" cy="0" rx="40" ry="54" fill="#1e0f07" stroke="#59341d" strokeWidth="5.5" />
      <ellipse cx="0" cy="4" rx="34" ry="46" fill="#5e2d0f" />

      {/* Stored winter acorns (fills higher week by week across November!) */}
      <g>
        {visibleAcorns.map(([ax, ay, col], idx) => (
          <g key={idx} transform={`translate(${ax}, ${ay})`}>
            <circle cx="0" cy="0" r="6.8" fill={col} />
            <path d="M-7,-2 C-7,-7 7,-7 7,-2 Z" fill="#3f2211" />
          </g>
        ))}
      </g>

      {/* Squirrel state (hidden while squirrel is out foraging or being chased) */}
      {hideSquirrel ? null : mode === 'sleeping' ? (
        <g transform="translate(0, 6)">
          <g className="wd-breathe" style={{ transformOrigin: '0px 10px' }}>
            {/* Two squirrels curled cozy inside the hollow */}
            <ellipse cx="-7" cy="6" rx="15" ry="11" fill="#c2591b" />
            <ellipse cx="9" cy="8" rx="14" ry="10" fill="#d96b27" />
            <path d="M-20,6 C-24,-12 -4,-16 4,-4" fill="#b44d14" />
            <path d="M22,8 C26,-10 8,-14 2,-3" fill="#ea752e" />
            <path d="M-11,4 Q-7,7 -3,4" stroke="#29150c" strokeWidth="1.6" fill="none" />
            <text x="14" y="-14" fill="#fef3c7" fontSize="13" fontFamily="Georgia, serif" fontStyle="italic" opacity="0.78">
              z z
            </text>
          </g>
        </g>
      ) : mode === 'umbrella' ? (
        /* Rainy day: squirrel perched dry under a giant scarlet maple-leaf umbrella! */
        <g transform="translate(12, 10)">
          <g className={excited ? 'wd-bounce' : undefined}>
            {/* Fluffy tail tucked dry */}
            <path d="M-10,4 C-32,-8 -32,-34 -14,-38 C-2,-40 -2,-18 -6,-6" fill="#c2591b" />
            <ellipse cx="2" cy="-4" rx="12.5" ry="15" fill="#d96b27" />
            <ellipse cx="5" cy="-2" rx="7" ry="10" fill="#f5d0a9" />
            <circle cx="5" cy="-19" r="9.5" fill="#d96b27" />
            <polygon points="1,-27 3,-35 8,-26" fill="#b45309" />
            <circle cx="8" cy="-21" r="2.1" fill="#1c1917" />
            <circle cx="8.7" cy="-21.7" r="0.8" fill="#fff" />
            {/* Stem + Giant Scarlet Maple Leaf Umbrella */}
            <line x1="10" y1="-6" x2="18" y2="-48" stroke="#4a2b16" strokeWidth="2.6" strokeLinecap="round" />
            <GouacheMapleLeaf x={18} y={-54} scale={0.98} rot={162} fill="#dc2626" vein="rgba(255,228,180,0.7)" />
          </g>
        </g>
      ) : (
        /* Foraging / Cozy day-dawn-dusk squirrel with glossy acorn */
        <g transform="translate(4, 8)">
          <g className={excited ? 'wd-bounce' : undefined} style={{ transformOrigin: '0px 0px' }}>
            <path
              d="M-10,2 C-34,-12 -36,-38 -17,-42 C-4,-44 -4,-20 -8,-8"
              fill="#c2591b"
              className={windy ? 'wd-tail-windy' : 'wd-tail'}
              style={{ transformOrigin: '-8px 0px' }}
            />
            <ellipse cx="3" cy="-6" rx="13" ry="15" fill="#d96b27" />
            <ellipse cx="6" cy="-4" rx="7.5" ry="10.5" fill="#f5d0a9" />
            <circle cx="6" cy="-21" r="9.8" fill="#d96b27" />
            <polygon points="1,-29 3,-37 8,-28" fill="#b45309" />
            <circle cx="9.5" cy="-22.5" r="2.2" fill="#1c1917" />
            <circle cx="10.2" cy="-23.2" r="0.8" fill="#fff" />
            {/* Held acorn */}
            <g transform="translate(17, -9) rotate(18)">
              <ellipse cx="0" cy="2" rx="5.5" ry="7" fill="#92400e" />
              <path d="M-6.5,-1 C-6.5,-6 6.5,-6 6.5,-1 Z" fill="#3f2211" />
            </g>
            {mode === 'cozy' && (
              <path d="M-2,-30 Q6,-35 14,-29" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            )}
            {frosty && (
              <g transform="translate(20, -23)">
                <g className="wd-breath">
                  <circle cx="4" cy="0" r="3.5" fill="rgba(236, 246, 255, 0.55)" />
                  <circle cx="10" cy="-3" r="5" fill="rgba(236, 246, 255, 0.38)" />
                </g>
              </g>
            )}
          </g>
        </g>
      )}

      {/* Hollow mossy lower lip */}
      <path d="M-36,36 Q0,54 36,36 Q18,46 -36,36 Z" fill="#3f5228" opacity="0.85" />
    </g>
  )
}

/** Second squirrel that periodically scampers up the left oak trunk carrying an acorn. */
export function ScamperingSquirrel() {
  return (
    <g className="wd-climber">
      <g transform="rotate(-82)">
        <path d="M-16,2 C-32,-6 -34,-22 -20,-24 C-10,-25 -10,-8 -12,0" fill="#b44d14" />
        <ellipse cx="0" cy="0" rx="13" ry="8.5" fill="#d96b27" />
        <circle cx="13" cy="-2" r="7.5" fill="#d96b27" />
        <polygon points="11,-8 15,-15 17,-7" fill="#9a3412" />
        <circle cx="16" cy="-4" r="1.8" fill="#1c1917" />
        {/* Acorn in mouth */}
        <circle cx="22" cy="1" r="4.5" fill="#92400e" />
      </g>
    </g>
  )
}

/** Red-crested woodpecker that flies in to the right oak trunk, pecks, and flies back out. */
export function WoodpeckerCameo() {
  return (
    <g className="wd-woodpecker-flight">
      <g className="wd-peck" style={{ transformOrigin: '8px 18px' }}>
        <path d="M12,18 L24,34 L16,34 L6,18 Z" fill="#1e293b" />
        {/* Flapping wing during flight */}
        <path
          d="M6,-2 C22,-18 32,-12 20,8 Z"
          fill="#334155"
          className="wd-pecker-wings"
          style={{ transformOrigin: '8px 2px' }}
        />
        <ellipse cx="6" cy="4" rx="10" ry="16" fill="#1e293b" />
        <ellipse cx="2" cy="6" rx="6" ry="11" fill="#f8fafc" />
        <circle cx="3" cy="-12" r="8" fill="#1e293b" />
        <polygon points="1,-19 12,-24 8,-12" fill="#dc2626" />
        <polygon points="-4,-13 -15,-11 -4,-9" fill="#94a3b8" />
        <circle cx="1" cy="-13" r="1.8" fill="#fef08a" />
      </g>
      {/* Tiny bark tap lines (visible only while perched and pecking) */}
      <g className="wd-peck-sparks" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round">
        <line x1="-18" y1="-18" x2="-24" y2="-22" />
        <line x1="-19" y1="-11" x2="-26" y2="-11" />
      </g>
    </g>
  )
}

/** Right oak root den + Red Fox & Kit following daily/weather routine. */
export function FoxDenScene({
  mode,
  frosty,
  snowy,
  wagged,
  hideAdult = false,
}: {
  mode: 'stretching' | 'watching' | 'curled'
  frosty: boolean
  snowy: boolean
  wagged: boolean
  hideAdult?: boolean
}) {
  return (
    <g transform="translate(1766, 956)">
      {/* Root Den Hollow */}
      <ellipse cx="0" cy="0" rx="92" ry="52" fill="#140b06" stroke="#4a2d1b" strokeWidth="6" />
      <circle cx="0" cy="-4" r="88" fill="url(#wdWarmOrb)" opacity={mode === 'curled' ? 0.72 : 0.34} />

      {mode === 'curled' ? (
        /* Curled nose-to-tail inside warm den (dusk, night, rain, snow) */
        <g transform="translate(-2, 8)">
          <g className="wd-breathe" style={{ transformOrigin: '0px 8px' }}>
            {/* Little fox kit tucked behind */}
            <ellipse cx="20" cy="-8" rx="22" ry="13" fill="#c2410c" />
            <circle cx="8" cy="-14" r="9.5" fill="#ea580c" />
            <polygon points="3,-21 5,-29 11,-21" fill="#7c2d12" />

            {/* Adult fox curled in front */}
            <ellipse cx="-4" cy="4" rx="42" ry="20" fill="#d9531e" />
            <path d="M-38,8 C-18,26 24,26 42,8 C32,-4 6,4 -18,4 Z" fill="#ea6a2a" />
            <path
              d="M20,10 C38,14 46,6 42,-2 C34,-6 22,2 20,10 Z"
              fill="#fef3c7"
              className={wagged ? 'wd-tail-fast' : undefined}
            />
            <circle cx="-24" cy="-6" r="14.5" fill="#d9531e" />
            <polygon points="-34,-16 -30,-30 -20,-18" fill="#9a3412" />
            <polygon points="-18,-17 -12,-30 -8,-15" fill="#9a3412" />
            <path d="M-30,-5 Q-25,-1 -20,-5" stroke="#29150c" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        </g>
      ) : mode === 'stretching' ? (
        /* Dawn: Fox stepped out on the mossy root ledge doing a morning play-bow stretch! */
        <g>
          {/* Kit peeking happily from den */}
          <g transform="translate(12, 8)">
            <circle cx="0" cy="0" r="11" fill="#ea580c" />
            <polygon points="-8,-7 -6,-17 0,-9" fill="#9a3412" />
            <polygon points="2,-9 8,-17 9,-7" fill="#9a3412" />
            <circle cx="-3.5" cy="-1" r="1.8" fill="#1c1917" />
            <circle cx="3.5" cy="-1" r="1.8" fill="#1c1917" />
          </g>
          {/* Adult fox stretching left on mossy ledge */}
          {!hideAdult && (
          <g transform="translate(-88, 16)">
            <path
              d="M32,-16 C54,-34 66,-22 56,-6 C48,4 34,0 28,-8 Z"
              fill="#ea6a2a"
              className="wd-tail"
              style={{ transformOrigin: '30px -10px' }}
            />
            <circle cx="55" cy="-18" r="8" fill="#fef3c7" />
            {/* Sloped play-bow back */}
            <path d="M-34,12 Q-4,8 28,-12 L32,8 Q0,20 -30,20 Z" fill="#d9531e" />
            {/* Front paws stretched forward */}
            <path d="M-28,16 L-52,22" stroke="#9a3412" strokeWidth="6" strokeLinecap="round" />
            <path d="M24,4 L28,22" stroke="#9a3412" strokeWidth="6.5" strokeLinecap="round" />
            {/* Head low & happy */}
            <g transform="translate(-36, 4)">
              <circle cx="0" cy="0" r="13" fill="#ea580c" />
              <path d="M-18,3 L-4,-3 L-4,7 Z" fill="#ea580c" />
              <path d="M-17,3 L-8,7 L-4,4 Z" fill="#fef3c7" />
              <circle cx="-18" cy="2.5" r="2.2" fill="#1c1917" />
              <polygon points="-4,-10 -1,-22 6,-10" fill="#9a3412" />
              <path d="M-9,-1 Q-5,2 -1,-1" stroke="#29150c" strokeWidth="1.8" fill="none" />
              {frosty && (
                <g transform="translate(-26, 0)">
                  <g className="wd-breath">
                    <circle cx="-4" cy="-2" r="4" fill="rgba(236, 246, 255, 0.52)" />
                    <circle cx="-11" cy="-6" r="5.5" fill="rgba(236, 246, 255, 0.34)" />
                  </g>
                </g>
              )}
            </g>
          </g>
          )}
        </g>
      ) : (
        /* Clear/Cloudy Daytime: Fox & Kit sitting upright watching the clearing */
        <g transform="translate(-68, 12)">
          {!hideAdult && (
            <g>
              {/* Bushy tail */}
              <path
                d="M18,12 C46,6 54,-18 38,-24 C26,-28 20,-4 16,8 Z"
                fill="#d9531e"
                className={wagged ? 'wd-tail-fast' : 'wd-tail'}
                style={{ transformOrigin: '18px 10px' }}
              />
              <circle cx="41" cy="-19" r="8.5" fill="#fef3c7" />
              {/* Seated body & white chest bib */}
              <ellipse cx="0" cy="4" rx="18" ry="24" fill="#d9531e" />
              <ellipse cx="-5" cy="2" rx="9" ry="16" fill="#fef3c7" />
              {/* Perked head facing clearing */}
              <g transform="translate(-6, -22)">
                <polygon points="-9,-9 -12,-24 -1,-12" fill="#9a3412" />
                <polygon points="5,-11 11,-24 13,-9" fill="#9a3412" />
                <circle cx="0" cy="0" r="13.5" fill="#ea580c" />
                <path d="M-16,3 L-3,-3 L-3,8 Z" fill="#ea580c" />
                <path d="M-15,4 L-3,8 L-3,2 Z" fill="#fef3c7" />
                <circle cx="-16" cy="3" r="2.2" fill="#1c1917" />
                <circle cx="-5" cy="-2" r="2.3" fill="#1c1917" />
                <circle cx="-4.3" cy="-2.8" r="0.8" fill="#fff" />
              </g>
            </g>
          )}

          {/* Little kit seated beside */}
          <g transform="translate(52, 8) scale(0.72)">
            <ellipse cx="0" cy="4" rx="16" ry="20" fill="#ea580c" />
            <ellipse cx="-4" cy="3" rx="8" ry="13" fill="#fef3c7" />
            <circle cx="-3" cy="-16" r="12" fill="#ea580c" />
            <polygon points="-11,-24 -13,-37 -3,-26" fill="#9a3412" />
            <polygon points="3,-26 9,-37 11,-24" fill="#9a3412" />
            <circle cx="-6" cy="-17" r="2.2" fill="#1c1917" />
          </g>
        </g>
      )}

      {snowy && (
        <path d="M-78,-42 Q0,-64 78,-38" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.85" />
      )}
    </g>
  )
}

/** Plump storybook turkey in an acorn-cap pilgrim hat for Thanksgiving week. */
export function PeekingWoodlandTurkey({ gobble }: { gobble: boolean }) {
  return (
    <g transform="translate(1596, 1022)">
      <g className={gobble ? 'wd-bounce' : 'wd-breathe'} style={{ transformOrigin: '0px 16px' }}>
        {/* Scalloped autumn tail fan */}
        {[-50, -30, -10, 10, 30, 50].map((deg, idx) => (
          <ellipse
            key={idx}
            cx="0"
            cy="-18"
            rx="8.5"
            ry="24"
            transform={`rotate(${deg} 0 8)`}
            fill={idx % 2 === 0 ? '#b91c1c' : '#d97706'}
            stroke="#fde68a"
            strokeWidth="0.9"
          />
        ))}
        <ellipse cx="0" cy="8" rx="18" ry="16" fill="#6b3a19" />
        <circle cx="-6" cy="-8" r="10" fill="#7c431e" />
        {/* Red snood & golden beak */}
        <path d="M-13,-6 C-17,-2 -15,4 -11,2 Z" fill="#dc2626" />
        <polygon points="-14,-9 -22,-6 -14,-4" fill="#f59e0b" />
        <circle cx="-9" cy="-10" r="2" fill="#1c1917" />
        <circle cx="-8.4" cy="-10.6" r="0.7" fill="#fff" />
        {/* Tiny acorn-cap pilgrim hat */}
        <g transform="translate(-5, -18) rotate(-8)">
          <ellipse cx="0" cy="2" rx="13" ry="3.2" fill="#3f2211" />
          <path d="M-8,2 L-6,-9 L6,-9 L8,2 Z" fill="#4a2b16" />
          <rect x="-7" y="-2" width="14" height="3" fill="#eab308" />
        </g>
      </g>
    </g>
  )
}

/** Thanksgiving Week miniature woodland stump feast & rustic countdown sign. */
export function HarvestStumpFeast({
  sleeps,
  isTgDay,
  frosty,
  snowy,
}: {
  sleeps: number
  isTgDay: boolean
  frosty: boolean
  snowy: boolean
}) {
  const label = isTgDay
    ? 'Happy Thanksgiving!'
    : sleeps > 0
      ? `${sleeps} sleep${sleeps === 1 ? '' : 's'} till Feast!`
      : 'Thankful & Cozy'

  return (
    <g>
      {/* Rustic Woodland Signpost */}
      <g transform="translate(1365, 1034)">
        <rect x="-4" y="-6" width="8" height="36" rx="2" fill="#3b2314" />
        <g transform="rotate(-2)">
          <rect x="-78" y="-34" width="156" height="32" rx="5" fill="#5c3820" stroke="#be8c56" strokeWidth="1.5" />
          <text
            x="0"
            y="-12"
            textAnchor="middle"
            fill="#fef3c7"
            fontFamily="'Caveat', Georgia, cursive"
            fontSize="20"
            fontWeight="700"
          >
            {label}
          </text>
        </g>
      </g>

      {/* Miniature Harvest Stump Table */}
      <g transform="translate(1505, 1028)">
        <path d="M-46,36 L-34,-8 L34,-8 L46,36 Z" fill="#4a2d1b" />
        <path d="M-38,34 C-32,16 -30,4 -28,-6 M22,-6 C24,8 28,20 34,34" stroke="#2d190e" strokeWidth="2.5" fill="none" />
        <ellipse cx="0" cy="-8" rx="36" ry="8.5" fill="#c7955d" stroke="#6b4226" strokeWidth="1.5" />
        {/* Cream linen runner */}
        <polygon points="-18,-10 18,-10 22,6 -22,6" fill="#faf3e3" opacity="0.92" />
        {/* Tiny pumpkin */}
        <ellipse cx="-14" cy="-16" rx="11.5" ry="8.5" fill="#ea580c" />
        <path d="M-14,-24 L-12,-28" stroke="#3f6212" strokeWidth="2.4" strokeLinecap="round" />
        {/* Lattice berry pie */}
        <ellipse cx="12" cy="-13" rx="12" ry="5.5" fill="#d97706" />
        <ellipse cx="12" cy="-15" rx="9" ry="3.8" fill="#991b1b" />
        {/* Acorn-cup goblets */}
        <circle cx="-1" cy="-20" r="3.5" fill="#92400e" />
        <circle cx="27" cy="-15" r="3.2" fill="#92400e" />
        {(frosty || snowy) && (
          <path
            d="M-34,-8 Q0,-16 34,-8"
            stroke={snowy ? '#f8fafc' : 'rgba(219, 238, 255, 0.65)'}
            strokeWidth={snowy ? '4' : '1.8'}
            fill="none"
          />
        )}
      </g>
    </g>
  )
}

/** Shared upright/scampering squirrel body centered at (0,0), facing right (+x). */
function CuteSquirrelSprite({ withAcorn = false }: { withAcorn?: boolean }) {
  return (
    <g>
      {/* Fluffy curved tail */}
      <path
        d="M-8,2 C-28,-8 -30,-30 -14,-34 C-3,-36 -2,-16 -6,-4"
        fill="#b44d14"
        className="wd-tail-fast"
        style={{ transformOrigin: '-6px 0px' }}
      />
      {/* Body & cream belly */}
      <ellipse cx="2" cy="-3" rx="12" ry="9.5" fill="#d96b27" />
      <ellipse cx="5" cy="-1" rx="7" ry="6" fill="#f5d0a9" />
      {/* Head & ear */}
      <circle cx="12" cy="-12" r="7.8" fill="#d96b27" />
      <polygon points="8,-18 11,-26 15,-18" fill="#9a3412" />
      <circle cx="15" cy="-13.5" r="1.9" fill="#1c1917" />
      <circle cx="15.6" cy="-14.1" r="0.7" fill="#fff" />
      {/* Tiny paws */}
      <ellipse cx="10" cy="4" rx="3.2" ry="2" fill="#9a3412" />
      <ellipse cx="-2" cy="5" rx="3.8" ry="2.2" fill="#9a3412" />
      {withAcorn && (
        <g transform="translate(20, -7) rotate(15)">
          <ellipse cx="0" cy="1.5" rx="4.2" ry="5.5" fill="#92400e" />
          <path d="M-5,-1 C-5,-5 5,-5 5,-1 Z" fill="#3f2211" />
        </g>
      )}
    </g>
  )
}

/** Squirrel comes out of the tree hollow, hops onto the mossy floor to forage, and scrambles back up. */
export function SquirrelTreeSortie() {
  return (
    <g>
      {/* Little acorn waiting on the mossy floor that disappears as squirrel snatches it */}
      <g className="wd-sortie-acorn">
        <ellipse cx="446" cy="1008" rx="4.5" ry="6" fill="#92400e" />
        <path d="M440.5,1005 C440.5,1000 451.5,1000 451.5,1005 Z" fill="#3f2211" />
      </g>
      <g className="wd-sortie-squirrel">
        <g className="wd-hop-bob">
          <CuteSquirrelSprite withAcorn />
        </g>
      </g>
    </g>
  )
}

/** Playful two-character vignette: fox spots the foraging squirrel and chases it back up the oak! */
export function FoxSquirrelChase() {
  return (
    <g>
      {/* Squirrel path */}
      <g className="wd-chase-squirrel">
        <g className="wd-hop-bob">
          <CuteSquirrelSprite />
        </g>
      </g>

      {/* Cute startled '!' spark when squirrel spots the bounding fox */}
      <g className="wd-chase-spark">
        <g transform="translate(652, 956)">
          <circle cx="0" cy="0" r="14" fill="#fef3c7" stroke="#ea580c" strokeWidth="2" />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fill="#b91c1c"
            fontFamily="Georgia, serif"
            fontSize="18"
            fontWeight="700"
          >
            !
          </text>
        </g>
      </g>

      {/* Bounding Red Fox (centered around den pose at 0,0, facing left) */}
      <g className="wd-chase-fox">
        <g className="wd-fox-gallop">
          {/* Bushy white-tipped tail */}
          <path
            d="M22,-2 C48,-10 56,-28 40,-32 C28,-35 22,-14 18,-2 Z"
            fill="#d9531e"
            className="wd-tail-fast"
            style={{ transformOrigin: '20px -2px' }}
          />
          <circle cx="43" cy="-27" r="7.5" fill="#fef3c7" />
          {/* Sleek running torso */}
          <ellipse cx="0" cy="0" rx="26" ry="13.5" fill="#d9531e" />
          <ellipse cx="-10" cy="3" rx="12" ry="7.5" fill="#fef3c7" />
          {/* Bounding legs */}
          <path d="M-16,8 L-28,22" stroke="#9a3412" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M-6,10 L-14,23" stroke="#9a3412" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M14,8 L26,22" stroke="#9a3412" strokeWidth="5.5" strokeLinecap="round" />
          {/* Alert head facing left */}
          <g transform="translate(-24, -10)">
            <polygon points="-6,-9 -8,-22 2,-10" fill="#9a3412" />
            <polygon points="4,-10 10,-22 12,-8" fill="#9a3412" />
            <circle cx="0" cy="0" r="12.5" fill="#ea580c" />
            <path d="M-17,3 L-4,-3 L-4,7 Z" fill="#ea580c" />
            <path d="M-16,4 L-4,7 L-4,2 Z" fill="#fef3c7" />
            <circle cx="-17" cy="3" r="2.1" fill="#1c1917" />
            <circle cx="-4" cy="-2" r="2.2" fill="#1c1917" />
            <circle cx="-3.4" cy="-2.8" r="0.8" fill="#fff" />
          </g>
        </g>
      </g>
    </g>
  )
}

/** Curious cottontail bunny that hops out from behind the toadstools, twitches, and hops home. */
export function CottontailBunny() {
  return (
    <g className="wd-bunny-path">
      <g className="wd-bunny-hop">
        {/* Fluffy white cottontail */}
        <circle cx="-16" cy="2" r="6.5" fill="#faf5eb" />
        {/* Plump cocoa-cream body */}
        <ellipse cx="0" cy="0" rx="15" ry="11.5" fill="#d6bfa7" />
        <ellipse cx="4" cy="3" rx="8.5" ry="6.5" fill="#f5eadc" />
        {/* Back paw */}
        <ellipse cx="-5" cy="10" rx="7" ry="3.2" fill="#bfa388" />
        {/* Head + twitching ears */}
        <g transform="translate(13, -8)">
          <g className="wd-bunny-ears" style={{ transformOrigin: '-2px -6px' }}>
            <ellipse cx="-4" cy="-16" rx="3.4" ry="11" transform="rotate(-14 -4 -16)" fill="#d6bfa7" />
            <ellipse cx="-4" cy="-16" rx="1.6" ry="7.5" transform="rotate(-14 -4 -16)" fill="#f3c6c0" />
            <ellipse cx="3" cy="-17" rx="3.4" ry="11.5" transform="rotate(8 3 -17)" fill="#c7ad93" />
          </g>
          <circle cx="0" cy="0" r="9" fill="#d6bfa7" />
          <circle cx="3.5" cy="-1.5" r="1.9" fill="#1c1917" />
          <circle cx="4.1" cy="-2.1" r="0.65" fill="#fff" />
          <circle cx="9" cy="1.5" r="1.8" fill="#f4978e" />
        </g>
      </g>
    </g>
  )
}

/** Glossy acorn that drops from the upper-left oak bough and bounces onto the mossy clearing. */
export function AcornDropCameo() {
  return (
    <g className="wd-acorn-drop">
      <ellipse cx="0" cy="3" rx="6.5" ry="8.5" fill="#92400e" />
      <path d="M-7.5,-1 C-7.5,-7 7.5,-7 7.5,-1 Z" fill="#3f2211" />
      <line x1="0" y1="-6" x2="1" y2="-10" stroke="#3f2211" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

/** Warm golden fireflies drifting gently around the lanterns & toadstools on dusk/night evenings. */
export function FireflyDance() {
  const flies = [
    { cls: 'wd-firefly-1', r: 16 },
    { cls: 'wd-firefly-2', r: 14 },
    { cls: 'wd-firefly-3', r: 18 },
    { cls: 'wd-firefly-4', r: 15 },
    { cls: 'wd-firefly-5', r: 17 },
  ]
  return (
    <g>
      {flies.map((f) => (
        <g key={f.cls} className={f.cls}>
          <circle cx="0" cy="0" r={f.r} fill="url(#wdWarmOrb)" opacity="0.85" />
          <circle cx="0" cy="0" r="2.8" fill="#fef9c3" />
        </g>
      ))}
    </g>
  )
}

/** Night/dusk barred owl taking a silent swoop across the moonlit sky and returning to its oak bough. */
export function OwlNightFlight() {
  return (
    <g className="wd-owl-flight">
      {/* Wide barred wings */}
      <path
        d="M-12,6 C-46,-16 -64,-4 -54,18 C-40,22 -22,18 -10,14 Z"
        fill="#573c28"
        className="wd-owl-wing-l"
        style={{ transformOrigin: '-10px 8px' }}
      />
      <path
        d="M12,6 C46,-16 64,-4 54,18 C40,22 22,18 10,14 Z"
        fill="#573c28"
        className="wd-owl-wing-r"
        style={{ transformOrigin: '10px 8px' }}
      />
      {/* Plump body & chest */}
      <ellipse cx="0" cy="14" rx="19" ry="23" fill="#6e4e37" />
      <ellipse cx="0" cy="17" rx="12.5" ry="16" fill="#e6d7be" />
      {/* Head & glowing amber eyes */}
      <polygon points="-14,-12 -19,-23 -7,-15" fill="#573c28" />
      <polygon points="14,-12 19,-23 7,-15" fill="#573c28" />
      <ellipse cx="0" cy="-5" rx="16" ry="13.5" fill="#78563c" />
      <circle cx="-6.8" cy="-5" r="7.5" fill="#f5ead6" />
      <circle cx="6.8" cy="-5" r="7.5" fill="#f5ead6" />
      <circle cx="-6.8" cy="-5" r="4.4" fill="#1c1917" />
      <circle cx="6.8" cy="-5" r="4.4" fill="#1c1917" />
      <circle cx="-6.8" cy="-5" r="4.2" fill="none" stroke="#f59e0b" strokeWidth="1.3" />
      <circle cx="6.8" cy="-5" r="4.2" fill="none" stroke="#f59e0b" strokeWidth="1.3" />
      <circle cx="-5.4" cy="-6.6" r="1.4" fill="#fffbeb" />
      <circle cx="8.2" cy="-6.6" r="1.4" fill="#fffbeb" />
      <polygon points="0,-2 -3.5,3.5 3.5,3.5" fill="#d97706" />
    </g>
  )
}
