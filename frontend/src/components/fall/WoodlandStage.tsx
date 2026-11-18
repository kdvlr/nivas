import React, { useCallback, useEffect, useRef, useState } from 'react'
import { playBalloonPopSound } from '../../lib/useAudioChime'
import { getQueryParam } from '../sky/queryParam'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import type { Quality } from '../sky/useQuality'
import {
  canopyDensity,
  dayHash,
  deriveWoodlandMood,
  fallDayOfMonth,
  hollowAcornCount,
  isThanksgivingDay,
  todayKey,
} from './fallDates'
import {
  pickWoodlandVignette,
  VIGNETTE_DURATIONS_MS,
  type WoodlandVignette,
} from '../../lib/woodlandVignettes'
import {
  completesFeed,
  eligibleTgInterludes,
  feastGuests,
  feastStage,
  FEED_GOAL,
  hiddenTurkeySpot,
  interludeCooldownMs,
  newestGuest,
  pickTgInterlude,
  sleepsUntilFeast,
  TG_INTERLUDE_MS,
  tgDaySegment,
  type TgDaySegment,
  type TgInterlude,
} from '../../lib/thanksgivingWeek'
import {
  AcornFootball,
  ConfettiBurst,
  CountdownSign,
  FeastTable,
  FeedAcorns,
  HIDE_SPOT_GEOMETRY,
  HiddenTurkey,
  LeafTornado,
  ParadeBalloon,
  PieToss,
  TG_CSS,
  tableTurkeyPos,
  ThankfulTree,
  THANKFUL_TREE_SLOTS,
  TurkeyDance,
  TurkeyTrotParade,
  type FallingAcorn,
} from './ThanksgivingFeast'
import {
  AcornDropCameo,
  CottontailBunny,
  FireflyDance,
  FoxDenScene,
  FoxSquirrelChase,
  GouacheMapleLeaf,
  GouacheOakLeaf,
  HollowScene,
  OwlNightFlight,
  ScamperingSquirrel,
  SquirrelTreeSortie,
  WoodlandOwl,
  WoodpeckerCameo,
} from './WoodlandCritters'

export interface GratitudeNote {
  text: string
  author?: string
}

