import React from 'react'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import type { Quality } from '../sky/useQuality'

interface Palette {
  stops: [string, string, string, string]
  trunkFar: string
  trunkMid: string
  hillTop: string
  hillBot: string
  mist: string
  mistOpacity: number
}

function getBackdropPalette(phase: SkyPhase, kind: SkyKind): Palette {
  const wet = kind === 'rainy' || kind === 'stormy'
  const snowy = kind === 'snowy'
  const cloudy = kind === 'cloudy'

  if (snowy) {
    const dark = phase === 'dusk' || phase === 'night'
    return dark
      ? {
          stops: ['#344763', '#1e2b40', '#111929', '#090e18'],
          trunkFar: 'rgba(22, 32, 48, 0.72)',
          trunkMid: 'rgba(16, 24, 38, 0.84)',
          hillTop: '#cbd8e6',
          hillBot: '#5c7087',
          mist: '220, 234, 248',
          mistOpacity: 0.22,
        }
      : {
          stops: ['#e6f0f8', '#8ba4ba', '#42586e', '#202f40'],
          trunkFar: 'rgba(46, 64, 82, 0.58)',
          trunkMid: 'rgba(34, 49, 66, 0.74)',
          hillTop: '#eef5fb',
          hillBot: '#8ea3b8',
          mist: '240, 247, 255',
          mistOpacity: 0.30,
        }
  }

  if (wet) {
    const dark = phase === 'dusk' || phase === 'night'
    return dark
      ? {
          stops: ['#35495c', '#1e2d3d', '#111b27', '#0a1018'],
          trunkFar: 'rgba(18, 28, 38, 0.72)',
          trunkMid: 'rgba(12, 20, 29, 0.85)',
          hillTop: '#243138',
          hillBot: '#10181d',
          mist: '168, 196, 210',
          mistOpacity: 0.24,
        }
      : {
          stops: ['#93b2b8', '#52707a', '#2c414d', '#17252f'],
          trunkFar: 'rgba(34, 52, 62, 0.58)',
          trunkMid: 'rgba(24, 39, 48, 0.74)',
          hillTop: '#354844',
          hillBot: '#192422',
          mist: '205, 224, 230',
          mistOpacity: 0.34,
        }
  }

  if (phase === 'dawn') {
    return cloudy
      ? {
          stops: ['#e3c3ab', '#8b6873', '#3a344c', '#1c1d30'],
          trunkFar: 'rgba(48, 41, 62, 0.58)',
          trunkMid: 'rgba(36, 30, 48, 0.72)',
          hillTop: '#4a3b34',
          hillBot: '#211916',
          mist: '248, 222, 208',
          mistOpacity: 0.32,
        }
      : {
          stops: ['#fbd38d', '#c46d61', '#463759', '#1e1f38'],
          trunkFar: 'rgba(56, 40, 64, 0.58)',
          trunkMid: 'rgba(40, 28, 48, 0.74)',
          hillTop: '#543c2c',
          hillBot: '#241811',
          mist: '255, 226, 198',
          mistOpacity: 0.28,
        }
  }

  if (phase === 'day') {
    return cloudy
      ? {
          stops: ['#eadbc0', '#968164', '#43535e', '#23303b'],
          trunkFar: 'rgba(54, 64, 70, 0.52)',
          trunkMid: 'rgba(39, 48, 54, 0.68)',
          hillTop: '#544a34',
          hillBot: '#282217',
          mist: '236, 232, 222',
          mistOpacity: 0.26,
        }
      : {
          stops: ['#fef08a', '#d9832c', '#4c6652', '#1f3b4d'],
          trunkFar: 'rgba(46, 66, 62, 0.50)',
          trunkMid: 'rgba(34, 50, 46, 0.68)',
          hillTop: '#5e4b2a',
          hillBot: '#2b2012',
          mist: '255, 244, 214',
          mistOpacity: 0,
        }
  }

  if (phase === 'dusk') {
    return cloudy
      ? {
          stops: ['#cfa068', '#784235', '#312b3d', '#161824'],
          trunkFar: 'rgba(38, 35, 50, 0.62)',
          trunkMid: 'rgba(28, 26, 39, 0.76)',
          hillTop: '#3b2e22',
          hillBot: '#1a130e',
          mist: '232, 198, 175',
          mistOpacity: 0.20,
        }
      : {
          stops: ['#f6bd60', '#9e4727', '#362c3e', '#151824'],
          trunkFar: 'rgba(34, 34, 50, 0.65)',
          trunkMid: 'rgba(26, 28, 42, 0.78)',
          hillTop: '#3d3122',
          hillBot: '#1b140e',
          mist: '248, 210, 170',
          mistOpacity: 0.12,
        }
  }

  // Night
  return {
    stops: ['#263454', '#162038', '#0c1121', '#070a14'],
    trunkFar: 'rgba(16, 23, 39, 0.72)',
    trunkMid: 'rgba(11, 16, 29, 0.86)',
    hillTop: '#1d2428',
    hillBot: '#0c0f12',
    mist: '165, 190, 225',
    mistOpacity: cloudy ? 0.18 : 0.10,
  }
}

