import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CHRISTMAS_GIFT_NOTES,
  decemberDayOfMonth,
  getAdventOrnamentCount,
  getDaysUntilChristmas,
  getSantaRouteStop,
  isChristmasDayActive,
  isChristmasEveEvening,
} from '../../lib/decemberMagic'
import { getHolidayOverride, getQueryParam } from '../sky/queryParam'
import type { SkyPhase } from '../sky/skyEngine'

interface WinterVillageStageProps {
  phase: SkyPhase
  paused: boolean
  seasonalDate: Date
  choresAllDone: boolean
  choresDoneCount: number
  choresTotalCount: number
}

// 24 deterministic ornament coordinates on the hero village Christmas tree (base center x=1650, base y=960)
const TREE_ORNAMENTS: Array<{ x: number; y: number; color: string; r: number }> = [
  { x: 1650, y: 695, color: '#ef4444', r: 6.5 },
  { x: 1626, y: 732, color: '#facc15', r: 6 },
  { x: 1672, y: 738, color: '#38bdf8', r: 6 },
  { x: 1648, y: 758, color: '#f43f5e', r: 6.5 },
  { x: 1608, y: 775, color: '#fde047', r: 6.5 },
  { x: 1690, y: 778, color: '#22c55e', r: 6 },
  { x: 1635, y: 796, color: '#e2e8f0', r: 6 },
  { x: 1668, y: 800, color: '#ef4444', r: 6.5 },
  { x: 1588, y: 818, color: '#38bdf8', r: 6.5 },
  { x: 1712, y: 822, color: '#facc15', r: 6.5 },
  { x: 1618, y: 832, color: '#fb7185', r: 6.5 },
  { x: 1654, y: 836, color: '#fde047', r: 7 },
  { x: 1686, y: 840, color: '#ef4444', r: 6.5 },
  { x: 1572, y: 862, color: '#facc15', r: 7 },
  { x: 1605, y: 868, color: '#22c55e', r: 6.5 },
  { x: 1638, y: 874, color: '#38bdf8', r: 7 },
  { x: 1674, y: 874, color: '#f43f5e', r: 7 },
  { x: 1708, y: 868, color: '#e2e8f0', r: 6.5 },
  { x: 1732, y: 862, color: '#ef4444', r: 6.5 },
  { x: 1560, y: 904, color: '#fb7185', r: 7 },
  { x: 1596, y: 912, color: '#fde047', r: 7.5 },
  { x: 1636, y: 916, color: '#ef4444', r: 7 },
  { x: 1678, y: 916, color: '#38bdf8', r: 7 },
  { x: 1720, y: 908, color: '#facc15', r: 7.5 },
]