const WOODLAND_CSS = `
@keyframes wdBreathe {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.02, 0.975); }
}
@keyframes wdBlink {
  0%, 92%, 100% { transform: scaleY(1); }
  96% { transform: scaleY(0.08); }
}
@keyframes wdHoot {
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-6px) scale(1.08); }
  65% { transform: translateY(-3px) scale(1.04); }
}
@keyframes wdBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  35% { transform: translateY(-10px) scale(1.08); }
  70% { transform: translateY(-3px) scale(1.03); }
}
@keyframes wdTail {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(7deg); }
}
@keyframes wdTailWindy {
  0%, 100% { transform: rotate(-14deg); }
  50% { transform: rotate(16deg); }
}
@keyframes wdTailFast {
  0%, 100% { transform: rotate(-16deg); }
  25% { transform: rotate(18deg); }
  50% { transform: rotate(-14deg); }
  75% { transform: rotate(16deg); }
}
@keyframes wdBoughSway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(1.1deg); }
}
@keyframes wdBoughWindy {
  0%, 100% { transform: rotate(-1.2deg); }
  50% { transform: rotate(3.2deg); }
}
@keyframes wdGarlandSway {
  0%, 100% { transform: rotate(-0.8deg); }
  50% { transform: rotate(1.2deg); }
}
@keyframes wdGarlandWindy {
  0%, 100% { transform: rotate(-3.5deg); }
  50% { transform: rotate(4.5deg); }
}
@keyframes wdLanternTwinkle {
  0%, 100% { opacity: 0.82; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.05); }
}
@keyframes wdRipple {
  0% { transform: scale(0.25); opacity: 0.85; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes wdBreath {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  25% { opacity: 0.75; }
  70% { transform: translate(8px, -10px) scale(1.35); opacity: 0; }
  100% { opacity: 0; }
}
@keyframes wdClimb {
  0% { transform: translate(158px, 920px) scale(1, 1); opacity: 0; }
  8% { opacity: 1; }
  42% { transform: translate(150px, 505px) scale(1, 1); opacity: 1; }
  56% { transform: translate(136px, 495px) scale(0.9, 0.9); opacity: 0.85; }
  62% { transform: translate(154px, 515px) scale(1, -1); opacity: 1; }
  92% { opacity: 1; }
  100% { transform: translate(162px, 935px) scale(1, -1); opacity: 0; }
}
@keyframes wdPeck {
  0%, 100% { transform: rotate(0deg); }
  20%, 60% { transform: rotate(15deg); }
  40%, 80% { transform: rotate(-4deg); }
}
@keyframes wdWoodpeckerFlight {
  0% { transform: translate(1420px, 285px) rotate(12deg); opacity: 0; }
  8% { opacity: 1; }
  22% { transform: translate(1772px, 468px) rotate(0deg); opacity: 1; }
  76% { transform: translate(1772px, 468px) rotate(0deg); opacity: 1; }
  79% { transform: translate(1746px, 450px) scale(-1, 1) rotate(10deg); opacity: 1; }
  92% { transform: translate(1540px, 315px) scale(-1, 1) rotate(14deg); opacity: 1; }
  100% { transform: translate(1380px, 240px) scale(-1, 1) rotate(18deg); opacity: 0; }
}
@keyframes wdPeckerWings {
  0%, 24%, 75%, 100% { transform: scaleY(0.25); }
  6%, 12%, 18%, 81%, 87%, 93% { transform: scaleY(1.1); }
  9%, 15%, 84%, 90%, 96% { transform: scaleY(-0.65); }
}
@keyframes wdPeckSparks {
  0%, 24%, 76%, 100% { opacity: 0; }
  28%, 40%, 52%, 64% { opacity: 0.9; }
  34%, 46%, 58%, 70% { opacity: 0.2; }
}
@keyframes wdOwlFlight {
  0% { transform: translate(238px, 174px) scale(1); }
  12% { transform: translate(420px, 128px) rotate(-8deg) scale(1.04); }
  30% { transform: translate(860px, 168px) rotate(4deg) scale(1.08); }
  48% { transform: translate(1240px, 124px) rotate(-6deg) scale(0.95); }
  62% { transform: translate(1160px, 210px) scale(-0.95, 0.95) rotate(-8deg); }
  82% { transform: translate(580px, 152px) scale(-1.02, 1.02) rotate(4deg); }
  95% { transform: translate(265px, 168px) scale(1) rotate(-4deg); }
  100% { transform: translate(238px, 174px) scale(1) rotate(0deg); }
}
@keyframes wdOwlWingL {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(22deg); }
  75% { transform: rotate(-16deg); }
}
@keyframes wdOwlWingR {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-22deg); }
  75% { transform: rotate(16deg); }
}
@keyframes wdHopBob {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-9px) rotate(-6deg); }
}
@keyframes wdSortieSquirrel {
  0% { transform: translate(116px, 488px) scale(0.75, 0.75); opacity: 0; }
  5% { transform: translate(136px, 496px) scale(0.95, 0.95); opacity: 1; }
  12% { transform: translate(152px, 540px) rotate(68deg); opacity: 1; }
  26% { transform: translate(172px, 825px) rotate(62deg); }
  36% { transform: translate(232px, 974px) rotate(12deg); }
  48% { transform: translate(365px, 1004px) rotate(0deg); }
  54% { transform: translate(432px, 1006px) rotate(4deg); }
  59% { transform: translate(432px, 1006px) scale(-1, 1); }
  70% { transform: translate(242px, 978px) scale(-1, 1) rotate(14deg); }
  80% { transform: translate(174px, 820px) scale(-1, 1) rotate(72deg); }
  92% { transform: translate(148px, 530px) scale(-1, 1) rotate(76deg); opacity: 1; }
  97% { transform: translate(118px, 490px) scale(-0.8, 0.8); opacity: 0.7; }
  100% { transform: translate(114px, 488px) scale(-0.7, 0.7); opacity: 0; }
}
@keyframes wdSortieAcorn {
  0%, 4% { opacity: 0; transform: scale(0.6); }
  10%, 52% { opacity: 1; transform: scale(1); }
  56%, 100% { opacity: 0; transform: scale(0.5); }
}
@keyframes wdChaseSquirrel {
  0% { transform: translate(118px, 488px) scale(0.75, 0.75); opacity: 0; }
  4% { transform: translate(144px, 512px) rotate(68deg); opacity: 1; }
  14% { transform: translate(172px, 820px) rotate(64deg); }
  22% { transform: translate(248px, 982px) rotate(8deg); }
  30% { transform: translate(480px, 1006px) rotate(0deg); }
  35% { transform: translate(652px, 1010px) rotate(0deg); }
  38% { transform: translate(652px, 980px) scale(-1, 1) rotate(-8deg); }
  44% { transform: translate(510px, 1004px) scale(-1, 1); }
  52% { transform: translate(236px, 968px) scale(-1, 1) rotate(16deg); }
  61% { transform: translate(168px, 710px) scale(-1, 1) rotate(78deg); }
  68% { transform: translate(154px, 440px) scale(-1, 1) rotate(82deg); }
  74% { transform: translate(212px, 224px) scale(1, 1) rotate(0deg); }
  84% { transform: translate(212px, 224px) scale(1, 1) rotate(-4deg); }
  92% { transform: translate(152px, 380px) scale(-1, 1) rotate(-78deg); opacity: 1; }
  97% { transform: translate(122px, 486px) scale(-0.8, 0.8); opacity: 0.75; }
  100% { transform: translate(118px, 488px) scale(-0.7, 0.7); opacity: 0; }
}
@keyframes wdChaseSpark {
  0%, 34% { opacity: 0; transform: scale(0.3); }
  37% { opacity: 1; transform: scale(1.12); }
  45% { opacity: 1; transform: scale(1); }
  49%, 100% { opacity: 0; transform: scale(0.6); }
}
@keyframes wdChaseFox {
  0% { transform: translate(1698px, 968px) scale(1, 1); opacity: 1; }
  22% { transform: translate(1690px, 970px) scale(1, 1); }
  26% { transform: translate(1650px, 974px) scale(1.04, 0.92); }
  34% { transform: translate(1360px, 992px) scale(1, 1); }
  42% { transform: translate(1020px, 1004px) scale(1, 1); }
  50% { transform: translate(670px, 1006px) scale(1, 1); }
  58% { transform: translate(345px, 990px) scale(1, 1); }
  62%, 75% { transform: translate(332px, 990px) rotate(16deg); }
  78% { transform: translate(332px, 990px) scale(-1, 1); }
  88% { transform: translate(1020px, 1004px) scale(-1, 1); }
  97% { transform: translate(1690px, 970px) scale(-1, 1); }
  100% { transform: translate(1698px, 968px) scale(1, 1); opacity: 1; }
}
@keyframes wdFoxGallop {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(4deg); }
}
@keyframes wdBunnyPath {
  0% { transform: translate(200px, 1034px) scale(0.9, 0.9); opacity: 0; }
  8% { transform: translate(250px, 1024px) scale(1, 1); opacity: 1; }
  26% { transform: translate(395px, 1022px) scale(1, 1); }
  42% { transform: translate(540px, 1020px) scale(1, 1); }
  56% { transform: translate(540px, 1020px) scale(1, 1); }
  60% { transform: translate(540px, 1020px) scale(-1, 1); }
  78% { transform: translate(375px, 1022px) scale(-1, 1); }
  93% { transform: translate(238px, 1028px) scale(-1, 1); opacity: 1; }
  100% { transform: translate(195px, 1036px) scale(-0.9, 0.9); opacity: 0; }
}
@keyframes wdBunnyHop {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
}
@keyframes wdBunnyEars {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(8deg); }
  70% { transform: rotate(-6deg); }
}
@keyframes wdAcornDrop {
  0% { transform: translate(344px, 118px) rotate(0deg); opacity: 0; }
  8% { transform: translate(344px, 126px) rotate(12deg); opacity: 1; }
  48% { transform: translate(352px, 1010px) rotate(160deg); opacity: 1; }
  58% { transform: translate(360px, 974px) rotate(215deg); opacity: 1; }
  68% { transform: translate(368px, 1012px) rotate(270deg); opacity: 1; }
  76% { transform: translate(374px, 996px) rotate(310deg); opacity: 1; }
  84% { transform: translate(380px, 1014px) rotate(345deg); opacity: 0.95; }
  100% { transform: translate(386px, 1016px) rotate(365deg); opacity: 0; }
}
@keyframes wdFirefly1 {
  0% { transform: translate(190px, 930px) scale(0.7); opacity: 0; }
  20% { transform: translate(265px, 895px) scale(1.05); opacity: 0.95; }
  50% { transform: translate(340px, 945px) scale(0.85); opacity: 0.55; }
  80% { transform: translate(235px, 972px) scale(1.1); opacity: 0.95; }
  100% { transform: translate(190px, 930px) scale(0.7); opacity: 0; }
}
@keyframes wdFirefly2 {
  0% { transform: translate(430px, 985px) scale(0.8); opacity: 0; }
  25% { transform: translate(520px, 942px) scale(1.1); opacity: 0.9; }
  55% { transform: translate(465px, 905px) scale(0.75); opacity: 0.5; }
  85% { transform: translate(385px, 956px) scale(1); opacity: 0.9; }
  100% { transform: translate(430px, 985px) scale(0.8); opacity: 0; }
}
@keyframes wdFirefly3 {
  0% { transform: translate(1480px, 970px) scale(0.7); opacity: 0; }
  30% { transform: translate(1560px, 920px) scale(1.1); opacity: 0.95; }
  60% { transform: translate(1640px, 958px) scale(0.8); opacity: 0.5; }
  88% { transform: translate(1545px, 995px) scale(1.05); opacity: 0.9; }
  100% { transform: translate(1480px, 970px) scale(0.7); opacity: 0; }
}
@keyframes wdFirefly4 {
  0% { transform: translate(135px, 845px) scale(0.8); opacity: 0; }
  30% { transform: translate(210px, 822px) scale(1.05); opacity: 0.9; }
  65% { transform: translate(290px, 865px) scale(0.8); opacity: 0.45; }
  90% { transform: translate(185px, 882px) scale(1); opacity: 0.85; }
  100% { transform: translate(135px, 845px) scale(0.8); opacity: 0; }
}
@keyframes wdFirefly5 {
  0% { transform: translate(920px, 995px) scale(0.75); opacity: 0; }
  30% { transform: translate(990px, 955px) scale(1.05); opacity: 0.88; }
  65% { transform: translate(1065px, 990px) scale(0.8); opacity: 0.48; }
  90% { transform: translate(965px, 1005px) scale(1); opacity: 0.85; }
  100% { transform: translate(920px, 995px) scale(0.75); opacity: 0; }
}
@keyframes wdCardFloat {
  0% { transform: translate3d(-50%, -22px, 0) rotate(-1.5deg); opacity: 0; }
  12% { transform: translate3d(-50%, 0px, 0) rotate(0.6deg); opacity: 1; }
  88% { transform: translate3d(-50%, 4px, 0) rotate(-0.4deg); opacity: 1; }
  100% { transform: translate3d(-50%, -14px, 0) rotate(0.8deg); opacity: 0; }
}
@keyframes wdToastPop {
  0% { transform: translate3d(-50%, 10px, 0) scale(0.92); opacity: 0; }
  14% { transform: translate3d(-50%, 0, 0) scale(1); opacity: 1; }
  84% { transform: translate3d(-50%, 0, 0) scale(1); opacity: 1; }
  100% { transform: translate3d(-50%, -8px, 0) scale(0.96); opacity: 0; }
}

.wd-breathe { animation: wdBreathe 4.6s ease-in-out infinite; }
.wd-blink { animation: wdBlink 5.8s ease-in-out infinite; }
.wd-hoot { animation: wdHoot 0.9s ease-out 1; }
.wd-bounce { animation: wdBounce 0.85s ease-out 1; }
.wd-tail { animation: wdTail 3.6s ease-in-out infinite; }
.wd-tail-windy { animation: wdTailWindy 1.4s ease-in-out infinite; }
.wd-tail-fast { animation: wdTailFast 0.8s ease-in-out 2; }
.wd-bough { transform-origin: 0px 40px; animation: wdBoughSway 7.5s ease-in-out infinite; }
.wd-bough-windy { transform-origin: 0px 40px; animation: wdBoughWindy 2.7s ease-in-out infinite; }
.wd-garland { transform-origin: 205px 880px; animation: wdGarlandSway 5.5s ease-in-out infinite; }
.wd-garland-windy { transform-origin: 205px 880px; animation: wdGarlandWindy 2.1s ease-in-out infinite; }
.wd-climber { animation: wdClimb 8.4s ease-in-out both; }
.wd-peck { animation: wdPeck 0.4s ease-in-out 1.45s 8; }
.wd-woodpecker-flight { animation: wdWoodpeckerFlight 6.2s ease-in-out both; }
.wd-pecker-wings { animation: wdPeckerWings 6.2s ease-in-out both; }
.wd-peck-sparks { animation: wdPeckSparks 6.2s linear both; }
.wd-owl-flight { animation: wdOwlFlight 8.8s ease-in-out both; }
.wd-owl-wing-l { animation: wdOwlWingL 0.68s ease-in-out infinite; }
.wd-owl-wing-r { animation: wdOwlWingR 0.68s ease-in-out infinite; }
.wd-breath { animation: wdBreath 4.2s ease-out infinite; }
.wd-hop-bob { animation: wdHopBob 0.38s ease-in-out infinite; }
.wd-sortie-squirrel { animation: wdSortieSquirrel 9.4s ease-in-out both; }
.wd-sortie-acorn { animation: wdSortieAcorn 9.4s linear both; }
.wd-chase-squirrel { animation: wdChaseSquirrel 10.6s ease-in-out both; }
.wd-chase-spark { transform-box: fill-box; transform-origin: center; animation: wdChaseSpark 10.6s ease-out both; }
.wd-chase-fox { animation: wdChaseFox 10.6s ease-in-out both; }
.wd-fox-gallop { animation: wdFoxGallop 0.34s ease-in-out infinite; }
.wd-bunny-path { animation: wdBunnyPath 8.2s ease-in-out both; }
.wd-bunny-hop { animation: wdBunnyHop 0.48s ease-in-out 10; }
.wd-bunny-ears { animation: wdBunnyEars 1.4s ease-in-out infinite; }
.wd-acorn-drop { animation: wdAcornDrop 4.2s ease-in both; }
.wd-firefly-1 { animation: wdFirefly1 9.6s ease-in-out both; }
.wd-firefly-2 { animation: wdFirefly2 9.6s ease-in-out 0.5s both; }
.wd-firefly-3 { animation: wdFirefly3 9.6s ease-in-out 0.9s both; }
.wd-firefly-4 { animation: wdFirefly4 9.6s ease-in-out 0.3s both; }
.wd-firefly-5 { animation: wdFirefly5 9.6s ease-in-out 0.7s both; }

.wd-static * {
  animation-play-state: paused !important;
}
`