const STARS: [number, number, number, number][] = [
  [690, 58, 1.8, 0.85], [765, 118, 1.4, 0.65], [842, 44, 2.1, 0.9], [928, 92, 1.5, 0.7],
  [1015, 52, 1.9, 0.8], [1095, 128, 1.3, 0.6], [1172, 68, 2.2, 0.92], [1248, 108, 1.5, 0.72],
  [1312, 48, 1.7, 0.8], [1478, 62, 1.8, 0.85], [1542, 134, 1.4, 0.68], [1595, 78, 1.9, 0.78],
  [895, 168, 1.3, 0.55], [1135, 182, 1.4, 0.58], [1335, 192, 1.5, 0.62], [1515, 208, 1.3, 0.55],
]

export const WoodlandBackdrop = React.memo(function WoodlandBackdrop({
  phase,
  kind,
  quality,
  paused,
  frosty,
}: {
  phase: SkyPhase
  kind: SkyKind
  quality: Quality
  paused: boolean
  frosty: boolean
}) {
  const pal = getBackdropPalette(phase, kind)
  const wet = kind === 'rainy' || kind === 'stormy'
  const snowy = kind === 'snowy'
  const showSunbeams = (phase === 'day' || phase === 'dawn') && kind === 'clear'
  const showMoon = phase === 'night'
  const showGeese = phase === 'dusk' && !wet && !snowy
  const mistAlpha = Math.max(pal.mistOpacity, frosty && !wet ? 0.22 : 0)
  const animateMist = quality !== 'low' && !paused && mistAlpha > 0

  const moonDim = kind === 'clear' ? 1 : kind === 'cloudy' ? 0.55 : 0.28

  return (
    <div className="absolute inset-0 z-[3] pointer-events-none select-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes woodlandMistA {
          0%, 100% { transform: translate3d(-3%, 0, 0); }
          50% { transform: translate3d(3%, 0, 0); }
        }
        @keyframes woodlandMistB {
          0%, 100% { transform: translate3d(3%, 0, 0); }
          50% { transform: translate3d(-3%, 0, 0); }
        }
        @keyframes woodlandStarTwinkle {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          <radialGradient id="wdClearingBg" cx="48%" cy="54%" r="68%">
            <stop offset="0%" stopColor={pal.stops[0]} />
            <stop offset="36%" stopColor={pal.stops[1]} />
            <stop offset="70%" stopColor={pal.stops[2]} />
            <stop offset="100%" stopColor={pal.stops[3]} />
          </radialGradient>

          <linearGradient id="wdSunbeam" x1="0" y1="0" x2="0.65" y2="1">
            <stop offset="0%" stopColor={phase === 'dawn' ? '#fed7aa' : '#fef08a'} stopOpacity={phase === 'dawn' ? '0.26' : '0.32'} />
            <stop offset="65%" stopColor="#fde68a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="wdMoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.52" />
            <stop offset="32%" stopColor="#fde68a" stopOpacity="0.20" />
            <stop offset="68%" stopColor="#93c5fd" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="wdFarHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.hillTop} />
            <stop offset="100%" stopColor={pal.hillBot} />
          </linearGradient>

          <radialGradient id="wdMistRadial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgb(${pal.mist})`} stopOpacity={String(mistAlpha)} />
            <stop offset="55%" stopColor={`rgb(${pal.mist})`} stopOpacity={String(mistAlpha * 0.48)} />
            <stop offset="100%" stopColor={`rgb(${pal.mist})`} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Painterly Clearing Radial Wash */}
        <rect x="0" y="0" width="1920" height="1080" fill="url(#wdClearingBg)" />

        {/* 2. Night Stars & Storybook Harvest Moon in Open Upper-Right Canopy Gap */}
        {showMoon && (
          <g opacity={moonDim}>
            {STARS.map(([sx, sy, sr, so], i) => (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={sr}
                fill="#fef9c3"
                opacity={so}
                style={
                  quality !== 'low' && !paused && i % 3 === 0
                    ? { animation: `woodlandStarTwinkle ${3.2 + (i % 4) * 0.9}s ease-in-out ${i * 0.4}s infinite` }
                    : undefined
                }
              />
            ))}
            <circle cx="1390" cy="108" r="235" fill="url(#wdMoonGlow)" />
            <circle cx="1390" cy="108" r="38" fill="#fef3c7" />
            <circle cx="1378" cy="98" r="7" fill="#fde68a" opacity="0.55" />
            <circle cx="1402" cy="118" r="5.5" fill="#fde68a" opacity="0.45" />
            <circle cx="1384" cy="122" r="4" fill="#fde68a" opacity="0.4" />
          </g>
        )}

        {/* Pale fading dawn crescent */}
        {phase === 'dawn' && !wet && !snowy && (
          <g transform="translate(1395, 112)" opacity="0.55">
            <path d="M-16,-22 A26,26 0 1,0 18,18 A21,21 0 1,1 -16,-22 Z" fill="#fef3c7" />
          </g>
        )}

        {/* Dusk Migrating Geese V-Formation in Open Upper-Right Sky */}
        {showGeese && (
          <g stroke="rgba(28, 22, 34, 0.72)" strokeWidth="2.2" fill="none" strokeLinecap="round">
            <path d="M1210,96 q7,-6 14,0 q7,-6 14,0" />
            <path d="M1242,82 q6,-5 12,0 q6,-5 12,0" />
            <path d="M1238,112 q6,-5 12,0 q6,-5 12,0" />
            <path d="M1272,70 q5,-4 10,0 q5,-4 10,0" />
            <path d="M1268,126 q5,-4 10,0 q5,-4 10,0" />
            <path d="M1302,60 q5,-4 9,0 q5,-4 9,0" />
          </g>
        )}

        {/* 3. Eyvind Earle Tapered Distant Woodland Trunks */}
        <g>
          <polygon points="228,0 258,0 268,1080 220,1080" fill={pal.trunkMid} />
          <polygon points="304,0 326,0 334,1080 298,1080" fill={pal.trunkFar} />
          <polygon points="368,0 384,0 390,1080 364,1080" fill={pal.trunkFar} opacity="0.65" />

          {/* Right distant trunks kept subtle so top-right HUD stays ultra-clean */}
          <polygon points="1505,0 1528,0 1536,1080 1498,1080" fill={pal.trunkFar} opacity="0.72" />
          <polygon points="1572,0 1606,0 1616,1080 1564,1080" fill={pal.trunkMid} opacity="0.82" />
        </g>

        {/* 4. Daytime / Dawn Angled Sunbeams Filtering Through Left Canopy */}
        {showSunbeams && (
          <g>
            <polygon points="90,0 245,0 920,1080 610,1080" fill="url(#wdSunbeam)" />
            <polygon points="295,0 415,0 1240,1080 995,1080" fill="url(#wdSunbeam)" opacity="0.78" />
            <polygon points="455,0 520,0 1430,1080 1310,1080" fill="url(#wdSunbeam)" opacity="0.48" />
          </g>
        )}

        {/* 5. Drifting Feathered Woodland Mist Clouds */}
        {mistAlpha > 0 && (
          <g>
            <ellipse
              cx="680"
              cy="695"
              rx="860"
              ry="95"
              fill="url(#wdMistRadial)"
              style={animateMist ? { animation: 'woodlandMistA 26s ease-in-out infinite' } : undefined}
            />
            <ellipse
              cx="1260"
              cy="805"
              rx="920"
              ry="105"
              fill="url(#wdMistRadial)"
              style={animateMist ? { animation: 'woodlandMistB 34s ease-in-out infinite' } : undefined}
            />
          </g>
        )}

        {/* 6. Distant Mossy / Frosty / Snowy Woodland Clearing Floor */}
        <path
          d="M0,885 Q540,822 980,890 Q1460,948 1920,860 L1920,1080 L0,1080 Z"
          fill="url(#wdFarHill)"
        />
        {(frosty || snowy) && (
          <path
            d="M0,885 Q540,822 980,890 Q1460,948 1920,860"
            stroke={snowy ? 'rgba(241, 248, 255, 0.78)' : 'rgba(214, 236, 255, 0.42)'}
            strokeWidth={snowy ? '6' : '2.5'}
            fill="none"
          />
        )}
      </svg>
    </div>
  )
})