// 38 crisp Paris Eiffel Tower strobe sparkle points across the tree canopy
const EIFFEL_SPARKLES: Array<{ x: number; y: number; s: number; dur: number; delay: number; gold: boolean }> = [
  { x: 1650, y: 668, s: 1.2, dur: 0.68, delay: 0.05, gold: false },
  { x: 1634, y: 706, s: 0.9, dur: 0.74, delay: 0.22, gold: true },
  { x: 1666, y: 710, s: 1.0, dur: 0.62, delay: 0.48, gold: false },
  { x: 1618, y: 745, s: 1.1, dur: 0.80, delay: 0.12, gold: false },
  { x: 1652, y: 740, s: 0.9, dur: 0.58, delay: 0.35, gold: true },
  { x: 1682, y: 748, s: 1.0, dur: 0.72, delay: 0.61, gold: false },
  { x: 1600, y: 785, s: 1.15, dur: 0.64, delay: 0.18, gold: true },
  { x: 1628, y: 778, s: 0.85, dur: 0.78, delay: 0.41, gold: false },
  { x: 1658, y: 784, s: 1.05, dur: 0.60, delay: 0.08, gold: false },
  { x: 1694, y: 790, s: 0.95, dur: 0.84, delay: 0.52, gold: true },
  { x: 1584, y: 816, s: 1.0, dur: 0.66, delay: 0.29, gold: false },
  { x: 1614, y: 814, s: 1.2, dur: 0.72, delay: 0.64, gold: false },
  { x: 1644, y: 818, s: 0.9, dur: 0.56, delay: 0.14, gold: true },
  { x: 1676, y: 816, s: 1.1, dur: 0.76, delay: 0.38, gold: false },
  { x: 1708, y: 818, s: 0.95, dur: 0.62, delay: 0.55, gold: false },
  { x: 1568, y: 852, s: 1.1, dur: 0.70, delay: 0.04, gold: true },
  { x: 1598, y: 848, s: 0.9, dur: 0.82, delay: 0.33, gold: false },
  { x: 1626, y: 854, s: 1.15, dur: 0.60, delay: 0.58, gold: false },
  { x: 1656, y: 852, s: 1.0, dur: 0.74, delay: 0.20, gold: true },
  { x: 1688, y: 854, s: 1.2, dur: 0.64, delay: 0.46, gold: false },
  { x: 1722, y: 850, s: 0.95, dur: 0.78, delay: 0.11, gold: false },
  { x: 1554, y: 888, s: 1.0, dur: 0.66, delay: 0.37, gold: false },
  { x: 1584, y: 884, s: 1.15, dur: 0.58, delay: 0.62, gold: true },
  { x: 1614, y: 892, s: 0.9, dur: 0.72, delay: 0.16, gold: false },
  { x: 1646, y: 888, s: 1.25, dur: 0.62, delay: 0.44, gold: false },
  { x: 1678, y: 892, s: 0.95, dur: 0.80, delay: 0.26, gold: true },
  { x: 1710, y: 886, s: 1.1, dur: 0.68, delay: 0.50, gold: false },
  { x: 1740, y: 890, s: 0.9, dur: 0.74, delay: 0.07, gold: false },
  { x: 1546, y: 924, s: 1.1, dur: 0.64, delay: 0.31, gold: true },
  { x: 1578, y: 928, s: 0.95, dur: 0.76, delay: 0.54, gold: false },
  { x: 1612, y: 926, s: 1.15, dur: 0.60, delay: 0.19, gold: false },
  { x: 1648, y: 930, s: 1.0, dur: 0.82, delay: 0.42, gold: true },
  { x: 1686, y: 928, s: 1.2, dur: 0.66, delay: 0.09, gold: false },
  { x: 1724, y: 926, s: 0.95, dur: 0.70, delay: 0.36, gold: false },
  { x: 1752, y: 922, s: 1.05, dur: 0.62, delay: 0.59, gold: true },
  { x: 1640, y: 718, s: 0.85, dur: 0.55, delay: 0.27, gold: false },
  { x: 1662, y: 766, s: 0.9, dur: 0.67, delay: 0.49, gold: false },
  { x: 1630, y: 904, s: 1.0, dur: 0.59, delay: 0.13, gold: false },
]

const WINTER_STAGE_CSS = `
.winter-village-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}
.winter-village-stage.is-paused * {
  animation-play-state: paused !important;
}
@keyframes wvAuroraDrift {
  0%, 100% { transform: translate3d(-24px, 0, 0) scaleY(1); opacity: 0.46; }
  50% { transform: translate3d(28px, -10px, 0) scaleY(1.08); opacity: 0.72; }
}
@keyframes wvChimneyPuff {
  0% { transform: translate3d(0, 0, 0) scale(0.5); opacity: 0.62; }
  100% { transform: translate3d(26px, -68px, 0) scale(1.75); opacity: 0; }
}
@keyframes wvStarPulse {
  0%, 100% { opacity: 0.78; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.08); }
}
@keyframes wvEiffelSparkle {
  0%, 72%, 100% { opacity: 0.06; transform: scale(0.35); }
  82% { opacity: 1; transform: scale(1.25); }
  90% { opacity: 0.95; transform: scale(0.92); }
}
@keyframes wvGiftPulse {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(0, -4px, 0) scale(1.05); }
}
.wv-aurora { will-change: transform, opacity; animation: wvAuroraDrift 14s ease-in-out infinite; }
.wv-aurora-2 { will-change: transform, opacity; animation: wvAuroraDrift 19s ease-in-out -7s infinite; }
.wv-smoke-1 { will-change: transform, opacity; animation: wvChimneyPuff 4.6s ease-out infinite; }
.wv-smoke-2 { will-change: transform, opacity; animation: wvChimneyPuff 4.6s ease-out 2.3s infinite; }
.wv-star-glow { transform-box: fill-box; transform-origin: center; animation: wvStarPulse 2.6s ease-in-out infinite; }
.wv-eiffel-glint { transform-box: fill-box; transform-origin: center; will-change: transform, opacity; animation: wvEiffelSparkle var(--sp-dur, 0.7s) ease-in-out var(--sp-del, 0s) infinite; }
.wv-gift-btn { animation: wvGiftPulse 2.4s ease-in-out infinite; }
`