function readIdx(): number {
  try {
    return Number(localStorage.getItem('nivas_gratitude_idx')) || 0
  } catch {
    return 0
  }
}

function writeIdx(n: number) {
  try {
    localStorage.setItem('nivas_gratitude_idx', String(n))
  } catch {}
}

function readDailyCount(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function writeDailyCount(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n))
  } catch {}
}

const TG_INTERLUDE_KINDS: TgInterlude[] = ['parade', 'leaf_tornado', 'balloon', 'pie_toss', 'football', 'turkey_dance']
const TG_SEGMENTS: TgDaySegment[] = ['parade', 'game', 'feast', 'coma']

/** SVG-unit hit box → % positioned tap zone (stage SVG uses preserveAspectRatio="none"). */
function svgBox(cx: number, cy: number, w: number, h: number): React.CSSProperties {
  return {
    left: `${((cx - w / 2) / 1920) * 100}%`,
    top: `${((cy - h / 2) / 1080) * 100}%`,
    width: `${(w / 1920) * 100}%`,
    height: `${(h / 1080) * 100}%`,
  }
}

function getBarkColors(phase: SkyPhase, snowy: boolean) {
  if (phase === 'night') {
    return {
      dark: '#110d0e',
      mid: '#21191b',
      light: '#32272a',
      rim: snowy ? 'rgba(226, 240, 255, 0.48)' : 'rgba(186, 214, 255, 0.28)',
      floorTop: snowy ? '#cfdbe8' : '#1b221a',
      floorBot: snowy ? '#64788f' : '#0b0e0b',
      moss: snowy ? '#cbd5e1' : '#2b3d22',
    }
  }
  if (phase === 'dusk') {
    return {
      dark: '#1c110a',
      mid: '#362013',
      light: '#4f301d',
      rim: 'rgba(251, 191, 36, 0.30)',
      floorTop: snowy ? '#dbe7f3' : '#332b1c',
      floorBot: snowy ? '#7c90a6' : '#17110b',
      moss: snowy ? '#e2e8f0' : '#3f5228',
    }
  }
  return {
    dark: '#24150c',
    mid: '#442817',
    light: '#5e3821',
    rim: phase === 'dawn' ? 'rgba(253, 186, 116, 0.34)' : 'rgba(254, 240, 138, 0.32)',
    floorTop: snowy ? '#eef5fb' : '#453b22',
    floorBot: snowy ? '#9cb0c4' : '#1f180e',
    moss: snowy ? '#f1f5f9' : '#4d662e',
  }
}