const SKY_PALETTES: Record<SkyPhase, [string, string, string, string]> = {
  dawn: ['#1e294a', '#3f4f7a', '#b57b88', '#f2cba5'],
  day: ['#284b7a', '#4c7fb0', '#8cb8d8', '#dcecf7'],
  dusk: ['#101830', '#242c54', '#5c3c63', '#c67d6b'],
  night: ['#060b18', '#0d1930', '#162844', '#233b5c'],
}

function WinterVillageStageInner({
  phase,
  paused,
  seasonalDate,
  choresAllDone,
  choresDoneCount,
  choresTotalCount,
}: WinterVillageStageProps) {
  const forcedDayRaw = getQueryParam('decday')
  const forcedDay = forcedDayRaw !== null && forcedDayRaw !== '' ? Number(forcedDayRaw) : null
  const forcedHourRaw = getQueryParam('xmashour')
  const forcedHour = forcedHourRaw !== null && forcedHourRaw !== '' ? Number(forcedHourRaw) : null
  const forcedShimmer = getQueryParam('shimmer') === '1'
  const holidayOverride = getHolidayOverride()

  const day = decemberDayOfMonth(seasonalDate, forcedDay)
  const ornamentCount = getAdventOrnamentCount(seasonalDate, forcedDay)
  const daysUntil = getDaysUntilChristmas(seasonalDate, forcedDay)
  const isEve = isChristmasEveEvening(seasonalDate, forcedDay, holidayOverride)
  const isXmasDay = isChristmasDayActive(seasonalDate, forcedDay, holidayOverride)
  const santaStop = getSantaRouteStop(seasonalDate, forcedHour)
  const treeShimmering = choresAllDone || forcedShimmer
  const showStarTopper = isEve || isXmasDay || treeShimmering

  const [openedNote, setOpenedNote] = useState<{ emoji: string; title: string; text: string } | null>(null)
  const [giftIndex, setGiftIndex] = useState(0)

  // Inject CSS once into document head
  useEffect(() => {
    const id = 'nivas-winter-village-css'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = WINTER_STAGE_CSS
      document.head.appendChild(style)
    }
  }, [])

  // Auto-dismiss opened Christmas gift note after 9 seconds
  useEffect(() => {
    if (!openedNote) return
    const t = setTimeout(() => setOpenedNote(null), 9000)
    return () => clearTimeout(t)
  }, [openedNote])

  const sky = SKY_PALETTES[phase]
  const isDark = phase === 'night' || phase === 'dusk'
  const windowGlowOp = isDark ? 0.96 : 0.42
  const snowTint = isDark ? '#cad8ea' : '#f1f6fb'
  const hillBack = isDark ? '#1a2c47' : '#89a7c2'
  const hillMid = isDark ? '#243a59' : '#b7cfe3'
  const snowFront = isDark ? '#344c6b' : '#e2edf7'

  const visibleOrnaments = useMemo(() => TREE_ORNAMENTS.slice(0, ornamentCount), [ornamentCount])

  const handleOpenGift = (e: React.MouseEvent) => {
    e.stopPropagation()
    const note = CHRISTMAS_GIFT_NOTES[giftIndex % CHRISTMAS_GIFT_NOTES.length]
    setGiftIndex((i) => i + 1)
    setOpenedNote(note)
  }

  return (
    <div
      className={`winter-village-stage ${paused ? 'is-paused' : ''}`}
      style={{ zIndex: 1 }}
      aria-hidden={!isXmasDay}
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full block"
      >
        <defs>
          <linearGradient id="wvSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky[0]} />
            <stop offset="38%" stopColor={sky[1]} />
            <stop offset="74%" stopColor={sky[2]} />
            <stop offset="100%" stopColor={sky[3]} />
          </linearGradient>
          <linearGradient id="wvAuroraGrad" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="28%" stopColor="#34d399" stopOpacity="0.42" />
            <stop offset="56%" stopColor="#38bdf8" stopOpacity="0.34" />
            <stop offset="82%" stopColor="#a78bfa" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="wvStarHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wvLampGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Crisp Winter Sky */}
        <rect width="1920" height="1080" fill="url(#wvSkyGrad)" />

        {/* Subtle Starfield & Northern Lights on Dusk / Night */}
        {isDark && (
          <g>
            {[
              [140, 120, 1.5], [290, 88, 1.2], [440, 165, 1.8], [620, 96, 1.4],
              [810, 140, 1.6], [990, 80, 1.3], [1160, 152, 1.7], [1340, 102, 1.5],
              [1510, 134, 1.8], [1690, 90, 1.4], [1820, 160, 1.6], [370, 230, 1.2],
              [720, 210, 1.3], [1240, 220, 1.4], [1580, 215, 1.2],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill="#f8fafc" opacity={phase === 'night' ? 0.85 : 0.45} />
            ))}
            <path
              className="wv-aurora"
              d="M 120 260 Q 520 120 920 220 T 1740 160 L 1740 310 Q 1300 360 880 280 T 120 350 Z"
              fill="url(#wvAuroraGrad)"
            />
            <path
              className="wv-aurora-2"
              d="M 280 210 Q 740 90 1180 210 T 1860 190 L 1860 280 Q 1340 310 920 240 T 280 290 Z"
              fill="url(#wvAuroraGrad)"
              opacity="0.65"
            />
          </g>
        )}

        {/* Distant Alpine Mountains */}
        <path
          d="M 0 860 L 180 650 L 340 760 L 540 600 L 760 770 L 960 635 L 1180 780 L 1410 615 L 1660 760 L 1840 660 L 1920 730 L 1920 1080 L 0 1080 Z"
          fill={hillBack}
        />
        {/* Mountain Snow Caps */}
        <path
          d="M 180 650 L 235 710 L 195 702 L 170 718 L 135 700 Z M 540 600 L 605 675 L 555 660 L 525 680 L 485 660 Z M 960 635 L 1018 700 L 972 688 L 945 702 L 908 688 Z M 1410 615 L 1475 685 L 1425 670 L 1390 688 L 1355 670 Z"
          fill={snowTint}
          opacity="0.72"
        />

        {/* Rolling Mid-Ground Snowy Hills */}
        <path
          d="M 0 885 Q 320 815 680 865 T 1360 855 T 1920 875 L 1920 1080 L 0 1080 Z"
          fill={hillMid}
        />

        {/* Distant Pine Silhouettes */}
        <g fill={isDark ? '#13253b' : '#355c4f'}>
          {[95, 145, 210, 415, 455, 690, 735, 1080, 1125, 1370, 1420, 1465, 1835, 1880].map((tx, idx) => {
            const h = 58 + (idx % 3) * 18
            const y = 875 + (idx % 2) * 14
            return (
              <polygon
                key={tx}
                points={`${tx},${y - h} ${tx - h * 0.34},${y} ${tx + h * 0.34},${y}`}
              />
            )
          })}
        </g>

        {/* Cozy Storybook Village Cottages (Left & Center-Left) */}
        <g>
          {/* Cottage 1 */}
          <g transform="translate(150, 845)">
            <rect x="64" y="-34" width="14" height="32" fill="#5c3a28" />
            <circle className="wv-smoke-1" cx="71" cy="-40" r="8" fill="#e2e8f0" />
            <circle className="wv-smoke-2" cx="74" cy="-42" r="7" fill="#f1f5f9" />
            <rect x="0" y="0" width="96" height="68" rx="3" fill={isDark ? '#3a2b28' : '#7c4d38'} />
            <polygon points="-10,4 48,-40 106,4" fill={isDark ? '#2c1e1b' : '#5c3322'} />
            <path d="M -10 4 L 48 -40 L 106 4 L 96 7 L 48 -29 L 0 7 Z" fill={snowTint} />
            {/* Warm glowing windows */}
            <rect x="16" y="18" width="22" height="24" rx="2" fill="#fbbf24" opacity={windowGlowOp} />
            <rect x="58" y="18" width="22" height="24" rx="2" fill="#fbbf24" opacity={windowGlowOp} />
            <path d="M 27 18 L 27 42 M 16 30 L 38 30 M 69 18 L 69 42 M 58 30 L 80 30" stroke="#451a03" strokeWidth="2" />
            <rect x="41" y="42" width="14" height="26" rx="2" fill="#451a03" />
          </g>

          {/* Cottage 2 (Taller Alpine Chalet) */}
          <g transform="translate(278, 828)">
            <rect x="18" y="-36" width="13" height="34" fill="#475569" />
            <circle className="wv-smoke-1" cx="24" cy="-42" r="7" fill="#e2e8f0" />
            <rect x="0" y="0" width="112" height="86" rx="3" fill={isDark ? '#2f3948' : '#6b7280'} />
            <polygon points="-12,4 56,-48 124,4" fill={isDark ? '#1f2937' : '#374151'} />
            <path d="M -12 4 L 56 -48 L 124 4 L 114 8 L 56 -36 L -2 8 Z" fill={snowTint} />
            <rect x="18" y="16" width="24" height="24" rx="2" fill="#fde047" opacity={windowGlowOp} />
            <rect x="70" y="16" width="24" height="24" rx="2" fill="#fde047" opacity={windowGlowOp} />
            <rect x="44" y="52" width="24" height="34" rx="3" fill="#78350f" />
            <circle cx="56" cy="-16" r="7" fill="#fde047" opacity={windowGlowOp} />
          </g>

          {/* Warm Village Lampposts */}
          {[435, 1475].map((lx) => (
            <g key={lx} transform={`translate(${lx}, 865)`}>
              <rect x="-2.5" y="0" width="5" height="62" fill="#1e293b" />
              <circle cx="0" cy="-4" r="24" fill="url(#wvLampGlow)" opacity={isDark ? 0.95 : 0.35} />
              <circle cx="0" cy="-4" r="5" fill="#fef08a" />
            </g>
          ))}
        </g>

        {/* Foreground Snow Drift */}
        <path
          d="M 0 945 Q 340 905 740 945 T 1460 932 T 1920 950 L 1920 1080 L 0 1080 Z"
          fill={snowFront}
        />

        {/* ================================================================= */}
        {/* HERO 24-DAY GROWING VILLAGE CHRISTMAS TREE (x = 1650, base = 960) */}
        {/* ================================================================= */}
        <g>
          {/* Ground snow shadow */}
          <ellipse cx="1650" cy="968" rx="132" ry="18" fill="#0f172a" opacity="0.28" />
          {/* Trunk */}
          <rect x="1632" y="928" width="36" height="42" rx="4" fill="#5c3317" />

          {/* Layered Evergreen Boughs */}
          <polygon points="1650,655 1572,775 1728,775" fill="#14532d" />
          <polygon points="1650,715 1554,845 1746,845" fill="#166534" />
          <polygon points="1650,775 1536,905 1764,905" fill="#15803d" />
          <polygon points="1650,828 1520,948 1780,948" fill="#14532d" />

          {/* Subtle Warm Fairy Light Garlands */}
          <path
            d="M 1605 742 Q 1650 764 1696 742 M 1582 812 Q 1650 842 1718 812 M 1556 882 Q 1650 916 1744 882"
            stroke="#fde68a"
            strokeWidth="2.2"
            strokeDasharray="3 9"
            strokeLinecap="round"
            fill="none"
            opacity={isDark ? 0.92 : 0.55}
          />

          {/* 1..24 Daily Advent Ornaments */}
          {visibleOrnaments.map((o, idx) => (
            <g key={idx}>
              <circle cx={o.x} cy={o.y} r={o.r} fill={o.color} />
              <circle cx={o.x - o.r * 0.3} cy={o.y - o.r * 0.3} r={o.r * 0.28} fill="#ffffff" opacity="0.72" />
            </g>
          ))}

          {/* Golden Star Topper (glows on Christmas Eve, Christmas Day, or when daily chores are complete!) */}
          {showStarTopper && (
            <g transform="translate(1650, 648)">
              <g className="wv-star-glow">
                <circle cx="0" cy="0" r="36" fill="url(#wvStarHalo)" />
                <polygon
                  points="0,-20 5,-6 20,-6 8,3 12,18 0,9 -12,18 -8,3 -20,-6 -5,-6"
                  fill="#fef08a"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                />
              </g>
            </g>
          )}

          {/* PARIS EIFFEL TOWER SHIMMER — Active when kids complete all daily chores! */}
          {treeShimmering && (
            <g>
              {EIFFEL_SPARKLES.map((sp, i) => (
                <g
                  key={i}
                  transform={`translate(${sp.x}, ${sp.y})`}
                >
                  <path
                    className="wv-eiffel-glint"
                    style={
                      {
                        '--sp-dur': `${sp.dur}s`,
                        '--sp-del': `${sp.delay}s`,
                      } as React.CSSProperties
                    }
                    d={`M 0 ${-11 * sp.s} L ${2.2 * sp.s} ${-2.2 * sp.s} L ${11 * sp.s} 0 L ${2.2 * sp.s} ${2.2 * sp.s} L 0 ${11 * sp.s} L ${-2.2 * sp.s} ${2.2 * sp.s} L ${-11 * sp.s} 0 L ${-2.2 * sp.s} ${-2.2 * sp.s} Z`}
                    fill={sp.gold ? '#fef08a' : '#ffffff'}
                  />
                </g>
              ))}
            </g>
          )}

          {/* Daily Chore Reward Gift tucked under tree when chores are complete */}
          {treeShimmering && !isXmasDay && (
            <g transform="translate(1585, 936)">
              <rect x="0" y="0" width="32" height="28" rx="3" fill="#dc2626" />
              <rect x="13" y="0" width="6" height="28" fill="#facc15" />
              <rect x="0" y="11" width="32" height="6" fill="#facc15" />
            </g>
          )}

          {/* Christmas Day Full Pile of Presents Under the Tree */}
          {isXmasDay && (
            <g>
              <g transform="translate(1542, 932)">
                <rect x="0" y="0" width="42" height="36" rx="4" fill="#dc2626" />
                <rect x="17" y="0" width="8" height="36" fill="#facc15" />
                <rect x="0" y="14" width="42" height="7" fill="#facc15" />
              </g>
              <g transform="translate(1590, 942)">
                <rect x="0" y="0" width="36" height="28" rx="4" fill="#2563eb" />
                <rect x="14" y="0" width="7" height="28" fill="#f8fafc" />
                <rect x="0" y="11" width="36" height="6" fill="#f8fafc" />
              </g>
              <g transform="translate(1668, 934)">
                <rect x="0" y="0" width="46" height="34" rx="4" fill="#16a34a" />
                <rect x="19" y="0" width="8" height="34" fill="#ef4444" />
                <rect x="0" y="13" width="46" height="7" fill="#ef4444" />
              </g>
              <g transform="translate(1720, 944)">
                <rect x="0" y="0" width="34" height="26" rx="4" fill="#d97706" />
                <rect x="14" y="0" width="6" height="26" fill="#fef08a" />
                <rect x="0" y="10" width="34" height="5" fill="#fef08a" />
              </g>
            </g>
          )}

          {/* Christmas Eve (full) vs Christmas Morning (empty + crumbs!) Milk & Cookies */}
          {(isEve || isXmasDay) && (
            <g transform="translate(1488, 944)">
              {/* Wooden stool/tray */}
              <rect x="-8" y="16" width="66" height="8" rx="3" fill="#78350f" />
              {/* Plate */}
              <ellipse cx="14" cy="14" rx="18" ry="5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
              {isEve ? (
                <>
                  {/* 3 fresh chocolate-chip cookies */}
                  <circle cx="8" cy="12" r="5" fill="#b45309" />
                  <circle cx="19" cy="12" r="5" fill="#c26312" />
                  <circle cx="13" cy="8" r="5" fill="#d97706" />
                  <circle cx="12" cy="7" r="1" fill="#451a03" />
                  <circle cx="15" cy="9" r="1" fill="#451a03" />
                  {/* Full glass of milk */}
                  <rect x="36" y="-4" width="14" height="20" rx="2" fill="#e2e8f0" opacity="0.5" stroke="#cbd5e1" />
                  <rect x="37" y="1" width="12" height="14" rx="1" fill="#ffffff" />
                </>
              ) : (
                <>
                  {/* Cookie crumbs — Santa was here! */}
                  <circle cx="8" cy="14" r="1.4" fill="#92400e" />
                  <circle cx="15" cy="13" r="1.8" fill="#b45309" />
                  <circle cx="21" cy="14" r="1.2" fill="#78350f" />
                  {/* Empty milk glass */}
                  <rect x="36" y="-4" width="14" height="20" rx="2" fill="#e2e8f0" opacity="0.35" stroke="#cbd5e1" />
                  <rect x="37" y="13" width="12" height="2" fill="#ffffff" opacity="0.7" />
                </>
              )}
            </g>
          )}
        </g>
      </svg>

      {/* Bottom-Left Editorial Pill: Advent Countdown / Santa Tracker / Merry Christmas */}
      <div
        className="absolute bottom-[20px] left-[28px] z-30 flex items-center gap-3 px-4 py-2 rounded-full pointer-events-none select-none"
        style={{
          background: 'rgba(12, 18, 28, 0.80)',
          border: treeShimmering
            ? '1px solid rgba(254, 240, 138, 0.55)'
            : '1px solid rgba(212, 173, 82, 0.30)',
          color: '#f5efe6',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.42)',
        }}
      >
        {isXmasDay ? (
          <>
            <span>🎄 MERRY CHRISTMAS!</span>
            <span className="text-amber-200/90 font-normal normal-case tracking-normal">
              Santa finished the cookies!
            </span>
          </>
        ) : isEve ? (
          <>
            <span>{santaStop.emoji} SANTA TRACKER · {santaStop.label}</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: santaStop.total }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === santaStop.idx ? '16px' : '5px',
                    height: '5px',
                    borderRadius: '999px',
                    background:
                      i === santaStop.idx
                        ? '#fde047'
                        : i < santaStop.idx
                          ? 'rgba(253, 224, 71, 0.55)'
                          : 'rgba(255, 255, 255, 0.22)',
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <span>
              🎄 {daysUntil === 1 ? 'CHRISTMAS EVE!' : `${daysUntil} DAYS UNTIL CHRISTMAS`}
            </span>
            <span className="text-white/60">·</span>
            <span className="text-amber-200/90">{ornamentCount}/24 ornaments</span>
          </>
        )}

        {treeShimmering && (
          <>
            <span className="text-white/50">·</span>
            <span className="text-amber-200">
              ✨ {choresTotalCount > 0 ? `Chores ${choresDoneCount}/${choresTotalCount} · ` : ''}Tree Sparkling!
            </span>
          </>
        )}
      </div>

      {/* Christmas Day Interactive Tap-to-Open Gift Button */}
      {isXmasDay && (
        <button
          type="button"
          onClick={handleOpenGift}
          className="wv-gift-btn pointer-events-auto cursor-pointer absolute bottom-[22px] right-[290px] z-30 flex items-center gap-2 px-4 py-2 rounded-full text-amber-50 font-semibold text-xs tracking-wide shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            border: '1px solid rgba(254, 240, 138, 0.55)',
          }}
        >
          <span>🎁</span>
          <span>Tap for a Christmas Surprise!</span>
        </button>
      )}

      {/* Christmas Day Opened Gift Surprise Card */}
      <AnimatePresence>
        {openedNote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.28 }}
            onClick={(e) => {
              e.stopPropagation()
              setOpenedNote(null)
            }}
            className="pointer-events-auto cursor-pointer absolute bottom-[84px] right-[290px] z-40 max-w-[360px] rounded-2xl p-4 text-amber-50 shadow-2xl"
            style={{
              background: 'rgba(18, 25, 38, 0.92)',
              border: '1.5px solid rgba(253, 224, 71, 0.55)',
            }}
          >
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm mb-1">
              <span className="text-xl">{openedNote.emoji}</span>
              <span>{openedNote.title}</span>
            </div>
            <p className="text-sm leading-snug text-amber-50/95">{openedNote.text}</p>
            <div className="text-[10px] text-amber-200/60 mt-2">Tap to close</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const WinterVillageStage = React.memo(WinterVillageStageInner)