export const WoodlandStage = React.memo(function WoodlandStage({
  phase,
  kind,
  date,
  quality,
  paused,
  thanksgivingWeek,
  frosty,
  windy,
  notes,
  onInteract,
  photoTick = 0,
  videoSlide = false,
}: {
  phase: SkyPhase
  kind: SkyKind
  date: Date
  quality: Quality
  paused: boolean
  thanksgivingWeek: boolean
  frosty: boolean
  windy: boolean
  notes: GratitudeNote[]
  onInteract: () => void
  /** Increments whenever the slideshow advances to a new photo (interludes ride the transition). */
  photoTick?: number
  /** True while a video slide is on screen — show-time interludes hold off. */
  videoSlide?: boolean
}) {
  const snowy = kind === 'snowy'
  const mood = deriveWoodlandMood(phase, kind)
  const bark = getBarkColors(phase, snowy)
  const density = canopyDensity(date)
  const acornCount = hollowAcornCount(date)
  const isStatic = paused

  // ── Great Woodland Feast (Thanksgiving week storyline) ──
  // ?fallday=N previews any day of the week; ?holiday=thanksgiving alone previews the big day.
  const previewDay = getQueryParam('fallday') !== null
  const sleeps =
    date.getMonth() === 10 || previewDay
      ? sleepsUntilFeast(date.getFullYear(), fallDayOfMonth(date))
      : isThanksgivingDay(date)
        ? 0
        : 3
  const tgDay = previewDay ? sleeps === 0 : isThanksgivingDay(date) || sleeps === 0
  const feastSleeps = tgDay ? 0 : sleeps
  const forcedSegment = getQueryParam('tgseg') as TgDaySegment | null
  const segment: TgDaySegment | null = tgDay
    ? forcedSegment && TG_SEGMENTS.includes(forcedSegment)
      ? forcedSegment
      : tgDaySegment(new Date().getHours())
    : null
  const stage = feastStage(feastSleeps)
  const guests = feastGuests(feastSleeps)
  const arriving = newestGuest(feastSleeps)
  const leftovers = feastSleeps < 0
  const guestsSleepy = segment === 'coma' || phase === 'night'
  const hideAndSeek = thanksgivingWeek && feastSleeps > 0
  const dayKey = todayKey(date)
  const lowQuality = quality === 'low'

  // Periodic ambient woodland cameos (squirrel sortie, fox chase, bunny, woodpecker, acorn drop, fireflies, turkey)
  const [climberRun, setClimberRun] = useState<number | null>(null)
  const [activeVignette, setActiveVignette] = useState<{
    kind: WoodlandVignette
    id: number
  } | null>(null)
  const activeVignetteRef = useRef<WoodlandVignette | null>(null)
  const lastVignetteRef = useRef<WoodlandVignette | null>(null)
  const clearVignetteTimer = useRef<ReturnType<typeof setTimeout>>()

  // Show-time interludes share the stage with vignettes but never overlap them.
  const [interlude, setInterlude] = useState<{ kind: TgInterlude; id: number } | null>(null)
  const interludeRef = useRef<TgInterlude | null>(null)

  const launchVignette = useCallback((v: WoodlandVignette) => {
    const duration = VIGNETTE_DURATIONS_MS[v]
    lastVignetteRef.current = v
    activeVignetteRef.current = v
    setActiveVignette({ kind: v, id: Date.now() })
    clearTimeout(clearVignetteTimer.current)
    clearVignetteTimer.current = setTimeout(() => {
      activeVignetteRef.current = null
      setActiveVignette(null)
    }, duration)
  }, [])

  useEffect(() => {
    if (isStatic) {
      setClimberRun(null)
      activeVignetteRef.current = null
      setActiveVignette(null)
      clearTimeout(clearVignetteTimer.current)
      return
    }
    const forced = getQueryParam('woodland')
    let forcedTimer: ReturnType<typeof setTimeout> | undefined
    let clearClimb: ReturnType<typeof setTimeout> | undefined

    if (forced === 'climb') {
      forcedTimer = setTimeout(() => {
        setClimberRun(Date.now())
        clearClimb = setTimeout(() => setClimberRun(null), 8_600)
      }, 600)
    } else if (
      forced === 'chase' ||
      forced === 'sortie' ||
      forced === 'bunny' ||
      forced === 'peck' ||
      forced === 'acorn_drop' ||
      forced === 'fireflies' ||
      forced === 'owl_flight'
    ) {
      forcedTimer = setTimeout(() => launchVignette(forced), 600)
    }

    const triggerNext = (preferFirst = false) => {
      if (document.hidden || activeVignetteRef.current !== null || interludeRef.current !== null) return
      const picked = preferFirst
        ? pickWoodlandVignette(phase, kind, 'acorn_drop', () => 0)
        : pickWoodlandVignette(phase, kind, lastVignetteRef.current)
      if (!picked) return
      launchVignette(picked)
    }

    // Show the first woodland cameo shortly after opening (3.5s) so it's easy to spot,
    // then cycle another cameo every 26 seconds without being blocked by sky geese.
    const firstCheck = setTimeout(() => triggerNext(true), 3_500)
    const vignetteLoop = setInterval(() => triggerNext(false), 26_000)

    return () => {
      clearTimeout(forcedTimer)
      clearTimeout(clearClimb)
      clearTimeout(clearVignetteTimer.current)
      clearTimeout(firstCheck)
      clearInterval(vignetteLoop)
    }
  }, [isStatic, kind, phase, launchVignette])

  // Interactive tap states
  const [hoot, setHoot] = useState(false)
  const [squirrelExcited, setSquirrelExcited] = useState(false)
  const [foxWagged, setFoxWagged] = useState(false)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const popToast = useCallback((text: string) => {
    clearTimeout(toastTimer.current)
    setToast({ text, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2_800)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // ── Great Woodland Feast: show-time interludes (parade, leaf tornado, balloon, pie toss, football) ──
  const lastInterludeRef = useRef<TgInterlude | null>(null)
  const lastInterludeAt = useRef(0)
  const interludeTimer = useRef<ReturnType<typeof setTimeout>>()
  const tgSceneRef = useRef({ phase, kind, segment, lowQuality, videoSlide, enabled: false })
  tgSceneRef.current = { phase, kind, segment, lowQuality, videoSlide, enabled: thanksgivingWeek && !isStatic }

  const launchInterlude = useCallback((k: TgInterlude) => {
    interludeRef.current = k
    lastInterludeRef.current = k
    lastInterludeAt.current = Date.now()
    setInterlude({ kind: k, id: Date.now() })
    clearTimeout(interludeTimer.current)
    interludeTimer.current = setTimeout(() => {
      interludeRef.current = null
      setInterlude(null)
    }, TG_INTERLUDE_MS[k])
  }, [])

  const tryInterlude = useCallback(
    (ignoreCooldown = false) => {
      const s = tgSceneRef.current
      if (!s.enabled || document.hidden || s.videoSlide) return false
      if (interludeRef.current !== null || activeVignetteRef.current !== null) return false
      if (!ignoreCooldown && Date.now() - lastInterludeAt.current < interludeCooldownMs(s.lowQuality, s.segment)) return false
      const picked = pickTgInterlude(eligibleTgInterludes(s.phase, s.kind, s.segment), lastInterludeRef.current)
      if (!picked) return false
      launchInterlude(picked)
      return true
    },
    [launchInterlude],
  )

  // Interludes ride photo transitions (the leaf tornado sweeps the new photo in).
  const firstTickRef = useRef(true)
  useEffect(() => {
    if (firstTickRef.current) {
      firstTickRef.current = false
      return
    }
    tryInterlude()
  }, [photoTick, tryInterlude])

  useEffect(() => {
    if (!thanksgivingWeek || isStatic) return
    const forced = getQueryParam('tgint') as TgInterlude | null
    const first = setTimeout(
      () => {
        if (forced && TG_INTERLUDE_KINDS.includes(forced)) launchInterlude(forced)
        else tryInterlude(true)
      },
      forced ? 1_200 : 14_000,
    )
    // Fallback when a photo/video lingers: never go much longer than the cooldown without a show.
    const loop = setInterval(() => {
      const s = tgSceneRef.current
      if (Date.now() - lastInterludeAt.current > interludeCooldownMs(s.lowQuality, s.segment) * 1.5) tryInterlude(true)
    }, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(loop)
      clearTimeout(interludeTimer.current)
      interludeRef.current = null
      setInterlude(null)
    }
  }, [thanksgivingWeek, isStatic, launchInterlude, tryInterlude])

  // ── Find the Hidden Turkey (moves to a new spot every time it's found) ──
  const foundKey = `nivas_tg_found_${dayKey}`
  const fedKey = `nivas_tg_fed_${dayKey}`
  const [foundCount, setFoundCount] = useState(() => readDailyCount(foundKey))
  const [spotCount, setSpotCount] = useState(() => readDailyCount(foundKey))
  const [foundRun, setFoundRun] = useState<number | null>(null)
  const [fedCount, setFedCount] = useState(() => readDailyCount(fedKey))
  const spotTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const f = readDailyCount(foundKey)
    setFoundCount(f)
    setSpotCount(f)
    setFedCount(readDailyCount(fedKey))
  }, [foundKey, fedKey])

  useEffect(() => () => clearTimeout(spotTimer.current), [])

  const turkeySpot = hiddenTurkeySpot(dayHash(date, 'turkey'), spotCount)
  const turkeyGeo = HIDE_SPOT_GEOMETRY[turkeySpot]
  const showHiddenTurkey = hideAndSeek && interlude?.kind !== 'turkey_dance'

  const findTurkey = () => {
    if (foundRun !== null) return
    const n = foundCount + 1
    setFoundCount(n)
    writeDailyCount(foundKey, n)
    setFoundRun(Date.now())
    popToast(n === 1 ? '🦃 You found me! Now I’ll hide somewhere else…' : `🦃 Found me again! That’s ${n} today!`)
    clearTimeout(spotTimer.current)
    spotTimer.current = setTimeout(() => {
      setFoundRun(null)
      setSpotCount(n)
    }, 1_600)
  }

  // ── Feed the Turkey: golden acorns tumble from the canopy now and then ──
  const [acorns, setAcorns] = useState<FallingAcorn[]>([])
  const [acornPop, setAcornPop] = useState<{ id: number; x: number } | null>(null)
  const acornsAllowed = thanksgivingWeek && !isStatic && phase !== 'night' && !mood.wet && !snowy && segment !== 'coma'

  useEffect(() => {
    if (!acornsAllowed) {
      setAcorns([])
      return
    }
    let clearTimer: ReturnType<typeof setTimeout> | undefined
    const drop = () => {
      if (document.hidden || interludeRef.current !== null) return
      const base = Date.now()
      setAcorns([0, 1, 2].map((i) => ({ id: base + i, x: 372 + i * 80 + Math.round(Math.random() * 18), delay: i * 0.35 })))
      clearTimeout(clearTimer)
      clearTimer = setTimeout(() => setAcorns([]), 25_000)
    }
    const first = setTimeout(drop, getQueryParam('tgacorns') === '1' ? 1_000 : 22_000)
    const loop = setInterval(drop, lowQuality ? 150_000 : 75_000)
    return () => {
      clearTimeout(first)
      clearTimeout(clearTimer)
      clearInterval(loop)
    }
  }, [acornsAllowed, lowQuality])

  const feedAcorn = (id: number, x: number) => {
    setAcorns((list) => list.filter((a) => a.id !== id))
    const n = fedCount + 1
    setFedCount(n)
    writeDailyCount(fedKey, n)
    setAcornPop({ id: Date.now(), x })
    if (completesFeed(n)) {
      popToast('🎉 Turkey is full! Happy dance time!')
      launchInterlude('turkey_dance')
    } else {
      popToast(`🦃 Gobble! ${n % FEED_GOAL}/${FEED_GOAL} acorns`)
    }
  }

  const GUEST_NAMES = {
    squirrel: 'Squirrel',
    bunny: 'The bunny family',
    chipmunk: 'The chipmunks',
    hedgehog: 'Chef Hedgehog',
    fox_kit: 'Little Fox',
    turkey: 'Turkey',
  } as const

  const tapSign = () => {
    if (feastSleeps > 0) {
      const who = arriving ? ` ${GUEST_NAMES[arriving]} just arrived for the feast!` : ''
      popToast(`🦃 ${feastSleeps} more sleep${feastSleeps === 1 ? '' : 's'}!${who}`)
    } else if (feastSleeps === 0) {
      popToast('🦃 Happy Thanksgiving! Everyone made it to the feast!')
    } else {
      popToast('🥧 Mmm… leftover pie for days!')
    }
    tryInterlude(true)
  }

  // Storybook Gratitude Parchment Cards
  const [activeCard, setActiveCard] = useState<{ note: GratitudeNote; id: number } | null>(null)
  const cardTimer = useRef<ReturnType<typeof setTimeout>>()
  const notesRef = useRef(notes)
  notesRef.current = notes

  const showNextGratitude = useCallback(() => {
    const list = notesRef.current
    if (!list.length) return
    const idx = readIdx() % list.length
    writeIdx(idx + 1)
    clearTimeout(cardTimer.current)
    setActiveCard({ note: list[idx], id: Date.now() })
    cardTimer.current = setTimeout(() => setActiveCard(null), 8_800)
  }, [])

  useEffect(() => {
    if (!notes.length || paused) {
      setActiveCard(null)
      return
    }
    const immediate = getQueryParam('gratitude') === '1'
    const first = setTimeout(
      () => {
        if (!document.hidden) showNextGratitude()
      },
      immediate ? 1_200 : 35_000,
    )
    const loop = setInterval(() => {
      if (!document.hidden) showNextGratitude()
    }, 150_000)
    return () => {
      clearTimeout(first)
      clearInterval(loop)
      clearTimeout(cardTimer.current)
    }
  }, [notes.length, paused, showNextGratitude])

  const handleCritterTap = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    onInteract()
    playBalloonPopSound()
    action()
  }

  // Gouache Canopy Clusters (shed progressively across November: density 3 -> 2 -> 1)
  const canopyPalette =
    phase === 'night'
      ? ['#3b1d1a', '#4c261d', '#5c331e', '#693c22']
      : snowy
        ? ['#8c3b2b', '#a85528', '#b87435', '#cbd5e1']
        : ['#7c2d12', '#9a3412', '#c2591b', '#d97706']

  return (
    <>
      <style>{thanksgivingWeek ? WOODLAND_CSS + TG_CSS : WOODLAND_CSS}</style>

      {/* Main Framing Woodland Stage SVG */}
      <div
        className={`absolute inset-0 z-[25] pointer-events-none select-none overflow-hidden ${isStatic ? 'wd-static' : ''}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" className="w-full h-full block">
          <defs>
            <radialGradient id="wdWarmOrb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.92" />
              <stop offset="42%" stopColor="#f59e0b" stopOpacity="0.40" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="wdOakLeft" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bark.dark} />
              <stop offset="68%" stopColor={bark.mid} />
              <stop offset="100%" stopColor={bark.light} />
            </linearGradient>

            <linearGradient id="wdOakRight" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor={bark.dark} />
              <stop offset="70%" stopColor={bark.mid} />
              <stop offset="100%" stopColor={bark.light} />
            </linearGradient>

            <linearGradient id="wdFloorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={bark.floorTop} />
              <stop offset="100%" stopColor={bark.floorBot} />
            </linearGradient>

            <linearGradient id="wdPuddleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(148, 189, 212, 0.58)" />
              <stop offset="100%" stopColor="rgba(52, 82, 102, 0.72)" />
            </linearGradient>
          </defs>

          {/* 1. Foreground Mossy Woodland Clearing Rim (dips low in center so photos rise cleanly) */}
          <path
            d="M0,968 Q430,998 960,1016 Q1480,1000 1920,962 L1920,1080 L0,1080 Z"
            fill="url(#wdFloorGrad)"
          />
          {(frosty || snowy) && (
            <path
              d="M0,968 Q430,998 960,1016 Q1480,1000 1920,962"
              stroke={snowy ? 'rgba(248, 250, 252, 0.85)' : 'rgba(219, 238, 255, 0.45)'}
              strokeWidth={snowy ? '5' : '2'}
              fill="none"
            />
          )}

          {/* 2. Upper-Left Sculptural Boughs & Month-Thinning Gouache Canopy */}
          <g className={windy ? 'wd-bough-windy' : 'wd-bough'}>
            {/* Sculptural oak twigs revealed as November progresses */}
            <g stroke={bark.mid} strokeLinecap="round" fill="none">
              <path d="M95,18 C195,42 295,62 415,52" strokeWidth="14" />
              <path d="M235,45 C295,88 355,108 425,98" strokeWidth="8" />
              <path d="M135,55 C190,105 245,132 308,142" strokeWidth="9" />
            </g>

            {/* Tier 1: Core late-November russet clusters */}
            <g fill={canopyPalette[0]}>
              <circle cx="88" cy="44" r="78" />
              <circle cx="165" cy="36" r="72" />
              <circle cx="242" cy="48" r="64" />
            </g>
            <g fill={canopyPalette[1]}>
              <circle cx="132" cy="82" r="58" />
              <circle cx="215" cy="76" r="52" />
            </g>

            {/* Tier 2: Mid-November amber foliage (sheds in final week) */}
            {density >= 2 && (
              <g fill={canopyPalette[2]}>
                <circle cx="298" cy="44" r="62" />
                <circle cx="358" cy="58" r="52" />
                <circle cx="268" cy="92" r="48" />
              </g>
            )}

            {/* Tier 3: Early-November lush golden-crimson crown */}
            {density === 3 && (
              <g fill={canopyPalette[3]}>
                <circle cx="395" cy="42" r="56" />
                <circle cx="448" cy="64" r="44" />
                <circle cx="332" cy="96" r="46" />
                <circle cx="185" cy="116" r="48" />
              </g>
            )}

            {/* Snow cushion on upper boughs */}
            {snowy && (
              <path
                d="M40,22 Q185,12 340,38"
                stroke="#f1f5f9"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
                opacity="0.88"
              />
            )}

            <GouacheMapleLeaf x={312} y={118} scale={0.86} rot={28} fill={phase === 'night' ? '#7f1d1d' : '#f59e0b'} />
            {density >= 2 && (
              <GouacheOakLeaf x={402} y={108} scale={0.82} rot={-22} fill={phase === 'night' ? '#78350f' : '#ea580c'} />
            )}
          </g>

          {/* Mid-Right Foliage Accent (stays below y=275 so Top-Right Time & Agenda HUD is 100% clear!) */}
          {density >= 2 && (
            <g fill={canopyPalette[1]}>
              <circle cx="1868" cy="365" r="68" />
              <circle cx="1882" cy="448" r="62" fill={canopyPalette[0]} />
            </g>
          )}

          {/* Hide-and-seek turkey tucked BEHIND a trunk (drawn before the trunks so the bark covers it) */}
          {showHiddenTurkey && turkeyGeo.layer === 'back' && <HiddenTurkey spot={turkeySpot} foundRun={foundRun} />}

          {/* 3. Grand Left Storybook Oak Trunk & Roots */}
          <path
            d="M-20,0 L168,0 C152,275 146,555 178,825 C202,935 272,1015 348,1080 L-20,1080 Z"
            fill="url(#wdOakLeft)"
          />
          {/* Rim highlight along inner bark */}
          <path
            d="M166,0 C150,275 144,555 176,825 C200,935 268,1015 342,1080"
            stroke={bark.rim}
            strokeWidth="3"
            fill="none"
          />
          {/* Painterly bark grain grooves */}
          <g stroke={bark.dark} strokeWidth="3.8" fill="none" opacity="0.68" strokeLinecap="round">
            <path d="M52,85 C42,260 48,440 38,685" />
            <path d="M104,155 C96,320 108,370 98,412" />
            <path d="M106,560 C102,710 124,865 186,1005" />
            <path d="M142,615 C140,760 168,895 245,1025" />
          </g>
          {/* Shelf bracket mushrooms on left bark */}
          <g fill="#be8c56" stroke="#5c3820" strokeWidth="1.2">
            <path d="M156,645 C178,642 182,654 156,656 Z" />
            <path d="M152,660 C170,658 173,668 152,669 Z" />
          </g>

          {/* Owl Bough + Wise Barred Owl */}
          <path
            d="M146,214 C205,202 256,208 298,226"
            stroke={bark.mid}
            strokeWidth="19"
            fill="none"
            strokeLinecap="round"
          />
          {snowy && (
            <path
              d="M152,206 C205,196 252,201 292,218"
              stroke="#f1f5f9"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
          )}
          <WoodlandOwl
            mode={mood.owl}
            snowy={snowy}
            hoot={hoot}
            hideOwl={activeVignette?.kind === 'owl_flight'}
          />

          {/* Glowing Acorn Stash Hollow + Squirrel Routine */}
          <HollowScene
            mode={mood.squirrel}
            acornCount={acornCount}
            frosty={frosty}
            windy={windy}
            excited={squirrelExcited}
            hideSquirrel={
              activeVignette?.kind === 'sortie' ||
              activeVignette?.kind === 'chase' ||
              climberRun !== null
            }
          />

          {/* Periodic Trunk-Scampering Squirrel */}
          {climberRun !== null && <ScamperingSquirrel key={climberRun} />}

          {/* Thanksgiving countdown sign hanging from the owl bough */}
          {thanksgivingWeek && <CountdownSign sleeps={feastSleeps} found={foundCount} fed={fedCount} animate={!isStatic} />}

          {/* Hide-and-seek turkey in front spots (owl branch, on top of the sign, in the leaf pile) */}
          {showHiddenTurkey && turkeyGeo.layer === 'front' && <HiddenTurkey spot={turkeySpot} foundRun={foundRun} />}
          {foundRun !== null && <ConfettiBurst key={foundRun} x={turkeyGeo.x} y={turkeyGeo.y - 20} count={14} />}

          {/* 4. Grand Right Storybook Oak Trunk (narrow upper trunk keeps Top-Right HUD sky clear!) */}
          <path
            d="M1940,0 L1826,0 C1814,225 1786,515 1714,900 C1676,988 1602,1040 1540,1080 L1940,1080 Z"
            fill="url(#wdOakRight)"
          />
          <path
            d="M1828,0 C1816,225 1788,515 1716,900 C1678,988 1604,1040 1544,1080"
            stroke={bark.rim}
            strokeWidth="3"
            fill="none"
          />
          <g stroke={bark.dark} strokeWidth="3.8" fill="none" opacity="0.65" strokeLinecap="round">
            <path d="M1858,95 C1850,350 1828,675 1785,845" />
            <path d="M1884,265 C1886,525 1868,745 1835,885" />
          </g>

          {/* Periodic Right-Trunk Woodpecker Cameo */}
          {activeVignette?.kind === 'peck' && <WoodpeckerCameo key={activeVignette.id} />}

          {/* Right Oak Root Den + Red Fox & Kit Routine */}
          <FoxDenScene
            mode={mood.fox}
            frosty={frosty}
            snowy={snowy}
            wagged={foxWagged}
            hideAdult={
              activeVignette?.kind === 'chase' || interlude?.kind === 'pie_toss' || interlude?.kind === 'football'
            }
          />

          {/* Occasional Woodland Vignettes (Squirrel Sortie, Fox-Squirrel Chase, Bunny, Acorn Drop, Fireflies, Owl Flight) */}
          {activeVignette?.kind === 'sortie' && <SquirrelTreeSortie key={activeVignette.id} />}
          {activeVignette?.kind === 'chase' && <FoxSquirrelChase key={activeVignette.id} />}
          {activeVignette?.kind === 'bunny' && <CottontailBunny key={activeVignette.id} />}
          {activeVignette?.kind === 'acorn_drop' && <AcornDropCameo key={activeVignette.id} />}
          {activeVignette?.kind === 'fireflies' && <FireflyDance key={activeVignette.id} />}
          {activeVignette?.kind === 'owl_flight' && <OwlNightFlight key={activeVignette.id} />}

          {/* 5. Acorn-Cap String Lanterns Across Left Roots */}
          <g className={windy ? 'wd-garland-windy' : 'wd-garland'}>
            <path d="M88,872 Q208,922 332,890" stroke="#3b2314" strokeWidth="2.6" fill="none" />
            {[122, 180, 240, 298].map((lx, idx) => {
              const ly = idx === 0 ? 886 : idx === 1 ? 902 : idx === 2 ? 904 : 894
              return (
                <g key={lx} transform={`translate(${lx},${ly})`}>
                  {mood.lanternsLit && (
                    <circle
                      cx="0"
                      cy="10"
                      r="36"
                      fill="url(#wdWarmOrb)"
                      style={
                        !isStatic
                          ? { animation: `wdLanternTwinkle ${2.8 + idx * 0.45}s ease-in-out ${idx * 0.3}s infinite` }
                          : undefined
                      }
                    />
                  )}
                  <ellipse
                    cx="0"
                    cy="11"
                    rx="6.8"
                    ry="8.8"
                    fill={mood.lanternsLit ? '#fef08a' : '#d6c4a5'}
                    stroke="#78350f"
                    strokeWidth="0.9"
                  />
                  <path d="M-9,4 C-9,-4 9,-4 9,4 Z" fill="#4a2b16" />
                  {snowy && <path d="M-8,1 Q0,-5 8,1" stroke="#f8fafc" strokeWidth="2.5" fill="none" />}
                </g>
              )
            })}
          </g>

          {/* 6. Storybook Toadstools, Moss Knoll & Rain-Reactive Puddle / Bonus Sprouts */}
          <g transform="translate(212, 1026)">
            <ellipse cx="18" cy="24" rx="96" ry="22" fill={bark.moss} />
            {/* Hero Toadstool */}
            <rect x="-4" y="-8" width="9" height="28" rx="4" fill="#f5ead6" />
            <path d="M-24,-4 C-24,-26 24,-26 24,-4 Z" fill="#dc2626" />
            <circle cx="-8" cy="-13" r="3" fill="#fef3c7" />
            <circle cx="7" cy="-16" r="3.4" fill="#fef3c7" />
            <circle cx="13" cy="-8" r="2.4" fill="#fef3c7" />
            {/* Companion Toadstool */}
            <rect x="34" y="2" width="7" height="18" rx="3" fill="#f5ead6" />
            <path d="M21,5 C21,-10 53,-10 53,5 Z" fill="#dc2626" />
            <circle cx="33" cy="-1" r="2.2" fill="#fef3c7" />
            <circle cx="43" cy="-2" r="2.4" fill="#fef3c7" />
            {(frosty || snowy) && (
              <path
                d="M-22,-5 C-14,-22 14,-22 22,-5"
                stroke={snowy ? '#f8fafc' : 'rgba(224, 242, 254, 0.7)'}
                strokeWidth={snowy ? '4' : '1.8'}
                fill="none"
              />
            )}
          </g>

          {/* Rainy / Stormy Bonus: Extra Sprouted Baby Mushrooms + Rippling Puddle! */}
          {mood.wet && (
            <g>
              {[
                [122, 1044, 0.72],
                [154, 1038, 0.85],
                [295, 1042, 0.78],
                [322, 1048, 0.65],
              ].map(([mx, my, sc], i) => (
                <g key={i} transform={`translate(${mx},${my}) scale(${sc})`}>
                  <rect x="-3" y="-2" width="6" height="14" rx="2.5" fill="#f5ead6" />
                  <path d="M-13,0 C-13,-12 13,-12 13,0 Z" fill="#ea580c" />
                  <circle cx="-4" cy="-5" r="1.8" fill="#fef3c7" />
                  <circle cx="4" cy="-6" r="2" fill="#fef3c7" />
                </g>
              ))}

              {/* Glistening Woodland Rain Puddle with Expanding Raindrop Ripples */}
              <g transform="translate(392, 1054)">
                <ellipse cx="0" cy="0" rx="58" ry="11" fill="url(#wdPuddleGrad)" />
                <ellipse
                  cx="-14"
                  cy="-1"
                  rx="22"
                  ry="4.5"
                  fill="none"
                  stroke="rgba(224, 242, 254, 0.75)"
                  strokeWidth="1.3"
                  style={!isStatic ? { transformOrigin: '-14px -1px', animation: 'wdRipple 2.4s ease-out infinite' } : undefined}
                />
                <ellipse
                  cx="18"
                  cy="1"
                  rx="20"
                  ry="4"
                  fill="none"
                  stroke="rgba(224, 242, 254, 0.7)"
                  strokeWidth="1.2"
                  style={!isStatic ? { transformOrigin: '18px 1px', animation: 'wdRipple 2.4s ease-out 1.2s infinite' } : undefined}
                />
              </g>
            </g>
          )}

          {/* 7. Glowing Gratitude Leaf & Parchment Scroll Tuck on Left Moss (when parent added notes) */}
          {notes.length > 0 && !thanksgivingWeek && (
            <g transform="translate(468, 1036)">
              <circle cx="0" cy="0" r="36" fill="url(#wdWarmOrb)" opacity="0.72" />
              <GouacheOakLeaf x={-12} y={2} scale={0.55} rot={-38} fill="#f59e0b" />
              <g transform="rotate(-10)">
                <rect x="-18" y="-7" width="38" height="14" rx="6" fill="#faf1dc" stroke="#b47b2a" strokeWidth="1.3" />
                <line x1="-2" y1="-7" x2="-2" y2="7" stroke="#b91c1c" strokeWidth="2.4" />
                <circle cx="-2" cy="0" r="3" fill="#dc2626" />
              </g>
            </g>
          )}

          {/* 8. The Great Woodland Feast: growing table, guests, Thankful Tree & feed-the-turkey acorns */}
          {thanksgivingWeek && (
            <>
              <ThankfulTree
                filled={Math.min(notes.length, THANKFUL_TREE_SLOTS)}
                glowing={tgDay}
                frosty={frosty || snowy}
              />
              <FeastTable
                stage={stage}
                guests={guests}
                arriving={isStatic ? null : arriving}
                sleepy={guestsSleepy}
                segment={segment}
                leftovers={leftovers}
                frosty={frosty}
                snowy={snowy}
                hideTurkey={interlude?.kind === 'turkey_dance'}
              />
              <FeedAcorns acorns={acorns} />
              {acornPop && <ConfettiBurst key={acornPop.id} x={acornPop.x} y={1050} count={8} />}
            </>
          )}

          {/* Show-time interludes (one at a time, in front of the feast) */}
          {interlude?.kind === 'parade' && <TurkeyTrotParade key={interlude.id} />}
          {interlude?.kind === 'leaf_tornado' && <LeafTornado key={interlude.id} count={lowQuality ? 16 : 32} />}
          {interlude?.kind === 'balloon' && (
            <ParadeBalloon key={interlude.id} variant={segment === 'parade' && interlude.id % 2 === 0 ? 'turkey' : 'pumpkin'} />
          )}
          {interlude?.kind === 'pie_toss' && <PieToss key={interlude.id} />}
          {interlude?.kind === 'football' && <AcornFootball key={interlude.id} />}
          {interlude?.kind === 'turkey_dance' && <TurkeyDance key={interlude.id} />}

          {/* Subtle Gouache Leaves Resting on Foreground Edges */}
          <GouacheOakLeaf x={1612} y={248} scale={0.82} rot={-28} fill={phase === 'night' ? '#7c2d12' : '#ea580c'} opacity={0.88} />
          <GouacheMapleLeaf x={1665} y={695} scale={0.92} rot={42} fill={phase === 'night' ? '#7f1d1d' : '#dc2626'} opacity={0.88} />
        </svg>
      </div>

      {/* Kid-Friendly Interactive Critter Tap Zones (targeted hitboxes so rest of screen exits cleanly) */}
      <div className="absolute inset-0 z-[28] pointer-events-none select-none">
        {/* Tap Owl */}
        <button
          type="button"
          aria-label="Woodland owl"
          onClick={(e) =>
            handleCritterTap(e, () => {
              setHoot(true)
              setTimeout(() => setHoot(false), 950)
              if (!isStatic && !mood.wet && !snowy && mood.owl === 'awake' && activeVignetteRef.current === null) {
                launchVignette('owl_flight')
              }
              popToast(mood.owl === 'sleeping' ? '🦉 *sleepy hoo-hoo...*' : '🦉 Hoo-hoo!')
            })
          }
          className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
          style={{ left: '9.8%', top: '12.5%', width: 84, height: 84 }}
        />

        {/* Tap Squirrel Hollow */}
        <button
          type="button"
          aria-label="Squirrel acorn hollow"
          onClick={(e) =>
            handleCritterTap(e, () => {
              setSquirrelExcited(true)
              setTimeout(() => setSquirrelExcited(false), 900)
              if (!isStatic && !mood.wet && !snowy && phase !== 'night' && activeVignetteRef.current === null) {
                launchVignette('sortie')
              }
              popToast(`🌰 ${acornCount} acorns stored for winter!`)
            })
          }
          className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
          style={{ left: '2.2%', top: '39.5%', width: 108, height: 118 }}
        />

        {/* Tap Fox Den */}
        <button
          type="button"
          aria-label="Woodland fox den"
          onClick={(e) =>
            handleCritterTap(e, () => {
              setFoxWagged(true)
              setTimeout(() => setFoxWagged(false), 1_600)
              if (!isStatic && !mood.wet && !snowy && (phase === 'day' || phase === 'dawn') && activeVignetteRef.current === null) {
                launchVignette('chase')
              }
              popToast(mood.fox === 'curled' ? '🦊 Cozy & warm in the den!' : '🦊 *happy woodland yip!*')
            })
          }
          className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
          style={{ right: '2.5%', bottom: '5.5%', width: 175, height: 110 }}
        />

        {/* Thanksgiving week: countdown sign (tap for a show!), hidden turkey, Thankful Tree, acorns, table turkey */}
        {thanksgivingWeek && (
          <button
            type="button"
            aria-label="Feast countdown sign"
            onClick={(e) => handleCritterTap(e, tapSign)}
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={svgBox(301, 310, 260, 130)}
          />
        )}
        {showHiddenTurkey && (
          <button
            type="button"
            aria-label="Hidden turkey"
            onClick={(e) => handleCritterTap(e, findTurkey)}
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={svgBox(turkeyGeo.x, turkeyGeo.y - 10 * turkeyGeo.s, 110, 110)}
          />
        )}
        {thanksgivingWeek && (
          <button
            type="button"
            aria-label="Thankful tree"
            onClick={(e) =>
              handleCritterTap(e, () => {
                if (notes.length) showNextGratitude()
                else popToast('🌳 Every thankful note grows a leaf on the Thankful Tree!')
              })
            }
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={svgBox(1592, 990, 130, 150)}
          />
        )}
        {acorns.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label="Golden acorn"
            onClick={(e) => handleCritterTap(e, () => feedAcorn(a.id, a.x))}
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={svgBox(a.x, 1054, 84, 76)}
          />
        ))}
        {thanksgivingWeek && guests.includes('turkey') && (
          <button
            type="button"
            aria-label="Thanksgiving turkey at the feast"
            onClick={(e) =>
              handleCritterTap(e, () =>
                popToast(guestsSleepy ? '🦃 *snore*… too much pie…' : '🦃 Gobble gobble! I’m a guest, not the dinner!'),
              )
            }
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={svgBox(tableTurkeyPos(stage).x, tableTurkeyPos(stage).y, 120, 140)}
          />
        )}

        {/* Tap Gratitude Scroll */}
        {notes.length > 0 && !thanksgivingWeek && (
          <button
            type="button"
            aria-label="Family gratitude scroll"
            onClick={(e) => handleCritterTap(e, showNextGratitude)}
            className="absolute pointer-events-auto cursor-pointer bg-transparent border-0"
            style={{ left: '21.8%', bottom: '1%', width: 88, height: 68 }}
          />
        )}
      </div>

      {/* Storybook Gratitude Parchment Card */}
      {activeCard && (
        <div
          key={activeCard.id}
          className="absolute top-9 z-[32] pointer-events-none select-none px-7 py-4 rounded-xl shadow-2xl max-w-[540px] text-center"
          style={{
            left: '48%',
            background: 'linear-gradient(165deg, #fdf6e4 0%, #f3e2be 100%)',
            border: '2px solid #b47b2a',
            boxShadow: '0 18px 48px rgba(12, 7, 3, 0.62), inset 0 0 0 3px rgba(180, 123, 42, 0.22)',
            animation: 'wdCardFloat 8.8s ease-in-out both',
          }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#854d0e] mb-1">
            🍂 I am thankful for 🍂
          </div>
          <div
            className="text-[1.85rem] leading-snug text-[#3b2110]"
            style={{ fontFamily: "'Caveat', Georgia, cursive" }}
          >
            “{activeCard.note.text}”
          </div>
          {activeCard.note.author && (
            <div
              className="mt-1 text-[1.35rem] text-[#78350f]"
              style={{ fontFamily: "'Caveat', Georgia, cursive" }}
            >
              — {activeCard.note.author}
            </div>
          )}
        </div>
      )}

      {/* Subtle Storybook Critter Whisper Toast */}
      {toast && (
        <div
          key={toast.id}
          className="absolute bottom-7 z-[33] pointer-events-none select-none px-5 py-2 rounded-full text-amber-50 text-lg font-medium shadow-xl border border-amber-300/35"
          style={{
            left: '50%',
            background: 'rgba(34, 20, 12, 0.88)',
            fontFamily: "'Caveat', Georgia, cursive",
            fontSize: '1.55rem',
            animation: 'wdToastPop 2.8s ease-out both',
          }}
        >
          {toast.text}
        </div>
      )}
    </>
  )
})
