// Auto-extracted storybook SVG & scoped CSS for The Harvest Express.
export const HARVEST_EXPRESS_CSS = `.harvest-express-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #120a05;
  pointer-events: none;
  user-select: none;
}
.harvest-express-stage.is-paused * {
  animation-play-state: paused !important;
}
.harvest-express-stage svg.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.harvest-express-stage.theme-day {
    --sky-1: #1e40af;
    --sky-2: #3b82f6;
    --sky-3: #f59e0b;
    --sky-4: #fef3c7;
    --cloud-top: #fffbeb;
    --cloud-mid: #fed7aa;
    --cloud-bot: #94a3b8;
    --haze-op: 0.28;
    --sun-op: 0.94;
    --stars-op: 0;
    --headlight-op: 0.16;
    --lantern-op: 0.42;
    --win-glow: #fef08a;
    --firebox-op: 0.62;
    --night-dim: 0;
    --win-unlit: rgba(203, 213, 225, 0.30);
    --city-lit: 0.10;
  }
  .harvest-express-stage.theme-dusk {
    --sky-1: #141236;
    --sky-2: #4c1d95;
    --sky-3: #c2410c;
    --sky-4: #fbbf24;
    --cloud-top: #fde68a;
    --cloud-mid: #f97316;
    --cloud-bot: #4c1d95;
    --haze-op: 0.34;
    --sun-op: 0.80;
    --stars-op: 0.52;
    --headlight-op: 0.84;
    --lantern-op: 0.98;
    --win-glow: #fde047;
    --firebox-op: 0.88;
    --night-dim: 0.18;
    --win-unlit: rgba(15, 23, 42, 0.55);
    --city-lit: 0.92;
  }
  .harvest-express-stage.theme-night {
    --sky-1: #030712;
    --sky-2: #0f172a;
    --sky-3: #1e293b;
    --sky-4: #334155;
    --cloud-top: #94a3b8;
    --cloud-mid: #475569;
    --cloud-bot: #1e293b;
    --haze-op: 0.14;
    --sun-op: 0;
    --stars-op: 1;
    --headlight-op: 1;
    --lantern-op: 1;
    --win-glow: #fde047;
    --firebox-op: 0.96;
    --night-dim: 0.24;
    --win-unlit: rgba(2, 6, 23, 0.65);
    --city-lit: 1;
  }
/* Subtle secondary CSS animations (always placed on inner <g>, never conflicting with JS translate!) */
  @keyframes chimneyPuff {
    0%   { transform: translate(0, 0) scale(0.45); opacity: 0.72; }
    100% { transform: translate(-24px, -62px) scale(1.65); opacity: 0; }
  }
  @keyframes bellSwing {
    0%, 100% { transform: rotate(-16deg); }
    50%      { transform: rotate(16deg); }
  }
  @keyframes cocoaSteam {
    0%   { transform: translateY(0) scaleX(1); opacity: 0.78; }
    50%  { transform: translateY(-16px) scaleX(1.22); opacity: 0.48; }
    100% { transform: translateY(-32px) scaleX(0.85); opacity: 0; }
  }
  @keyframes windmill {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes balloonBob {
    0%, 100% { transform: translateY(0) rotate(-1.5deg); }
    50%      { transform: translateY(-18px) rotate(1.5deg); }
  }
  @keyframes waveSwell {
    0%, 100% { transform: translateX(-22px); }
    50%      { transform: translateX(22px); }
  }
  @keyframes mistDrift {
    0%, 100% { transform: translateX(-38px); opacity: 0.46; }
    50%      { transform: translateX(38px); opacity: 0.78; }
  }
  @keyframes ferryGlide {
    0%, 100% { transform: translateX(-28px) rotate(-0.8deg); }
    50%      { transform: translateX(28px) rotate(0.8deg); }
  }
  @keyframes beaconSweep {
    0%, 100% { opacity: 0.22; }
    50%      { opacity: 0.96; }
  }
  @keyframes cheerToast {
    0%, 58%, 100% { transform: translateY(0) rotate(0deg); }
    24%, 40%      { transform: translateY(-9px) rotate(-14deg); }
  }
  @keyframes eyeBlink {
    0%, 91%, 100% { transform: scaleY(1); }
    95%           { transform: scaleY(0.08); }
  }
  @keyframes foxBreathe {
    0%, 100% { transform: scale(1, 1); }
    50%      { transform: scale(1.04, 0.95); }
  }
  @keyframes bearWave {
    0%, 100% { transform: rotate(-12deg); }
    50%      { transform: rotate(28deg); }
  }
  @keyframes cubBounce {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-4.5px); }
  }
  @keyframes bisonGraze {
    0%, 62%, 100% { transform: rotate(0deg); }
    24%, 44%      { transform: rotate(-18deg) translateY(4px); }
  }
  @keyframes elkLift {
    0%, 65%, 100% { transform: rotate(0deg); }
    25%, 45%      { transform: rotate(10deg) translateY(-2px); }
  }
  @keyframes whaleSpout {
    0%, 20%, 100% { transform: scaleY(0.1); opacity: 0; }
    45%           { transform: scaleY(1.05); opacity: 0.88; }
    72%           { transform: scaleY(1.18) translateY(-6px); opacity: 0.42; }
    85%           { transform: scaleY(1.25) translateY(-10px); opacity: 0; }
  }
  @keyframes fireflyGlow {
    0%, 100% { opacity: 0.15; transform: translate(0, 0) scale(0.8); }
    50%      { opacity: 0.95; transform: translate(10px, -12px) scale(1.25); }
  }
  @keyframes candleFlicker {
    0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.92; }
    50%      { transform: scaleY(1.18) scaleX(0.88); opacity: 1; }
  }
  @keyframes surfFoam {
    0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.72; }
    50%      { transform: translateX(-14px) scaleX(1.12); opacity: 0.95; }
  }

  .chimney-1 { animation: chimneyPuff 3.4s ease-out infinite; }
  .chimney-2 { animation: chimneyPuff 3.4s ease-out 1.7s infinite; }
  .bell-swing { transform-box: fill-box; transform-origin: 50% 0%; animation: bellSwing 0.88s ease-in-out infinite; }
  .cocoa-1 { animation: cocoaSteam 1.9s ease-out infinite; }
  .cocoa-2 { animation: cocoaSteam 1.9s ease-out 0.95s infinite; }
  .windmill-blades { transform-box: fill-box; transform-origin: center; animation: windmill 9s linear infinite; }
  .balloon-bob { animation: balloonBob 4.6s ease-in-out infinite; }
  .wave-swell { animation: waveSwell 4.8s ease-in-out infinite; }
  .mist-1 { animation: mistDrift 9.5s ease-in-out infinite; }
  .mist-2 { animation: mistDrift 12s ease-in-out -5s infinite; }
  .ferry-bob { animation: ferryGlide 8.2s ease-in-out infinite; }
  .beacon-beam { animation: beaconSweep 4.2s ease-in-out infinite; }
  .cheer-mug { transform-box: fill-box; transform-origin: center; animation: cheerToast 3.2s ease-in-out infinite; }
  .blink-eye { transform-box: fill-box; transform-origin: center; animation: eyeBlink 4.6s ease-in-out infinite; }
  .fox-sleep-breathe { transform-box: fill-box; transform-origin: 50% 100%; animation: foxBreathe 3.4s ease-in-out infinite; }
  .bear-paw-wave { transform-box: fill-box; transform-origin: 20% 80%; animation: bearWave 1.35s ease-in-out infinite; }
  .cub-bounce { animation: cubBounce 1.1s ease-in-out infinite; }
  .bison-head { transform-box: fill-box; transform-origin: 85% 40%; animation: bisonGraze 6.5s ease-in-out infinite; }
  .elk-head { transform-box: fill-box; transform-origin: 80% 75%; animation: elkLift 7.2s ease-in-out infinite; }
  .whale-spout { transform-box: fill-box; transform-origin: 50% 100%; animation: whaleSpout 5.2s ease-out infinite; }
  .firefly { animation: fireflyGlow 3.6s ease-in-out infinite; }
  .candle-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: candleFlicker 0.65s ease-in-out infinite; }
  .surf-foam { transform-box: fill-box; transform-origin: center; animation: surfFoam 3.2s ease-in-out infinite; }

  @keyframes fallFlow { to { stroke-dashoffset: -26; } }
  .falls-flow { stroke-dasharray: 16 10; animation: fallFlow 0.7s linear infinite; }

  @keyframes glitterShimmer { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
  .glitter-shimmer { animation: glitterShimmer 1.7s ease-in-out infinite; }

  #liftBeam { transition: opacity 0.5s ease; }`

export const HARVEST_EXPRESS_SVG = `<svg class="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
    <defs>
      <!-- Atmospheric Sky, Sun & Volumetric Cloud Gradients -->
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   style="stop-color: var(--sky-1)" />
        <stop offset="40%"  style="stop-color: var(--sky-2)" />
        <stop offset="76%"  style="stop-color: var(--sky-3)" />
        <stop offset="100%" style="stop-color: var(--sky-4)" />
      </linearGradient>
      <radialGradient id="sunGlow" cx="22%" cy="24%" r="48%">
        <stop offset="0%"   stop-color="#fffbeb" stop-opacity="0.94" />
        <stop offset="32%"  stop-color="#fde68a" stop-opacity="0.40" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   style="stop-color: var(--cloud-top)" stop-opacity="0.92" />
        <stop offset="58%"  style="stop-color: var(--cloud-mid)" stop-opacity="0.72" />
        <stop offset="100%" style="stop-color: var(--cloud-bot)" stop-opacity="0.48" />
      </linearGradient>
      <linearGradient id="horizonHaze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#fde68a" stop-opacity="0" />
        <stop offset="65%"  stop-color="#fed7aa" stop-opacity="0.34" />
        <stop offset="100%" stop-color="#fffbeb" stop-opacity="0.62" />
      </linearGradient>
      <linearGradient id="mistRibbonGrad" x1="0" y1="0.5" x2="1" y2="0.5">
        <stop offset="0%"   stop-color="#fff7ed" stop-opacity="0" />
        <stop offset="25%"  stop-color="#fff7ed" stop-opacity="0.52" />
        <stop offset="75%"  stop-color="#fed7aa" stop-opacity="0.46" />
        <stop offset="100%" stop-color="#fff7ed" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="warmLantern" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#fef08a" stop-opacity="0.98" />
        <stop offset="42%"  stop-color="#f59e0b" stop-opacity="0.48" />
        <stop offset="100%" stop-color="#ea580c" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="headlightCone" x1="0" y1="0.5" x2="1" y2="0.5">
        <stop offset="0%"   stop-color="#fef9c3" stop-opacity="0.94" />
        <stop offset="52%"  stop-color="#fde047" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#fef08a" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="cradleGlow" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%"   stop-color="#fbbf24" stop-opacity="0.46" />
        <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
      </linearGradient>

      <!-- Rich Water, Terrain & Heirloom Metallic Train Gradients -->
      <linearGradient id="oceanPacGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#0284c7" />
        <stop offset="42%"  stop-color="#0369a1" />
        <stop offset="100%" stop-color="#0c4a6e" />
      </linearGradient>
      <linearGradient id="oceanAtlGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#1d4ed8" />
        <stop offset="55%"  stop-color="#1e3a8a" />
        <stop offset="100%" stop-color="#172554" />
      </linearGradient>
      <linearGradient id="lakeAlpineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#0ea5e9" />
        <stop offset="45%"  stop-color="#0284c7" />
        <stop offset="100%" stop-color="#0369a1" />
      </linearGradient>
      <linearGradient id="wheatGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#facc15" />
        <stop offset="50%"  stop-color="#eab308" />
        <stop offset="100%" stop-color="#a16207" />
      </linearGradient>
      <linearGradient id="butteLitGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#ef8a4a" />
        <stop offset="50%"  stop-color="#d0602c" />
        <stop offset="100%" stop-color="#a8461f" />
      </linearGradient>
      <linearGradient id="mesaSunGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#f97316" />
        <stop offset="45%"  stop-color="#dc2626" />
        <stop offset="100%" stop-color="#991b1b" />
      </linearGradient>
      <linearGradient id="graniteSunGrad" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%"   stop-color="#94a3b8" />
        <stop offset="55%"  stop-color="#64748b" />
        <stop offset="100%" stop-color="#475569" />
      </linearGradient>
      <linearGradient id="graniteShadeGrad" x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0%"   stop-color="#475569" />
        <stop offset="65%"  stop-color="#334155" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="boilerGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#b91c1c" />
        <stop offset="18%"  stop-color="#f87171" />
        <stop offset="32%"  stop-color="#ef4444" />
        <stop offset="60%"  stop-color="#991b1b" />
        <stop offset="88%"  stop-color="#7f1d1d" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <linearGradient id="smokeboxGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#475569" />
        <stop offset="22%"  stop-color="#94a3b8" />
        <stop offset="55%"  stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <linearGradient id="brassGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#fef9c3" />
        <stop offset="28%"  stop-color="#facc15" />
        <stop offset="68%"  stop-color="#ca8a04" />
        <stop offset="100%" stop-color="#713f12" />
      </linearGradient>
      <linearGradient id="steelRodGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#f8fafc" />
        <stop offset="45%"  stop-color="#cbd5e1" />
        <stop offset="100%" stop-color="#475569" />
      </linearGradient>
      <linearGradient id="woodCarGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#d97706" />
        <stop offset="45%"  stop-color="#b45309" />
        <stop offset="100%" stop-color="#78350f" />
      </linearGradient>
      <linearGradient id="crimsonCarGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#dc2626" />
        <stop offset="48%"  stop-color="#991b1b" />
        <stop offset="100%" stop-color="#6b1010" />
      </linearGradient>
      <linearGradient id="cabRoofGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#572914" />
        <stop offset="60%"  stop-color="#3b1d0c" />
        <stop offset="100%" stop-color="#1c0c05" />
      </linearGradient>

      <!-- Procedural rock, mist & architectural window materials -->
      <linearGradient id="rockLitGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#b9c3d1" />
        <stop offset="45%"  stop-color="#8b98ad" />
        <stop offset="100%" stop-color="#5e6c84" />
      </linearGradient>
      <linearGradient id="rockShadeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#5b6a83" />
        <stop offset="55%"  stop-color="#3d4a62" />
        <stop offset="100%" stop-color="#27324a" />
      </linearGradient>
      <linearGradient id="mistBandGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#fff7ed" stop-opacity="0" />
        <stop offset="50%"  stop-color="#fff7ed" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#fff7ed" stop-opacity="0" />
      </linearGradient>
      <pattern id="winUnlit" width="14" height="18" patternUnits="userSpaceOnUse">
        <rect x="3.5" y="4" width="6.5" height="9" rx="0.8" style="fill: var(--win-unlit)" />
      </pattern>
      <pattern id="winLit" width="56" height="72" patternUnits="userSpaceOnUse">
        <g style="fill: var(--win-glow); opacity: var(--city-lit)">
          <rect x="3.5" y="4" width="6.5" height="9" rx="0.8" /><rect x="17.5" y="4" width="6.5" height="9" rx="0.8" />
          <rect x="45.5" y="4" width="6.5" height="9" rx="0.8" /><rect x="31.5" y="22" width="6.5" height="9" rx="0.8" />
          <rect x="3.5" y="40" width="6.5" height="9" rx="0.8" /><rect x="45.5" y="40" width="6.5" height="9" rx="0.8" />
          <rect x="17.5" y="58" width="6.5" height="9" rx="0.8" /><rect x="31.5" y="58" width="6.5" height="9" rx="0.8" />
        </g>
      </pattern>

      <!-- =================================================================== -->
      <!-- SCULPTED BOTANICAL TREES (Eyvind Earle layered canopy brushwork)    -->
      <!-- =================================================================== -->
      <g id="pineTreeRich">
        <path d="M-5.5,0 L-3,-92 L3,-92 L5.5,0 Z" fill="#3b1d0c" />
        <path d="M-2,0 L-1.5,-92 L0.5,-92 L1,0 Z" fill="#78350f" opacity="0.55" />
        <path d="M0,-124 C-14,-94 -26,-74 -36,-66 C-22,-63 -10,-66 0,-72 C10,-66 22,-63 36,-66 C26,-74 14,-94 0,-124 Z" fill="#166534" />
        <path d="M0,-96 C-20,-64 -34,-42 -44,-34 C-26,-31 -12,-35 0,-42 C12,-35 26,-31 44,-34 C34,-42 20,-64 0,-96 Z" fill="#15803d" />
        <path d="M0,-66 C-24,-34 -40,-14 -50,-4 C-28,-1 -14,-5 0,-11 C14,-5 28,-1 50,-4 C40,-14 24,-34 0,-66 Z" fill="#14532d" />
        <path d="M0,-124 C-12,-96 -23,-76 -32,-67 C-18,-69 -8,-80 0,-106 Z" fill="#4ade80" opacity="0.28" />
        <path d="M0,-96 C-16,-66 -28,-48 -38,-37 C-22,-40 -10,-52 0,-78 Z" fill="#4ade80" opacity="0.20" />
      </g>

      <g id="mapleTreeRich">
        <path d="M-7,0 C-5,-18 -4,-34 -4,-54 L4,-54 C4,-34 5,-18 7,0 Z" fill="#451a03" />
        <path d="M-3,-28 L-19,-45 M3,-32 L18,-47" stroke="#451a03" stroke-width="3.2" stroke-linecap="round" />
        <path d="M-38,-48 C-48,-68 -32,-92 -8,-94 C4,-106 28,-98 34,-80 C48,-72 44,-44 24,-36 C6,-28 -26,-30 -38,-48 Z" fill="#9a3412" />
        <path d="M-34,-54 C-42,-74 -26,-96 -4,-98 C10,-108 32,-96 34,-76 C44,-66 36,-44 16,-40 C-4,-34 -26,-38 -34,-54 Z" fill="#dc2626" />
        <path d="M-24,-68 C-28,-84 -12,-98 6,-96 C18,-102 30,-88 24,-72 C12,-62 -16,-56 -24,-68 Z" fill="#f59e0b" />
        <path d="M-16,-78 C-16,-90 -4,-96 8,-92 C16,-94 22,-84 16,-74 C6,-68 -10,-68 -16,-78 Z" fill="#fde047" opacity="0.52" />
      </g>

      <g id="aspenTreeRich">
        <path d="M-3.5,0 L-2,-66 L2,-66 L3.5,0 Z" fill="#f5f5f4" />
        <line x1="-2.5" y1="-18" x2="1.5" y2="-18" stroke="#44403c" stroke-width="1.8" />
        <line x1="-2" y1="-34" x2="2" y2="-34" stroke="#44403c" stroke-width="1.6" />
        <line x1="-1.5" y1="-48" x2="1.5" y2="-48" stroke="#44403c" stroke-width="1.4" />
        <path d="M0,-108 C-23,-100 -31,-72 -24,-52 C-18,-38 18,-38 24,-52 C31,-72 23,-100 0,-108 Z" fill="#ca8a04" />
        <path d="M-2,-106 C-21,-96 -26,-70 -18,-53 C-10,-42 12,-46 18,-62 C22,-78 12,-98 -2,-106 Z" fill="#facc15" />
        <path d="M-6,-102 C-18,-92 -22,-72 -14,-58 C-4,-52 8,-62 8,-78 C8,-92 2,-100 -6,-102 Z" fill="#fef08a" opacity="0.68" />
      </g>

      <g id="oakTreeRich">
        <path d="M-6.5,0 C-4.5,-16 -4,-30 -3,-48 L3,-48 C4,-30 4.5,-16 6.5,0 Z" fill="#3b1d0c" />
        <path d="M-34,-44 C-46,-62 -34,-86 -10,-90 C2,-102 26,-96 34,-78 C46,-68 42,-42 22,-34 C4,-28 -22,-28 -34,-44 Z" fill="#7c2d12" />
        <path d="M-28,-50 C-38,-68 -24,-88 -4,-92 C10,-100 30,-90 32,-72 C40,-62 32,-42 14,-38 C-4,-34 -20,-38 -28,-50 Z" fill="#ea580c" />
        <path d="M-18,-64 C-22,-78 -8,-90 8,-88 C18,-92 26,-80 20,-66 C10,-58 -12,-54 -18,-64 Z" fill="#fbbf24" opacity="0.82" />
      </g>

      <!-- Painterly Multi-Tone Cloud Symbol -->
      <g id="cloudRich">
        <path d="M0,48 Q18,12 64,18 Q95,-12 148,6 Q190,-2 208,30 Q238,34 232,54 L-6,54 Z" fill="url(#cloudGrad)" />
        <path d="M18,46 Q34,20 72,24 Q100,2 144,16 Q178,10 194,34" fill="none" stroke="#fffbeb" stroke-width="2.5" opacity="0.55" stroke-linecap="round" />
      </g>

      <!-- Telegraph Pole & Sagging Wires Tile (380px wide, 0.56x behind midground!) -->
      <g id="telegraphTile">
        <rect x="60" y="695" width="6.5" height="205" fill="#3b1d0c" />
        <rect x="60" y="695" width="2" height="205" fill="#92400e" opacity="0.55" />
        <rect x="43" y="708" width="40" height="4.5" rx="2" fill="#451a03" />
        <rect x="48" y="724" width="30" height="4" rx="2" fill="#451a03" />
        <ellipse cx="48" cy="705" rx="2.2" ry="3" fill="#bae6fd" opacity="0.85" />
        <ellipse cx="78" cy="705" rx="2.2" ry="3" fill="#bae6fd" opacity="0.85" />
        <path d="M63,708 Q253,732 443,708" stroke="#1e293b" stroke-width="1.2" fill="none" opacity="0.40" />
        <path d="M63,724 Q253,746 443,724" stroke="#1e293b" stroke-width="1" fill="none" opacity="0.32" />
      </g>

      <!-- Trackside Embankment Tile (640px seamless, 1.00x wheel-locked!) -->
      <g id="embankmentTile">
        <path d="M0,888 Q160,872 320,888 T640,888 L640,985 L0,985 Z" fill="#43200d" />
        <path d="M0,888 Q160,872 320,888 T640,888" stroke="#92400e" stroke-width="3" fill="none" opacity="0.58" />
        <ellipse cx="95" cy="915" rx="18" ry="5.5" fill="#291206" opacity="0.62" />
        <ellipse cx="295" cy="908" rx="15" ry="5" fill="#5c2d16" opacity="0.58" />
        <ellipse cx="495" cy="916" rx="22" ry="6" fill="#291206" opacity="0.62" />
        <!-- Autumn grass tufts & tiny pebbles -->
        <path d="M180,886 Q174,870 169,866 M182,886 Q183,868 186,864 M185,886 Q192,873 197,870" stroke="#d97706" stroke-width="2.2" fill="none" stroke-linecap="round" />
        <path d="M540,888 Q534,873 529,869 M543,888 Q545,870 548,866 M546,888 Q553,875 558,872" stroke="#eab308" stroke-width="2.2" fill="none" stroke-linecap="round" />
        <circle cx="388" cy="904" r="3" fill="#78350f" /><circle cx="397" cy="907" r="2.2" fill="#92400e" />
      </g>

      <!-- Foreground Fast Pass-By Fence, Autumn Brush & Milepost Tile (960px wide, 1.65x speed) -->
      <g id="foregroundPassTile">
        <g opacity="0.94">
          <rect x="110" y="996" width="13" height="84" rx="3" fill="#241006" />
          <rect x="410" y="998" width="13" height="82" rx="3" fill="#241006" />
          <line x1="92" y1="1014" x2="432" y2="1014" stroke="#36190a" stroke-width="6.5" stroke-linecap="round" />
          <line x1="92" y1="1038" x2="432" y2="1038" stroke="#36190a" stroke-width="6.5" stroke-linecap="round" />
        </g>
        <path d="M485,1080 C495,1040 535,1026 568,1038 C588,1016 632,1020 648,1044 C672,1036 698,1054 704,1080 Z" fill="#1c0c05" />
        <path d="M525,1080 C535,1050 562,1040 585,1050 C602,1034 632,1038 644,1058 L655,1080 Z" fill="#9a3412" opacity="0.72" />
        <rect x="835" y="1004" width="16" height="76" rx="2.5" fill="#e7e5e4" stroke="#44403c" stroke-width="1.5" />
        <rect x="835" y="1004" width="16" height="17" fill="#1e293b" />
        <circle cx="843" cy="1030" r="2.2" fill="#44403c" />
      </g>

      <!-- Heirloom Spoked Car Wheel (R=16) -->
      <g id="carWheel16">
        <circle r="16" fill="#0f172a" stroke="#e2e8f0" stroke-width="3" />
        <circle r="12" fill="none" stroke="#64748b" stroke-width="1.2" />
        <g id="cw16Spokes">
        <line x1="-12" y1="0" x2="12" y2="0" stroke="#94a3b8" stroke-width="1.8" />
        <line x1="0" y1="-12" x2="0" y2="12" stroke="#94a3b8" stroke-width="1.8" />
        <line x1="-8.5" y1="-8.5" x2="8.5" y2="8.5" stroke="#94a3b8" stroke-width="1.5" />
        <line x1="8.5" y1="-8.5" x2="-8.5" y2="8.5" stroke="#94a3b8" stroke-width="1.5" />
        </g>
        <circle id="cw16Blur" r="12" fill="#94a3b8" opacity="0" />
        <circle r="4.8" fill="url(#brassGrad)" stroke="#451a03" stroke-width="0.8" />
      </g>
    </defs>

    <!-- 1. ATMOSPHERIC SKYDOME -->
    <rect width="1920" height="1080" fill="url(#skyGrad)" />
    <rect width="1920" height="1080" fill="url(#sunGlow)" style="opacity: var(--sun-op)" />
    <g style="opacity: var(--stars-op)">
      <circle cx="190" cy="96" r="2.2" fill="#fff" /><circle cx="345" cy="135" r="1.4" fill="#fef08a" />
      <circle cx="420" cy="78" r="1.9" fill="#fef08a" /><circle cx="690" cy="118" r="2.4" fill="#fff" />
      <circle cx="910" cy="74" r="1.6" fill="#fff" /><circle cx="1080" cy="88" r="2.1" fill="#fff" />
      <circle cx="1290" cy="145" r="2.3" fill="#fef08a" /><circle cx="1610" cy="95" r="1.8" fill="#fff" />
      <!-- Harvest Moon with Subtle Maria Craters & Halo -->
      <circle cx="1445" cy="182" r="96" fill="#fde68a" opacity="0.14" />
      <circle cx="1445" cy="182" r="54" fill="#fef3c7" opacity="0.96" />
      <circle cx="1430" cy="166" r="10" fill="#fde68a" opacity="0.34" />
      <circle cx="1462" cy="196" r="7" fill="#fde68a" opacity="0.32" />
      <circle cx="1456" cy="162" r="5" fill="#fde68a" opacity="0.26" />
    </g>

    <!-- PLANE 1A (0.08x): High Distant Cloud Deck -->
    <g id="cloudPlaneFar" opacity="0.36" style="will-change: transform;">
      <use href="#cloudRich" transform="translate(460, 125) scale(0.75)" />
      <use href="#cloudRich" transform="translate(1220, 148) scale(0.68)" />
      <use href="#cloudRich" transform="translate(2380, 125) scale(0.75)" />
      <use href="#cloudRich" transform="translate(3140, 148) scale(0.68)" />
    </g>

    <!-- PLANE 1B (0.14x): Sculpted Painterly Cumulus Clouds -->
    <g id="cloudPlane" opacity="0.62" style="will-change: transform;">
      <use href="#cloudRich" transform="translate(110, 118) scale(1.05)" />
      <use href="#cloudRich" transform="translate(820, 172) scale(0.82)" />
      <use href="#cloudRich" transform="translate(1470, 108) scale(0.95)" />
      <use href="#cloudRich" transform="translate(2030, 118) scale(1.05)" />
      <use href="#cloudRich" transform="translate(2740, 172) scale(0.82)" />
      <use href="#cloudRich" transform="translate(3390, 108) scale(0.95)" />
    </g>

    <!-- ======================================================================= -->
    <!-- PLANE 2 (0.44x): FAR HORIZON BY US REGION (Faceted 3D Relief & Birds)   -->
    <!-- ======================================================================= -->
    <g id="farWorld" style="will-change: transform;">
      <!-- 0: Pacific Coast — Procedural Golden Marin Headlands, Wave Field, Sun Glitter & Sea Stacks -->
      <g id="far-0">
        <g id="pacificProc"></g>
        <!-- California Gray Whale Arching & Spouting Offshore -->
        <g transform="translate(1185, 680)">
          <g class="whale-spout">
            <path d="M-4,-6 C-10,-28 -18,-36 -24,-34 M-4,-6 C2,-28 10,-36 16,-34" stroke="#e0f2fe" stroke-width="3.2" fill="none" stroke-linecap="round" />
            <circle cx="-18" cy="-35" r="4.5" fill="#f8fafc" opacity="0.8" />
            <circle cx="12" cy="-35" r="4.5" fill="#f8fafc" opacity="0.8" />
          </g>
          <path d="M-38,8 C-26,-10 4,-10 22,4 C28,8 36,2 44,-6 C40,4 34,10 26,10 L-42,10 Z" fill="#334155" />
          <path d="M-26,4 C-14,-4 4,-4 16,4" stroke="#94a3b8" stroke-width="2" fill="none" opacity="0.55" />
          <path class="surf-foam" d="M-46,10 Q-12,15 36,10" stroke="#e0f2fe" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>
        <g data-flock="gulls" transform="translate(185, 210)"></g>
        <g data-flock="gulls" transform="translate(1165, 205)"></g>
      </g>

      <!-- 1: Southwest Desert — Procedural Stratified Buttes, Talus Skirts & Hazy Mesa Skylines -->
      <g id="far-1">
        <g id="desertProc"></g>
        <g data-flock="hawk" transform="translate(1225, 222)"></g>
      </g>

      <!-- 2: Rocky Mountains — Procedurally Sculpted Craggy Massifs, Snowfields, Waterfall & Forest -->
      <g id="far-2">
        <g id="rockiesProc"></g>
        <g data-flock="geese" transform="translate(1185, 218)"></g>
      </g>

      <!-- 3: Heartland Plains — Rolling Golden Wheat Swells & Twin Patchwork Balloons -->
      <g id="far-3">
        <!-- Distant smaller hot-air balloon -->
        <g transform="translate(1425, 250) scale(0.62)">
          <g class="balloon-bob" style="animation-delay: -2.1s">
            <ellipse cx="-18" cy="0" rx="18" ry="28" fill="#1d4ed8" />
            <ellipse cx="18" cy="0" rx="18" ry="28" fill="#1e40af" />
            <ellipse cx="0" cy="0" rx="22" ry="30" fill="#f59e0b" />
            <path d="M-32,-2 Q0,8 32,-2" stroke="#fef08a" stroke-width="3.5" fill="none" />
            <line x1="-10" y1="28" x2="-6" y2="44" stroke="#78350f" stroke-width="1.5" />
            <line x1="10" y1="28" x2="6" y2="44" stroke="#78350f" stroke-width="1.5" />
            <rect x="-9" y="44" width="18" height="12" rx="2" fill="#92400e" />
          </g>
        </g>
        <!-- Hero Patchwork Harvest Hot-Air Balloon -->
        <g transform="translate(345, 212)">
          <g class="balloon-bob">
            <ellipse cx="-22" cy="0" rx="22" ry="34" fill="#c2410c" />
            <ellipse cx="22" cy="0" rx="22" ry="34" fill="#9a3412" />
            <ellipse cx="0" cy="0" rx="26" ry="36" fill="#ea580c" />
            <path d="M-38,-3 Q0,9 38,-3" stroke="#fde68a" stroke-width="4" fill="none" />
            <path d="M-36,7 Q0,19 36,7" stroke="#15803d" stroke-width="3.2" fill="none" />
            <circle cx="0" cy="40" r="5.5" fill="#fef08a" />
            <line x1="-14" y1="32" x2="-8" y2="50" stroke="#78350f" stroke-width="1.4" />
            <line x1="14" y1="32" x2="8" y2="50" stroke="#78350f" stroke-width="1.4" />
            <rect x="-11" y="50" width="22" height="14" rx="3" fill="#a16207" stroke="#451a03" stroke-width="1.4" />
          </g>
        </g>
        <!-- Layered Rolling Amber Prairie Hills -->
        <path d="M-360,900 L-220,732 Q460,656 1060,698 T2360,732 L2360,900 Z" fill="url(#wheatGrad)" />
        <g stroke="#b45309" stroke-width="2.4" fill="none" opacity="0.45">
          <path d="M40,722 Q340,685 640,715" /><path d="M80,742 Q340,705 620,735" />
          <path d="M1220,718 Q1540,692 1860,725" /><path d="M1240,738 Q1540,712 1840,745" />
        </g>
      </g>

      <!-- 4: Great Smoky Mountains — Procedural Canopy-Textured Blue Ridges & Volumetric Mist -->
      <g id="far-4">
        <g id="smokiesProc"></g>
        <g data-flock="geese" transform="translate(1185, 222)"></g>
      </g>

      <!-- 5: New York — Procedural Manhattan Skyline (Art-Deco Landmarks, Window Grids, Water Towers, Reflections) -->
      <g id="far-5">
        <g id="nycProc"></g>
      </g>

      <!-- 6: East Coast — Procedural Atlantic Wave Field, Moon Glitter, Distant Shore & Sails -->
      <g id="far-6">
        <g id="atlanticProc"></g>
        <!-- Full-rigged New England Schooner -->
        <g transform="translate(1310, 676)">
          <g class="ferry-bob">
            <path d="M-34,12 L36,12 L25,24 L-23,24 Z" fill="#451a03" />
            <line x1="-30" y1="15" x2="31" y2="15" stroke="#fde68a" stroke-width="1.6" />
            <line x1="-4" y1="12" x2="-4" y2="-40" stroke="#78350f" stroke-width="2" />
            <line x1="2" y1="12" x2="2" y2="-48" stroke="#78350f" stroke-width="2" />
            <path d="M-5,10 L-5,-38 Q-19,-12 -29,10 Z" fill="#fffbeb" />
            <path d="M3,10 L3,-46 Q20,-16 30,10 Z" fill="#fef3c7" />
            <path d="M7,-36 L36,8 L7,8 Z" fill="#fde68a" opacity="0.88" />
            <path d="M-40,24 Q0,28 40,24" stroke="#e0f2fe" stroke-width="2.2" fill="none" opacity="0.7" />
          </g>
        </g>
        <g data-flock="gulls" transform="translate(1185, 212)"></g>
      </g>
    </g>

    <!-- Soft Atmospheric Haze Veil between Far & Midground -->
    <rect width="1920" height="840" fill="url(#horizonHaze)" style="opacity: var(--haze-op); pointer-events: none;" />

    <!-- PLANE 2.6 (0.56x): Distant Railway Telegraph Line (behind midground landmarks & signs!) -->
    <g id="telegraphPlane" opacity="0.46" style="will-change: transform;">
      <use href="#telegraphTile" x="0" /><use href="#telegraphTile" x="380" /><use href="#telegraphTile" x="760" />
      <use href="#telegraphTile" x="1140" /><use href="#telegraphTile" x="1520" /><use href="#telegraphTile" x="1900" /><use href="#telegraphTile" x="2280" />
    </g>

    <!-- ======================================================================= -->
    <!-- PLANE 3 (0.65x): MIDGROUND SCENIC WORLD & FLUID ARTICULATED CHARACTERS  -->
    <!-- ======================================================================= -->
    <g id="midWorld" style="will-change: transform;">
      <!-- 0: Pacific Golden Gate Bridge, Big Sur Cliffs & Layered Redwoods -->
      <g id="mid-0">
        <g transform="translate(95, 430)">
          <path d="M-120,195 Q45,235 110,25 Q245,245 380,25 Q475,215 620,238" stroke="#c2410c" stroke-width="5.5" fill="none" />
          <g stroke="#ea580c" stroke-width="1.5" opacity="0.8">
            <line x1="145" y1="95" x2="145" y2="232"/><line x1="185" y1="148" x2="185" y2="232"/>
            <line x1="225" y1="176" x2="225" y2="232"/><line x1="265" y1="176" x2="265" y2="232"/>
            <line x1="305" y1="148" x2="305" y2="232"/><line x1="345" y1="95" x2="345" y2="232"/>
          </g>
          <rect x="-120" y="228" width="740" height="13" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5" />
          <g fill="#dc2626" stroke="#7f1d1d" stroke-width="1.8">
            <rect x="96" y="18" width="10" height="245" /><rect x="114" y="18" width="10" height="245" />
            <rect x="96" y="45" width="28" height="7" /><rect x="96" y="95" width="28" height="7" /><rect x="96" y="150" width="28" height="7" />
            <rect x="366" y="18" width="10" height="245" /><rect x="384" y="18" width="10" height="245" />
            <rect x="366" y="45" width="28" height="7" /><rect x="366" y="95" width="28" height="7" /><rect x="366" y="150" width="28" height="7" />
          </g>
          <rect x="90" y="255" width="40" height="24" rx="2" fill="#cbd5e1" /><rect x="360" y="255" width="40" height="24" rx="2" fill="#cbd5e1" />
        </g>
        <!-- Craggy Big Sur Headland Cliffs & Towering Redwoods -->
        <g id="pacificCliffProc"></g>
        <path class="surf-foam" d="M1125,795 Q1195,786 1265,795" stroke="#e0f2fe" stroke-width="4.5" fill="none" stroke-linecap="round" />
        <use href="#pineTreeRich" transform="translate(1470, 665) scale(1.22)" />
        <use href="#pineTreeRich" transform="translate(1568, 648) scale(1.52)" />
        <use href="#pineTreeRich" transform="translate(1660, 678) scale(1.14)" />
        <path d="M-450,900 Q-180,805 60,795 Q520,782 1060,822 T2380,805 L2380,900 Z" fill="#78350f" />
        <g transform="translate(1265, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#3f2211" /><rect x="158" y="0" width="10" height="68" fill="#3f2211" />
          <rect x="-14" y="-42" width="196" height="52" rx="8" fill="#0f766e" stroke="#fde68a" stroke-width="2.5" />
          <text x="84" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">Pacific Coast · Mile 0</text>
          <text x="84" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">Eastbound to Feast!</text>
        </g>
      </g>

      <!-- 1: Southwest Desert — Dunes, Ribbed Saguaros, Prickly Pear & Articulated Chase -->
      <g id="mid-1">
        <path d="M-450,900 Q-180,785 80,748 Q520,698 1060,742 T2380,765 L2380,900 Z" fill="#ea580c" />
        <path d="M-450,900 Q-160,810 80,794 Q580,758 1140,796 T2380,802 L2380,900 Z" fill="#d97706" />
        <g fill="#15803d" stroke="#14532d" stroke-width="2">
          <g transform="translate(125, 692)">
            <rect x="-9" y="0" width="18" height="100" rx="9" />
            <line x1="-3" y1="8" x2="-3" y2="92" stroke="#4ade80" stroke-width="1.3" opacity="0.45" />
            <path d="M-9,46 L-28,46 Q-36,46 -36,36 L-36,14 Q-36,6 -28,6 Q-20,6 -20,14 L-20,34 L-9,34 Z" />
            <path d="M9,58 L26,58 Q34,58 34,48 L34,24 Q34,16 26,16 Q18,16 18,24 L18,46 L9,46 Z" />
            <circle cx="0" cy="-2" r="3.8" fill="#fef08a" stroke="none" />
          </g>
          <!-- Blooming Prickly Pear Cluster -->
          <g transform="translate(425, 782)">
            <ellipse cx="-12" cy="-6" rx="11" ry="15" transform="rotate(-24 -12 -6)" />
            <ellipse cx="10" cy="-8" rx="11" ry="15" transform="rotate(22 10 -8)" />
            <ellipse cx="0" cy="-14" rx="10" ry="14" />
            <circle cx="0" cy="-29" r="3.5" fill="#f43f5e" stroke="none" />
            <circle cx="15" cy="-22" r="3" fill="#fbbf24" stroke="none" />
          </g>
          <g transform="translate(1665, 682)">
            <rect x="-10" y="0" width="20" height="110" rx="10" />
            <line x1="-3" y1="8" x2="-3" y2="100" stroke="#4ade80" stroke-width="1.3" opacity="0.45" />
            <path d="M-10,50 L-30,50 Q-38,50 -38,40 L-38,16 Q-38,8 -30,8 Q-22,8 -22,16 L-22,38 L-10,38 Z" />
            <path d="M10,40 L28,40 Q36,40 36,30 L36,10 Q36,2 28,2 Q20,2 20,10 L20,28 L10,28 Z" />
          </g>
        </g>
        <!-- Procedurally-animated 4-Legged Fox + Pilgrim + Runaway Turkey Chase! -->
        <g data-chase="1" transform="translate(115, 792)"></g>
        <g transform="translate(1265, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#451a03" /><rect x="166" y="0" width="10" height="68" fill="#451a03" />
          <rect x="-14" y="-42" width="204" height="52" rx="8" fill="#9a3412" stroke="#fde68a" stroke-width="2.5" />
          <text x="88" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">Red Rock Desert, AZ</text>
          <text x="88" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">5 Stops to Feast!</text>
        </g>
      </g>

      <!-- 2: Rockies Glacial Lake, Reflections, Bull Elk, Canoe & Alpine Groves -->
      <g id="mid-2">
        <rect x="-460" y="728" width="2880" height="84" fill="url(#lakeAlpineGrad)" />
        <polygon points="115,730 275,730 195,782" fill="#bae6fd" opacity="0.28" />
        <polygon points="1325,730 1485,730 1405,780" fill="#bae6fd" opacity="0.28" />
        <g class="wave-swell" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.65">
          <line x1="250" y1="752" x2="345" y2="752" /><line x1="1150" y1="762" x2="1260" y2="762" />
        </g>
        <!-- Red Wooden Canoe + Paddler -->
        <g transform="translate(345, 764)">
          <g class="ferry-bob">
            <circle cx="-2" cy="-12" r="4.5" fill="#f3c69f" />
            <path d="M-7,-3 L6,-3 L4,-9 L-5,-9 Z" fill="#d97706" />
            <line x1="2" y1="-8" x2="14" y2="6" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round" />
            <path d="M-30,-2 Q0,14 30,-2 Q18,3 -30,-2 Z" fill="#b91c1c" stroke="#fde68a" stroke-width="1.2" />
          </g>
        </g>
        <path d="M-450,900 Q-160,804 60,790 Q520,768 1040,798 T2380,798 L2380,900 Z" fill="#365314" />
        <use href="#pineTreeRich" transform="translate(35, 792) scale(1.1)" />
        <use href="#pineTreeRich" transform="translate(95, 790) scale(0.95)" />
        <use href="#pineTreeRich" transform="translate(154, 792) scale(0.8)" />
        <use href="#aspenTreeRich" transform="translate(212, 790) scale(0.88)" />
        <use href="#aspenTreeRich" transform="translate(256, 794) scale(0.74)" />
        <!-- Procedural Bull Elk: walks the lakeshore, pauses to graze, turns back -->
        <g data-elk="1" transform="translate(1095, 790) scale(1.25)"></g>
        <use href="#aspenTreeRich" transform="translate(1510, 792) scale(0.86)" />
        <use href="#pineTreeRich" transform="translate(1575, 792) scale(1.05)" />
        <use href="#pineTreeRich" transform="translate(1645, 795) scale(1.18)" />
        <g transform="translate(1245, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#3f2211" /><rect x="166" y="0" width="10" height="68" fill="#3f2211" />
          <rect x="-14" y="-42" width="204" height="52" rx="8" fill="#334155" stroke="#fde68a" stroke-width="2.5" />
          <text x="88" y="-17" text-anchor="middle" fill="#f8fafc" font-family="'Caveat', cursive" font-size="24" font-weight="700">Rocky Mountains, CO</text>
          <text x="88" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">Continental Divide</text>
        </g>
      </g>

      <!-- 3: Heartland Plains — Gambrel Barn, Multi-Blade Aermotor Windmill, Shaggy Bison & Chase -->
      <g id="mid-3">
        <path d="M-450,900 Q-160,790 60,765 Q520,738 1040,765 T2380,775 L2380,900 Z" fill="#ca8a04" />
        <g transform="translate(195, 698)">
          <rect x="-78" y="-44" width="38" height="98" fill="#e7e5e4" stroke="#a8a29e" stroke-width="1.5" />
          <polygon points="-82,-44 -59,-64 -36,-44" fill="#57534e" />
          <rect x="84" y="-28" width="34" height="80" rx="4" fill="#d6d3d1" />
          <path d="M84,-28 A17,15 0 0,1 118,-28 Z" fill="#78716c" />
          <rect x="0" y="6" width="88" height="46" fill="#991b1b" />
          <polygon points="-8,8 14,-16 44,-28 74,-16 96,8" fill="#3f1d0b" stroke="#fde68a" stroke-width="1.2" />
          <rect x="36" y="-12" width="16" height="13" rx="2" style="fill: var(--win-glow)" />
          <rect x="26" y="20" width="36" height="32" fill="#451a03" stroke="#fef3c7" stroke-width="1.8" />
          <path d="M26,20 L62,52 M62,20 L26,52" stroke="#fef3c7" stroke-width="1.8" />
          <!-- Classic 12-Blade Aermotor Farm Windmill -->
          <g transform="translate(154, -2)">
            <polygon points="-10,54 10,54 3,-12 -3,-12" fill="none" stroke="#5c3312" stroke-width="2.4" />
            <line x1="-6" y1="28" x2="6" y2="28" stroke="#5c3312" stroke-width="1.8" />
            <line x1="-4" y1="10" x2="4" y2="10" stroke="#5c3312" stroke-width="1.6" />
            <g transform="translate(0, -12)">
              <g class="windmill-blades">
                <circle r="26" fill="none" stroke="#fef3c7" stroke-width="1.5" opacity="0.7" />
                <g stroke="#fef3c7" stroke-width="2.2">
                  <line x1="0" y1="-27" x2="0" y2="27"/><line x1="-27" y1="0" x2="27" y2="0"/>
                  <line x1="-19" y1="-19" x2="19" y2="19"/><line x1="19" y1="-19" x2="-19" y2="19"/>
                  <line x1="-10" y1="-25" x2="10" y2="25"/><line x1="25" y1="-10" x2="-25" y2="10"/>
                </g>
                <circle r="4.5" fill="#b45309" stroke="#fef3c7" stroke-width="1.2" />
              </g>
            </g>
          </g>
        </g>
        <!-- Anatomical Shaggy American Bison Herd -->
        <g transform="translate(1475, 742)">
          <path d="M-12,-16 C4,-20 24,-10 26,6 L22,18 L16,18 L15,6 L6,6 L5,18 L-1,18 L-2,4 Z" fill="#451a03" />
          <path d="M-24,6 C-28,-16 -12,-28 2,-16 C6,-4 -4,10 -14,10 L-15,18 L-21,18 L-20,6 Z" fill="#291206" />
          <g class="bison-head">
            <path d="M-20,-10 C-32,-10 -38,0 -34,10 C-28,12 -20,8 -18,0 Z" fill="#1c0c05" />
            <path d="M-27,-6 Q-31,-14 -24,-15" stroke="#e7e5e4" stroke-width="2.2" fill="none" stroke-linecap="round" />
          </g>
          <g transform="translate(78, 5) scale(0.82)">
            <path d="M-12,-16 C4,-20 24,-10 26,6 L22,18 L16,18 L15,6 L-2,6 Z" fill="#451a03" />
            <path d="M-24,6 C-28,-16 -12,-28 2,-16 C6,-4 -4,10 -14,10 L-15,18 L-21,18 Z" fill="#291206" />
            <path d="M-20,-10 C-32,-10 -38,0 -34,10 C-28,12 -20,8 -18,0 Z" fill="#1c0c05" />
          </g>
        </g>
        <path d="M-450,900 Q-160,815 60,794 Q520,782 1040,804 T2380,802 L2380,900 Z" fill="#a16207" />
        <g data-chase="1" transform="translate(95, 792)"></g>
        <g transform="translate(1265, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#451a03" /><rect x="166" y="0" width="10" height="68" fill="#451a03" />
          <rect x="-14" y="-42" width="204" height="52" rx="8" fill="#854d0e" stroke="#fde68a" stroke-width="2.5" />
          <text x="88" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">Heartland Plains, KS</text>
          <text x="88" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">Amber Waves of Grain</text>
        </g>
      </g>

      <!-- 4: Smoky Mountains — Appalachian Autumn Tapestry, Cabin, Fireflies & Waving Bear + Cub -->
      <g id="mid-4">
        <g id="smokiesMidProc"></g>
        <use href="#oakTreeRich" transform="translate(-15, 735) scale(0.88)" />
        <use href="#mapleTreeRich" transform="translate(52, 728) scale(0.82)" />
        <use href="#aspenTreeRich" transform="translate(278, 706) scale(0.76)" />
        <use href="#oakTreeRich" transform="translate(338, 704) scale(0.84)" />
        <use href="#pineTreeRich" transform="translate(1310, 725) scale(0.78)" />
        <use href="#mapleTreeRich" transform="translate(1375, 722) scale(0.85)" />
        <use href="#oakTreeRich" transform="translate(1455, 726) scale(0.9)" />
        <g class="mist-2">
          <rect x="80" y="712" width="680" height="36" fill="url(#mistRibbonGrad)" />
          <rect x="1060" y="706" width="720" height="38" fill="url(#mistRibbonGrad)" />
        </g>
        <path d="M-450,900 Q-150,815 65,794 Q520,762 1040,795 T2380,802 L2380,900 Z" fill="#7c2d12" />
        <use href="#pineTreeRich" transform="translate(20, 792) scale(0.95)" />
        <use href="#mapleTreeRich" transform="translate(75, 788) scale(0.88)" />
        <use href="#oakTreeRich" transform="translate(310, 785) scale(0.92)" />
        <use href="#aspenTreeRich" transform="translate(372, 788) scale(0.84)" />
        <use href="#mapleTreeRich" transform="translate(435, 790) scale(0.94)" />
        <use href="#oakTreeRich" transform="translate(1495, 790) scale(0.95)" />
        <use href="#mapleTreeRich" transform="translate(1568, 788) scale(1.05)" />
        <use href="#aspenTreeRich" transform="translate(1638, 792) scale(0.88)" />
        <use href="#pineTreeRich" transform="translate(1695, 794) scale(0.96)" />
        <!-- Glowing Smoky Mountain Dusk Fireflies -->
        <g style="opacity: var(--lantern-op)">
          <circle class="firefly" cx="255" cy="742" r="3" fill="#fef08a" />
          <circle class="firefly" style="animation-delay: -1.4s" cx="395" cy="755" r="2.6" fill="#fde047" />
          <circle class="firefly" style="animation-delay: -2.6s" cx="1445" cy="745" r="2.8" fill="#fef08a" />
        </g>
        <!-- Bounding White-Tailed Deer (procedural pronk gait) -->
        <g data-deer="1" transform="translate(1045, 797) scale(1.35)"></g>
        <!-- Cozy Log Cabin + Waving Black Bear & Bouncing Cub -->
        <g transform="translate(135, 735)">
          <g transform="translate(66, -36)"><circle class="chimney-1" cx="0" cy="0" r="8" fill="#f8fafc" opacity="0.72" /><circle class="chimney-2" cx="4" cy="-5" r="7" fill="#f8fafc" opacity="0.62" /></g>
          <rect x="58" y="-32" width="15" height="46" rx="2" fill="#78716c" />
          <rect x="0" y="0" width="80" height="45" fill="#78350f" stroke="#3f1d0b" stroke-width="2" />
          <line x1="-4" y1="11" x2="84" y2="11" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" />
          <line x1="-4" y1="22" x2="84" y2="22" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" />
          <line x1="-4" y1="33" x2="84" y2="33" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" />
          <polygon points="-12,3 40,-30 92,3" fill="#3b1d0c" stroke="#291206" stroke-width="1.5" />
          <rect x="14" y="14" width="20" height="17" rx="2" style="fill: var(--win-glow)" stroke="#3f1d0b" stroke-width="1.5" />
          <line x1="24" y1="14" x2="24" y2="31" stroke="#3f1d0b" stroke-width="1.2" />
          <rect x="46" y="15" width="15" height="30" rx="1.5" fill="#451a03" />
          <!-- Warm Porch Lantern -->
          <circle cx="67" cy="20" r="10" fill="url(#warmLantern)" style="opacity: var(--lantern-op)" />
          <circle cx="67" cy="20" r="2.2" fill="#fef08a" />
          <!-- Friendly Mama Bear waving + Bouncing Cub -->
          <g transform="translate(-52, 24)">
            <ellipse cx="0" cy="8" rx="15" ry="16" fill="#1c1917" />
            <ellipse cx="0" cy="10" rx="8" ry="10" fill="#292524" />
            <path class="bear-paw-wave" d="M10,2 C20,-4 24,-12 20,-16 C16,-18 11,-10 8,-2 Z" fill="#1c1917" />
            <circle cx="0" cy="-10" r="11" fill="#1c1917" />
            <circle cx="-9" cy="-18" r="4.5" fill="#1c1917" /><circle cx="-9" cy="-18" r="2.2" fill="#78350f" />
            <circle cx="9" cy="-18" r="4.5" fill="#1c1917" /><circle cx="9" cy="-18" r="2.2" fill="#78350f" />
            <ellipse cx="0" cy="-7" rx="5" ry="4" fill="#b4835b" />
            <circle cx="0" cy="-9" r="2" fill="#09090b" />
            <g class="blink-eye"><circle cx="-4" cy="-12" r="1.6" fill="#fff" /><circle cx="4" cy="-12" r="1.6" fill="#fff" /></g>
            <g transform="translate(24, 11) scale(0.64)">
              <g class="cub-bounce">
                <ellipse cx="0" cy="8" rx="14" ry="14" fill="#1c1917" /><circle cx="0" cy="-8" r="10" fill="#1c1917" />
                <circle cx="-8" cy="-15" r="4.2" fill="#1c1917" /><circle cx="8" cy="-15" r="4.2" fill="#1c1917" />
                <ellipse cx="0" cy="-6" rx="4.5" ry="3.5" fill="#b4835b" />
              </g>
            </g>
          </g>
        </g>
        <g transform="translate(1415, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#3f2211" /><rect x="166" y="0" width="10" height="68" fill="#3f2211" />
          <rect x="-14" y="-42" width="204" height="52" rx="8" fill="#4c1d95" stroke="#fde68a" stroke-width="2.5" />
          <text x="88" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">Smoky Mountains, TN</text>
          <text x="88" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">2 Stops to Feast!</text>
        </g>
      </g>

      <!-- 5: New York — Sculpted Lady Liberty, Staten Island Ferry & Brooklyn Bridge -->
      <g id="mid-5">
        <!-- Brooklyn Bridge: twin Gothic granite towers, catenary main cables, vertical suspenders & radiating diagonal stays -->
        <g>
          <rect x="790" y="686" width="1100" height="9" fill="#44403c" />
          <path d="M790,686 H1890" stroke="#d6d3d1" stroke-width="1.4" opacity="0.8" />
          <path d="M794,686 V695 M803,686 V695 M812,686 V695 M821,686 V695 M830,686 V695 M839,686 V695 M848,686 V695 M857,686 V695 M866,686 V695 M875,686 V695 M884,686 V695 M893,686 V695 M902,686 V695 M911,686 V695 M920,686 V695 M929,686 V695 M938,686 V695 M947,686 V695 M956,686 V695 M965,686 V695 M974,686 V695 M983,686 V695 M992,686 V695 M1001,686 V695 M1010,686 V695 M1019,686 V695 M1028,686 V695 M1037,686 V695 M1046,686 V695 M1055,686 V695 M1064,686 V695 M1073,686 V695 M1082,686 V695 M1091,686 V695 M1100,686 V695 M1109,686 V695 M1118,686 V695 M1127,686 V695 M1136,686 V695 M1145,686 V695 M1154,686 V695 M1163,686 V695 M1172,686 V695 M1181,686 V695 M1190,686 V695 M1199,686 V695 M1208,686 V695 M1217,686 V695 M1226,686 V695 M1235,686 V695 M1244,686 V695 M1253,686 V695 M1262,686 V695 M1271,686 V695 M1280,686 V695 M1289,686 V695 M1298,686 V695 M1307,686 V695 M1316,686 V695 M1325,686 V695 M1334,686 V695 M1343,686 V695 M1352,686 V695 M1361,686 V695 M1370,686 V695 M1379,686 V695 M1388,686 V695 M1397,686 V695 M1406,686 V695 M1415,686 V695 M1424,686 V695 M1433,686 V695 M1442,686 V695 M1451,686 V695 M1460,686 V695 M1469,686 V695 M1478,686 V695 M1487,686 V695 M1496,686 V695 M1505,686 V695 M1514,686 V695 M1523,686 V695 M1532,686 V695 M1541,686 V695 M1550,686 V695 M1559,686 V695 M1568,686 V695 M1577,686 V695 M1586,686 V695 M1595,686 V695 M1604,686 V695 M1613,686 V695 M1622,686 V695 M1631,686 V695 M1640,686 V695 M1649,686 V695 M1658,686 V695 M1667,686 V695 M1676,686 V695 M1685,686 V695 M1694,686 V695 M1703,686 V695 M1712,686 V695 M1721,686 V695 M1730,686 V695 M1739,686 V695 M1748,686 V695 M1757,686 V695 M1766,686 V695 M1775,686 V695 M1784,686 V695 M1793,686 V695 M1802,686 V695 M1811,686 V695 M1820,686 V695 M1829,686 V695 M1838,686 V695 M1847,686 V695 M1856,686 V695 M1865,686 V695 M1874,686 V695 M1883,686 V695" stroke="#a8a29e" stroke-width="0.8" opacity="0.5" />
          <g>
          <polygon points="1124,772 1176,772 1172,556 1128,556" fill="#b0a89f" />
          <polygon points="1155,772 1176,772 1172,556 1155,556" fill="#78716c" opacity="0.55" />
          <path d="M1125,570 H1175 M1125,583 H1175 M1125,596 H1175 M1125,609 H1175 M1125,622 H1175 M1125,635 H1175 M1125,648 H1175 M1125,661 H1175 M1125,674 H1175 M1125,687 H1175 M1125,700 H1175 M1125,713 H1175 M1125,726 H1175 M1125,739 H1175 M1125,752 H1175 M1125,765 H1175" stroke="#57534e" stroke-width="0.8" opacity="0.28" />
          <path d="M1132,692 V618 Q1132,600 1139,590 Q1146,600 1146,618 V692 Z" fill="#334155" />
          <path d="M1132,618 Q1132,600 1139,590 Q1146,600 1146,618" stroke="#e7e5e4" stroke-width="1.4" fill="none" opacity="0.7" />
          <path d="M1154,692 V618 Q1154,600 1161,590 Q1168,600 1168,618 V692 Z" fill="#334155" />
          <path d="M1154,618 Q1154,600 1161,590 Q1168,600 1168,618" stroke="#e7e5e4" stroke-width="1.4" fill="none" opacity="0.7" />
          <rect x="1123" y="548" width="54" height="9" fill="#d6d3d1" />
          <rect x="1125" y="557" width="50" height="3" fill="#78716c" />
          <rect x="1126" y="543" width="10" height="6" fill="#a8a29e" /><rect x="1164" y="543" width="10" height="6" fill="#a8a29e" />
          <rect x="1120" y="756" width="60" height="18" fill="#57534e" />
          </g>
          <g>
          <polygon points="1504,772 1556,772 1552,556 1508,556" fill="#b0a89f" />
          <polygon points="1535,772 1556,772 1552,556 1535,556" fill="#78716c" opacity="0.55" />
          <path d="M1505,570 H1555 M1505,583 H1555 M1505,596 H1555 M1505,609 H1555 M1505,622 H1555 M1505,635 H1555 M1505,648 H1555 M1505,661 H1555 M1505,674 H1555 M1505,687 H1555 M1505,700 H1555 M1505,713 H1555 M1505,726 H1555 M1505,739 H1555 M1505,752 H1555 M1505,765 H1555" stroke="#57534e" stroke-width="0.8" opacity="0.28" />
          <path d="M1512,692 V618 Q1512,600 1519,590 Q1526,600 1526,618 V692 Z" fill="#334155" />
          <path d="M1512,618 Q1512,600 1519,590 Q1526,600 1526,618" stroke="#e7e5e4" stroke-width="1.4" fill="none" opacity="0.7" />
          <path d="M1534,692 V618 Q1534,600 1541,590 Q1548,600 1548,618 V692 Z" fill="#334155" />
          <path d="M1534,618 Q1534,600 1541,590 Q1548,600 1548,618" stroke="#e7e5e4" stroke-width="1.4" fill="none" opacity="0.7" />
          <rect x="1503" y="548" width="54" height="9" fill="#d6d3d1" />
          <rect x="1505" y="557" width="50" height="3" fill="#78716c" />
          <rect x="1506" y="543" width="10" height="6" fill="#a8a29e" /><rect x="1544" y="543" width="10" height="6" fill="#a8a29e" />
          <rect x="1500" y="756" width="60" height="18" fill="#57534e" />
          </g>
          <path d="M1162,574.9 V686 M1173,587.7 V686 M1184,599.8 V686 M1195,610.9 V686 M1206,621.3 V686 M1217,630.9 V686 M1228,639.6 V686 M1239,647.5 V686 M1250,654.6 V686 M1261,660.9 V686 M1272,666.4 V686 M1283,671.0 V686 M1294,674.8 V686 M1305,677.9 V686 M1316,680.1 V686 M1327,681.4 V686 M1338,682.0 V686 M1349,681.7 V686 M1360,680.6 V686 M1371,678.8 V686 M1382,676.0 V686 M1393,672.5 V686 M1404,668.2 V686 M1415,663.0 V686 M1426,657.0 V686 M1437,650.2 V686 M1448,642.6 V686 M1459,634.1 V686 M1470,624.9 V686 M1481,614.8 V686 M1492,603.9 V686 M1503,592.2 V686 M1514,579.7 V686 M1138,566.6 V686 M1127,572.6 V686 M1116,578.4 V686 M1105,584.2 V686 M1094,589.8 V686 M1083,595.3 V686 M1072,600.7 V686 M1061,606.0 V686 M1050,611.2 V686 M1039,616.2 V686 M1028,621.2 V686 M1017,626.0 V686 M1006,630.8 V686 M995,635.4 V686 M984,639.9 V686 M973,644.3 V686 M962,648.6 V686 M951,652.8 V686 M940,656.8 V686 M929,660.8 V686 M918,664.6 V686 M907,668.4 V686 M896,672.0 V686 M885,675.5 V686 M874,678.9 V686 M863,682.2 V686 M852,685.4 V686 M841,688.5 V686 M830,691.4 V686 M1542,566.6 V686 M1553,572.6 V686 M1564,578.4 V686 M1575,584.2 V686 M1586,589.8 V686 M1597,595.3 V686 M1608,600.7 V686 M1619,606.0 V686 M1630,611.2 V686 M1641,616.2 V686 M1652,621.2 V686 M1663,626.0 V686 M1674,630.8 V686 M1685,635.4 V686 M1696,639.9 V686 M1707,644.3 V686 M1718,648.6 V686 M1729,652.8 V686 M1740,656.8 V686 M1751,660.8 V686 M1762,664.6 V686 M1773,668.4 V686 M1784,672.0 V686 M1795,675.5 V686 M1806,678.9 V686 M1817,682.2 V686 M1828,685.4 V686 M1839,688.5 V686 M1850,691.4 V686" stroke="#e7e5e4" stroke-width="0.8" opacity="0.55" />
          <path d="M1150,562 L1108,686 M1150,562 L1087,686 M1150,562 L1066,686 M1150,562 L1045,686 M1150,562 L1024,686 M1150,562 L1003,686 M1150,562 L982,686 M1150,562 L961,686 M1150,562 L1192,686 M1150,562 L1213,686 M1150,562 L1234,686 M1150,562 L1255,686 M1150,562 L1276,686 M1150,562 L1297,686 M1150,562 L1318,686 M1150,562 L1339,686 M1530,562 L1488,686 M1530,562 L1467,686 M1530,562 L1446,686 M1530,562 L1425,686 M1530,562 L1404,686 M1530,562 L1383,686 M1530,562 L1362,686 M1530,562 L1341,686 M1530,562 L1572,686 M1530,562 L1593,686 M1530,562 L1614,686 M1530,562 L1635,686 M1530,562 L1656,686 M1530,562 L1677,686 M1530,562 L1698,686 M1530,562 L1719,686" stroke="#e7e5e4" stroke-width="0.9" opacity="0.45" />
          <path d="M1150,560 Q1340,804 1530,560 M1150,560 Q985,652 820,694 M1530,560 Q1695,652 1860,694" stroke="#e7e5e4" stroke-width="2.8" fill="none" opacity="0.95" stroke-linecap="round" />
          <path d="M1150,564 Q1340,808 1530,564 M1150,564 Q985,656 820,694 M1530,564 Q1695,656 1860,694" stroke="#e7e5e4" stroke-width="1.8" fill="none" opacity="0.75" stroke-linecap="round" />
        </g>
        <g transform="translate(245, 650)">
          <polygon points="-32,84 32,84 26,64 -26,64" fill="#a8a29e" />
          <polygon points="-24,64 24,64 19,26 -19,26" fill="#d6d3d1" />
          <rect x="-23" y="20" width="46" height="7" fill="#a8a29e" />
          <path d="M-15,20 L-11,-36 L8,-38 L14,20 Z" fill="#34d399" />
          <path d="M-11,-12 Q2,-4 12,8" stroke="#059669" stroke-width="2" fill="none" />
          <circle cx="-1" cy="-45" r="8" fill="#34d399" />
          <path d="M-12,-48 L-17,-57 M-6,-52 L-9,-62 M0,-53 L0,-64 M6,-52 L9,-62 M11,-48 L16,-56" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round" />
          <path d="M6,-34 L17,-68" stroke="#34d399" stroke-width="5.5" stroke-linecap="round" />
          <circle cx="18" cy="-76" r="22" fill="url(#warmLantern)" />
          <path class="candle-flame" d="M18,-85 C23,-78 22,-71 18,-70 C14,-71 13,-78 18,-85 Z" fill="#fde047" />
        </g>
        <g transform="translate(95, 750)">
          <g class="ferry-bob">
            <path d="M-58,22 Q0,27 58,22" stroke="#e0f2fe" stroke-width="3" fill="none" opacity="0.82" />
            <polygon points="-42,10 42,10 36,22 -36,22" fill="#1e293b" />
            <rect x="-34" y="-6" width="68" height="16" rx="2" fill="#ea580c" />
            <rect x="-24" y="-15" width="48" height="10" rx="2" fill="#f8fafc" />
            <g fill="#fde047"><rect x="-26" y="-2" width="8" height="6"/><rect x="-10" y="-2" width="8" height="6"/><rect x="6" y="-2" width="8" height="6"/><rect x="20" y="-2" width="8" height="6"/></g>
          </g>
        </g>
        <path d="M-450,900 Q-150,815 55,795 Q520,792 1040,806 T2380,802 L2380,900 Z" fill="#57534e" />
        <use href="#mapleTreeRich" transform="translate(115, 796) scale(0.65)" />
        <use href="#aspenTreeRich" transform="translate(172, 798) scale(0.62)" />
        <g transform="translate(1245, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#1e293b" /><rect x="172" y="0" width="10" height="68" fill="#1e293b" />
          <rect x="-14" y="-42" width="212" height="52" rx="8" fill="#1e3a8a" stroke="#fde68a" stroke-width="2.5" />
          <text x="92" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">New York Harbor, NY</text>
          <text x="92" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">Next Stop: Atlantic Feast!</text>
        </g>
      </g>

      <!-- 6: East Coast — Striped Lighthouse, Crashing Surf & Lantern-Lit Harvest Banquet -->
      <g id="mid-6">
        <g id="atlanticBluffProc"></g>
        <path class="surf-foam" d="M1285,786 Q1335,776 1390,786" stroke="#e0f2fe" stroke-width="4.5" fill="none" stroke-linecap="round" />
        <g transform="translate(1545, 698)">
          <polygon class="beacon-beam" points="0,-142 -390,-230 -390,-78" fill="url(#headlightCone)" />
          <polygon class="beacon-beam" points="0,-142 230,-198 230,-92" fill="url(#headlightCone)" />
          <rect x="-68" y="-26" width="52" height="32" fill="#fafaf9" stroke="#cbd5e1" stroke-width="1" />
          <polygon points="-74,-26 -42,-46 -10,-26" fill="#991b1b" />
          <rect x="-52" y="-16" width="12" height="12" style="fill: var(--win-glow)" />
          <polygon points="-20,6 20,6 13,-126 -13,-126" fill="#fafaf9" stroke="#cbd5e1" stroke-width="1.5" />
          <polygon points="-18,-22 18,-22 16,-52 -16,-52" fill="#dc2626" />
          <polygon points="-15,-78 15,-78 13,-106 -13,-106" fill="#dc2626" />
          <rect x="-17" y="-130" width="34" height="6" rx="2" fill="#1e293b" />
          <rect x="-11" y="-150" width="22" height="20" fill="#fef08a" stroke="#1e293b" stroke-width="2" />
          <path d="M-14,-150 L0,-166 L14,-150 Z" fill="#991b1b" />
        </g>
        <path d="M-450,900 Q-150,812 55,792 Q380,746 720,788 T1520,806 L2380,802 L2380,900 Z" fill="#7c3610" />
        <use href="#mapleTreeRich" transform="translate(-45, 795) scale(0.82)" />
        <use href="#pineTreeRich" transform="translate(445, 792) scale(0.75)" />
        <!-- Grand Lantern-Lit Thanksgiving Banquet Table -->
        <g transform="translate(185, 780)">
          <ellipse cx="0" cy="-18" rx="260" ry="78" fill="url(#warmLantern)" opacity="0.86" />
          <rect x="-205" y="-78" width="6" height="88" rx="2" fill="#3f2211" /><rect x="200" y="-78" width="6" height="88" rx="2" fill="#3f2211" />
          <path d="M-202,-72 Q-100,-48 0,-68 Q100,-48 203,-72" stroke="#451a03" stroke-width="2" fill="none" />
          <g fill="#fde047">
            <circle cx="-150" cy="-59" r="5.5"/><circle cx="-95" cy="-56" r="5.5"/><circle cx="-40" cy="-61" r="5.5"/>
            <circle cx="35" cy="-61" r="5.5"/><circle cx="95" cy="-56" r="5.5"/><circle cx="152" cy="-59" r="5.5"/>
          </g>
          <!-- Pilgrim Man -->
          <g transform="translate(-128, -14)">
            <path d="M-14,8 L14,8 L11,-20 L-11,-20 Z" fill="#1e293b" /><polygon points="-10,-20 10,-20 13,-12 -13,-12" fill="#f8fafc" />
            <circle cx="0" cy="-29" r="9.5" fill="#f3c69f" /><path d="M-4,-26 Q0,-22 4,-26" stroke="#451a03" stroke-width="1.5" fill="none" />
            <ellipse cx="0" cy="-37" rx="15" ry="3.2" fill="#1c1917" /><path d="M-9,-37 L-6,-49 L6,-49 L9,-37 Z" fill="#292524" /><rect x="-8" y="-41" width="16" height="3" fill="#f59e0b" />
            <g transform="translate(18, -20)"><g class="cheer-mug"><rect x="-4" y="-6" width="8" height="10" rx="1.5" fill="#d97706" stroke="#fef3c7" stroke-width="1" /></g></g>
          </g>
          <!-- Pilgrim Woman -->
          <g transform="translate(-72, -14)">
            <path d="M-13,8 L13,8 L10,-18 L-10,-18 Z" fill="#7c2d12" /><polygon points="-9,-18 9,-18 6,-8 -6,-8" fill="#fef3c7" />
            <circle cx="0" cy="-27" r="9" fill="#e8b48a" /><path d="M-10,-26 A10,10 0 0,1 10,-26 L8,-19 L-8,-19 Z" fill="#f8fafc" />
            <path d="M-3,-24 Q0,-21 3,-24" stroke="#451a03" stroke-width="1.4" fill="none" />
          </g>
          <!-- Guest-of-Honor Crowned Turkey -->
          <g transform="translate(-8, -14)">
            <g transform="translate(0, -16)">
              <ellipse cx="-12" cy="-5" rx="5" ry="15" transform="rotate(-36 -12 -5)" fill="#b91c1c" stroke="#fde68a" stroke-width="0.9"/>
              <ellipse cx="-5" cy="-9" rx="5" ry="16" transform="rotate(-14 -5 -9)" fill="#ea580c" stroke="#fde68a" stroke-width="0.9"/>
              <ellipse cx="5" cy="-9" rx="5" ry="16" transform="rotate(14 5 -9)" fill="#d97706" stroke="#fde68a" stroke-width="0.9"/>
              <ellipse cx="12" cy="-5" rx="5" ry="15" transform="rotate(36 12 -5)" fill="#b91c1c" stroke="#fde68a" stroke-width="0.9"/>
            </g>
            <ellipse cx="0" cy="-4" rx="15" ry="13" fill="#6b3a19" />
            <path d="M-7,-8 L7,-8 L5,2 L0,5 L-5,2 Z" fill="#fffbeb" />
            <circle cx="0" cy="-18" r="8.5" fill="#7c431e" />
            <polygon points="-3,-18 3,-18 0,-13" fill="#f59e0b" />
            <g class="blink-eye"><circle cx="-3.2" cy="-20" r="1.7" fill="#1c1917" /><circle cx="3.2" cy="-20" r="1.7" fill="#1c1917" /></g>
            <polygon points="-7,-25 -8,-34 -3,-28 0,-35 3,-28 8,-34 7,-25" fill="#facc15" stroke="#b45309" stroke-width="1" />
          </g>
          <!-- Kid + Fox + Cottontail Bunny -->
          <g transform="translate(52, -14)">
            <path d="M-11,8 L11,8 L9,-15 L-9,-15 Z" fill="#15803d" /><circle cx="0" cy="-23" r="8" fill="#d99b66" />
            <path d="M-8,-25 C-8,-34 8,-34 8,-25 Z" fill="#1c1917" />
            <g transform="translate(-15, -17)"><g class="cheer-mug" style="animation-delay: -1.2s"><rect x="-3.5" y="-5" width="7" height="9" rx="1.5" fill="#d97706" stroke="#fef3c7" stroke-width="1" /></g></g>
          </g>
          <g transform="translate(104, -12)">
            <ellipse cx="0" cy="2" rx="11" ry="9" fill="#ea580c" /><circle cx="0" cy="-9" r="7.5" fill="#f97316" />
            <ellipse cx="0" cy="-6" rx="4.5" ry="3" fill="#fff7ed" />
            <polygon points="-7,-14 -5,-23 -1,-15" fill="#c2410c" /><polygon points="1,-15 5,-23 7,-14" fill="#c2410c" />
          </g>
          <g transform="translate(144, -12)">
            <ellipse cx="0" cy="2" rx="9" ry="8" fill="#d6c3ab" /><circle cx="0" cy="-8" r="6.5" fill="#d6c3ab" />
            <ellipse cx="-3" cy="-19" rx="2.2" ry="7" fill="#cdb79e" /><ellipse cx="3" cy="-19" rx="2.2" ry="7" fill="#cdb79e" />
          </g>
          <!-- Table, Flickering Candles & Harvest Feast Spread -->
          <rect x="-175" y="-6" width="350" height="10" rx="3" fill="#854d0e" stroke="#451a03" stroke-width="1.5" />
          <polygon points="-155,-6 155,-6 148,5 -148,5" fill="#fef3c7" opacity="0.94" />
          <rect x="-155" y="4" width="10" height="18" fill="#451a03" /><rect x="0" y="4" width="10" height="18" fill="#451a03" /><rect x="145" y="4" width="10" height="18" fill="#451a03" />
          <ellipse cx="-105" cy="-9" rx="13" ry="4.5" fill="#d97706" /><ellipse cx="-48" cy="-10" rx="10" ry="7" fill="#ea580c" />
          <ellipse cx="28" cy="-9" rx="14" ry="5" fill="#b45309" /><ellipse cx="82" cy="-9" rx="11" ry="4" fill="#facc15" />
          <rect x="-16" y="-17" width="3.5" height="11" fill="#fffbeb" /><path class="candle-flame" d="M-14.2,-24 C-11.5,-20 -12,-17 -14.2,-17 C-16.4,-17 -16.8,-20 -14.2,-24 Z" fill="#fde047" />
          <rect x="60" y="-17" width="3.5" height="11" fill="#fffbeb" /><path class="candle-flame" style="animation-delay: -0.3s" d="M61.8,-24 C64.5,-20 64,-17 61.8,-17 C59.6,-17 59.2,-20 61.8,-24 Z" fill="#fde047" />
        </g>
        <g transform="translate(1185, 772)">
          <rect x="0" y="0" width="10" height="68" fill="#3f2211" /><rect x="172" y="0" width="10" height="68" fill="#3f2211" />
          <rect x="-14" y="-42" width="212" height="52" rx="8" fill="#7c2d12" stroke="#fde68a" stroke-width="2.5" />
          <text x="92" y="-17" text-anchor="middle" fill="#fffbeb" font-family="'Caveat', cursive" font-size="24" font-weight="700">Atlantic Coast · Feast!</text>
          <text x="92" y="4" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="17" font-weight="600">Happy Thanksgiving!</text>
        </g>
      </g>
    </g>

    <!-- Dusk/Night Atmospheric Dimming -->
    <rect width="1920" height="900" fill="#060918" style="opacity: var(--night-dim); pointer-events: none;" />

    <!-- PLANE 4 (1.00x): Wheel-Locked Embankment & Railway Ties -->
    <g id="embankmentPlane" style="will-change: transform;">
      <use href="#embankmentTile" x="0" /><use href="#embankmentTile" x="640" /><use href="#embankmentTile" x="1280" /><use href="#embankmentTile" x="1920" />
    </g>

    <g transform="translate(0, 962)">
      <rect x="0" y="18" width="1920" height="105" fill="#1b0d06" />
      <g id="tiesLayer" fill="#4a2b16"></g>
      <rect x="0" y="10" width="1920" height="7" fill="#475569" />
      <rect x="0" y="10" width="1920" height="2.5" fill="#e2e8f0" />
    </g>

    <!-- World-Space Volumetric Steam Plume, Glowing Sparks & Autumn Leaves -->
    <g id="worldSteamLayer"></g>
    <g id="worldSparkLayer"></g>
    <g id="worldLeafLayer"></g>

    <!-- ======================================================================= -->
    <!-- THE HEIRLOOM HARVEST EXPRESS TRAIN (Museum-Grade Brass & Wood Consist)  -->
    <!-- ======================================================================= -->
    <g id="trainGroup">
      <!-- Soft rail contact shadows (ground the consist on the track) -->
      <g fill="#000" opacity="0.30">
        <ellipse cx="302" cy="976" rx="112" ry="5.5" /><ellipse cx="578" cy="976" rx="118" ry="5.5" />
        <ellipse cx="949" cy="976" rx="205" ry="5.5" /><ellipse cx="1303" cy="976" rx="104" ry="5.5" />
        <ellipse cx="1597" cy="977" rx="168" ry="6.5" />
      </g>

      <!-- CAR 4: Ornate Clerestory Caboose + Breathing Curled Red Fox -->
      <g id="car-4" transform="translate(185, 840)">
        <path d="M-10,66 L12,66 M-8,66 L-8,104 M2,66 L2,104" stroke="url(#brassGrad)" stroke-width="2.6" stroke-linecap="round" />
        <circle cx="-11" cy="58" r="24" fill="url(#warmLantern)" style="opacity: var(--lantern-op)" />
        <circle cx="-11" cy="58" r="5" fill="#ef4444" stroke="#fde047" stroke-width="1.5" />
        <rect x="222" y="101" width="44" height="8" rx="3" fill="#1e293b" />
        <rect x="10" y="24" width="214" height="86" rx="9" fill="url(#woodCarGrad)" stroke="#451a03" stroke-width="3" />
        <!-- Wood plank bevels & gold pinstripe -->
        <g stroke="#451a03" stroke-width="1.2" opacity="0.35">
          <line x1="88" y1="26" x2="88" y2="108"/><line x1="146" y1="26" x2="146" y2="108"/>
        </g>
        <rect x="17" y="31" width="200" height="72" rx="5" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.82" />
        <!-- Clerestory Cupola -->
        <rect x="68" y="-5" width="98" height="32" rx="6" fill="#92400e" stroke="#451a03" stroke-width="2.5" />
        <rect x="82" y="3" width="28" height="14" rx="3" style="fill: var(--win-glow)" />
        <rect x="124" y="3" width="28" height="14" rx="3" style="fill: var(--win-glow)" />
        <path d="M56,-3 Q117,-22 178,-3 Z" fill="url(#cabRoofGrad)" stroke="#291206" stroke-width="1.5" />
        <path d="M-2,24 Q117,14 236,24 L232,16 L2,16 Z" fill="url(#cabRoofGrad)" />
        <!-- Arched Windows with Crimson Curtains -->
        <rect x="32" y="42" width="42" height="38" rx="8" style="fill: var(--win-glow)" stroke="#451a03" stroke-width="3" />
        <path d="M34,44 Q42,56 34,66 M72,44 Q64,56 72,66" stroke="#b91c1c" stroke-width="3" fill="none" opacity="0.65" />
        <rect x="160" y="42" width="42" height="38" rx="8" style="fill: var(--win-glow)" stroke="#451a03" stroke-width="3" />
        <path d="M162,44 Q170,56 162,66 M200,44 Q192,56 200,66" stroke="#b91c1c" stroke-width="3" fill="none" opacity="0.65" />
        <!-- Expressive Curled Sleeping Fox with Twitching Ear -->
        <g transform="translate(117, 66)">
          <g class="fox-sleep-breathe">
            <path d="M-22,12 C-24,-2 18,-2 22,12 C22,22 -22,22 -22,12 Z" fill="#ea580c" />
            <circle cx="-12" cy="7" r="10.5" fill="#f97316" />
            <polygon points="-20,-1 -17,-12 -10,-1" fill="#c2410c" /><polygon points="-13,-2 -8,-11 -4,-1" fill="#c2410c" />
            <polygon points="-18,-8 -17,-12 -14,-8" fill="#1c1917" />
            <path d="M-16,8 Q-12,11 -8,8" stroke="#1c1917" stroke-width="1.6" fill="none" stroke-linecap="round" />
            <path d="M4,15 C24,20 30,4 16,4 C8,4 6,12 -2,14 Z" fill="#ea580c" />
            <path d="M16,4 C25,4 26,13 17,15 C12,14 12,6 16,4 Z" fill="#fff7ed" />
          </g>
        </g>
        <!-- Undercarriage & Leaf-Spring Bogie -->
        <rect x="36" y="110" width="164" height="7" rx="2.5" fill="#1e293b" />
        <path d="M90,115 Q118,122 146,115" stroke="#475569" stroke-width="3" fill="none" />
        <g transform="translate(56, 119)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(180, 119)"><g class="wheel"><use href="#carWheel16"/></g></g>
      </g>

      <!-- CAR 3: Heirloom Harvest Gondola + Fluid Swishing-Tail Squirrel -->
      <g id="car-3" transform="translate(450, 846)">
        <rect x="244" y="95" width="44" height="8" rx="3" fill="#1e293b" />
        <rect x="22" y="18" width="40" height="30" rx="5" fill="#a16207" stroke="#451a03" stroke-width="2" />
        <line x1="22" y1="27" x2="62" y2="27" stroke="#475569" stroke-width="2.5" />
        <g transform="translate(96, 38)">
          <ellipse cx="-12" cy="0" rx="18" ry="21" fill="#c2410c" /><ellipse cx="12" cy="0" rx="18" ry="21" fill="#c2410c" />
          <ellipse cx="0" cy="0" rx="19" ry="22" fill="#f97316" /><path d="M0,-21 C1,-27 5,-29 8,-27" stroke="#365314" stroke-width="3.5" fill="none" stroke-linecap="round" />
        </g>
        <g transform="translate(160, 40)">
          <ellipse cx="-11" cy="0" rx="16" ry="19" fill="#9a3412" /><ellipse cx="11" cy="0" rx="16" ry="19" fill="#9a3412" />
          <ellipse cx="0" cy="0" rx="17" ry="20" fill="#ea580c" />
        </g>
        <ellipse cx="212" cy="43" rx="22" ry="17" fill="#d97706" />
        <!-- Fluid Articulated Squirrel (plush multi-tone tail + head tilt animated at 60fps!) -->
        <g id="gondolaSquirrel" transform="translate(132, 24)">
          <path id="squirrelTail" d="M-8,6 C-28,0 -32,-24 -14,-28 C-2,-30 -1,-12 -6,2 Z" fill="#b44d14" />
          <path id="squirrelTailHi" d="M-11,2 C-24,-3 -26,-20 -13,-24" stroke="#fdba74" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.65" />
          <ellipse cx="2" cy="2" rx="11.5" ry="9.5" fill="#d96b27" />
          <ellipse cx="5" cy="3" rx="6.5" ry="6" fill="#fed7aa" />
          <g id="squirrelHead">
            <circle cx="10" cy="-9" r="8.5" fill="#d96b27" />
            <ellipse cx="14" cy="-7" rx="4.5" ry="3.5" fill="#fed7aa" />
            <polygon points="5,-16 8,-25 13,-16" fill="#9a3412" />
            <g class="blink-eye"><circle cx="13" cy="-11" r="2" fill="#1c1917" /><circle cx="13.6" cy="-11.6" r="0.7" fill="#fff" /></g>
            <circle cx="20" cy="-2" r="7" fill="#dc2626" />
            <circle cx="18" cy="-4" r="2" fill="#fca5a5" />
            <path d="M20,-9 L22,-13" stroke="#365314" stroke-width="2" stroke-linecap="round" />
          </g>
        </g>
        <rect x="8" y="46" width="240" height="60" rx="7" fill="#78350f" stroke="#3f1d0b" stroke-width="3" />
        <g stroke="#451a03" stroke-width="2" opacity="0.65">
          <line x1="56" y1="48" x2="56" y2="104" /><line x1="104" y1="48" x2="104" y2="104" />
          <line x1="152" y1="48" x2="152" y2="104" /><line x1="200" y1="48" x2="200" y2="104" />
        </g>
        <!-- Swaying Pennant Bunting (fluttered dynamically in JS!) -->
        <g id="gondolaBunting">
          <path d="M14,56 Q70,74 128,56 Q186,74 242,56" stroke="#fde68a" stroke-width="2" fill="none" />
          <polygon points="42,63 48,74 54,63" fill="#dc2626" /><polygon points="96,63 102,74 108,63" fill="#f59e0b" />
          <polygon points="154,63 160,74 166,63" fill="#16a34a" /><polygon points="208,63 214,74 220,63" fill="#dc2626" />
        </g>
        <g transform="translate(56, 113)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(202, 113)"><g class="wheel"><use href="#carWheel16"/></g></g>
      </g>

      <!-- CAR 2: Brass-Truss Photo Scissor-Lift Flatbed -->
      <g id="car-2" transform="translate(738, 868)">
        <rect x="414" y="73" width="46" height="8" rx="3" fill="#1e293b" />
        <polygon id="liftBeam" points="105,64 315,64 445,-195 -25,-195" fill="url(#cradleGlow)" />
        <line id="scissorL" x1="120" y1="60" x2="300" y2="-16" stroke="url(#brassGrad)" stroke-width="7.5" stroke-linecap="round" />
        <line id="scissorR" x1="300" y1="60" x2="120" y2="-16" stroke="url(#brassGrad)" stroke-width="7.5" stroke-linecap="round" />
        <circle id="scissorPin" cx="210" cy="22" r="4.8" fill="#fef08a" stroke="#78350f" stroke-width="1.5" />
        <rect id="liftCradle" x="106" y="-22" width="208" height="9" rx="4.5" fill="url(#brassGrad)" stroke="#451a03" stroke-width="1.5" />
        <rect x="0" y="62" width="422" height="22" rx="6" fill="#5c3820" stroke="#291206" stroke-width="3" />
        <rect x="16" y="56" width="390" height="8" rx="3" fill="url(#brassGrad)" />
        <path d="M35,84 L120,94 L302,94 L387,84" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.75" />
        <g transform="translate(58, 91)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(122, 91)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(300, 91)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(364, 91)"><g class="wheel"><use href="#carWheel16"/></g></g>
      </g>

      <!-- CAR 1: Swept-Side Crimson Tender + Steaming Cocoa & Lattice Pie -->
      <g id="car-1" transform="translate(1196, 848)">
        <rect x="204" y="93" width="42" height="8" rx="3" fill="#1e293b" />
        <rect x="32" y="8" width="56" height="44" rx="7" fill="#fffbeb" stroke="#b45309" stroke-width="3" />
        <path d="M32,20 L88,20" stroke="#b91c1c" stroke-width="3.5" />
        <path d="M88,18 C104,18 104,42 88,42" fill="none" stroke="#fffbeb" stroke-width="6" stroke-linecap="round" />
        <rect x="42" y="2" width="13" height="9" rx="3.5" fill="#fff" /><rect x="62" y="1" width="13" height="9" rx="3.5" fill="#fff" />
        <path class="cocoa-1" d="M50,-5 Q42,-17 52,-29" stroke="#fff7ed" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <path class="cocoa-2" d="M68,-7 Q76,-19 66,-31" stroke="#fff7ed" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <ellipse cx="150" cy="44" rx="38" ry="12" fill="#d97706" stroke="#fde68a" stroke-width="2.5" />
        <ellipse cx="150" cy="41" rx="30" ry="8.5" fill="#b45309" />
        <path d="M132,39 L168,43 M138,35 L162,46" stroke="#fde68a" stroke-width="1.6" />
        <circle cx="150" cy="39" r="6.5" fill="#fffbeb" />
        <path d="M6,44 L145,44 Q165,44 175,54 L208,54 L208,104 L6,104 Z" fill="url(#crimsonCarGrad)" stroke="#450a0a" stroke-width="3" />
        <rect x="14" y="53" width="186" height="43" rx="4" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.85" />
        <text x="107" y="80" text-anchor="middle" fill="#fde68a" font-family="'Caveat', cursive" font-size="22" font-weight="700" letter-spacing="0.5">Harvest Express</text>
        <g transform="translate(50, 111)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(164, 111)"><g class="wheel"><use href="#carWheel16"/></g></g>
      </g>

      <!-- CAR 0: 4-4-0 American Classic Steam Locomotive No. 26 + Full Walschaerts Valve Gear! -->
      <g id="car-0" transform="translate(1432, 798)">
        <polygon points="325,74 740,-18 740,185 325,92" fill="url(#headlightCone)" style="opacity: var(--headlight-op)" />

        <!-- Ornate Engineer Cab + Glowing Firebox -->
        <rect x="6" y="26" width="118" height="116" rx="8" fill="url(#crimsonCarGrad)" stroke="#450a0a" stroke-width="3" />
        <rect x="14" y="34" width="102" height="100" rx="4" fill="none" stroke="url(#brassGrad)" stroke-width="1.6" />
        <path d="M-8,28 Q65,12 134,28 L124,12 Q65,-2 4,12 Z" fill="url(#cabRoofGrad)" stroke="#291206" stroke-width="2" />
        <rect x="38" y="108" width="56" height="19" rx="4" fill="#451a03" stroke="url(#brassGrad)" stroke-width="1.8" />
        <text x="66" y="121" text-anchor="middle" fill="#fde047" font-size="11" font-weight="700" letter-spacing="1">NO. 26</text>

        <!-- Arched Cab Window + Expressive Turkey Engineer ("Capt. Gobbles") -->
        <path d="M26,96 L26,52 Q26,38 42,38 L86,38 Q102,38 102,52 L102,96 Z" fill="#fef3c7" stroke="#451a03" stroke-width="3" />
        <circle cx="38" cy="88" r="18" fill="#ea580c" style="opacity: var(--firebox-op)" />
        <circle cx="36" cy="90" r="9" fill="#fde047" style="opacity: var(--firebox-op)" />

        <g id="engineerTurkey" transform="translate(64, 83)">
          <ellipse cx="-16" cy="-2" rx="5" ry="12" transform="rotate(-28 -16 -2)" fill="#b91c1c" />
          <ellipse cx="-13" cy="-7" rx="5" ry="12" transform="rotate(-12 -13 -7)" fill="#d97706" />
          <ellipse cx="0" cy="5" rx="18" ry="14" fill="#6b3a19" />
          <ellipse cx="4" cy="6" rx="11" ry="9" fill="#854d27" />
          <path id="bandanaTail" d="M-6,-3 L-20,-6 L-16,2 Z" fill="#dc2626" />
          <polygon points="-7,-4 11,-4 3,5" fill="#ef4444" />
          <g id="engineerHead">
            <circle cx="6" cy="-12" r="10.5" fill="#7c431e" />
            <path d="M-5,-19 C-5,-31 16,-31 17,-19 Z" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="1.2" />
            <line x1="1" y1="-29" x2="1" y2="-19" stroke="#bfdbfe" stroke-width="1.5" />
            <line x1="7" y1="-29" x2="7" y2="-19" stroke="#bfdbfe" stroke-width="1.5" />
            <line x1="13" y1="-28" x2="13" y2="-19" stroke="#bfdbfe" stroke-width="1.5" />
            <path d="M9,-20 L23,-18 Q24,-15 16,-16 Z" fill="#1e3a8a" />
            <circle cx="4" cy="-22" r="3.2" fill="#bae6fd" stroke="#fbbf24" stroke-width="1.4" />
            <circle cx="11" cy="-22" r="3.2" fill="#bae6fd" stroke="#fbbf24" stroke-width="1.4" />
            <path d="M15,-14 L25,-10 L15,-7 Z" fill="#f59e0b" stroke="#b45309" stroke-width="0.8" />
            <path id="engineerSnood" d="M14,-10 C18,-5 16,1 12,-1 Z" fill="#dc2626" />
            <g class="blink-eye">
              <circle cx="9.5" cy="-14" r="2.3" fill="#1c1917" />
              <circle cx="10.3" cy="-14.8" r="0.8" fill="#fff" />
            </g>
          </g>
          <path id="engineerWing" d="M-18,0 C-10,-8 2,-4 -2,6 C-6,10 -18,8 -18,0 Z" fill="#92400e" />
        </g>

        <!-- 3D Cylindrical Crimson Boiler + Riveted Cast-Iron Smokebox -->
        <rect x="124" y="54" width="136" height="84" rx="6" fill="url(#boilerGrad)" stroke="#450a0a" stroke-width="3" />
        <rect x="252" y="54" width="54" height="84" rx="10" fill="url(#smokeboxGrad)" stroke="#0f172a" stroke-width="3" />
        <!-- Specular Boiler Sheen & Brass Bands -->
        <line x1="130" y1="68" x2="248" y2="68" stroke="#fecaca" stroke-width="2" opacity="0.32" stroke-linecap="round" />
        <rect x="162" y="54" width="7" height="84" fill="url(#brassGrad)" />
        <rect x="218" y="54" width="7" height="84" fill="url(#brassGrad)" />
        <rect x="250" y="54" width="7" height="84" fill="url(#brassGrad)" />
        <!-- Smokebox Rivets & Brass Handrail -->
        <g fill="#94a3b8" opacity="0.65">
          <circle cx="262" cy="64" r="1.4"/><circle cx="262" cy="82" r="1.4"/><circle cx="262" cy="100" r="1.4"/><circle cx="262" cy="118" r="1.4"/>
        </g>
        <line x1="126" y1="74" x2="294" y2="74" stroke="url(#brassGrad)" stroke-width="2.4" />
        <circle cx="165" cy="74" r="3" fill="#fef08a" /><circle cx="253" cy="74" r="3" fill="#fef08a" />
        <!-- Sand-dome feed pipe -->
        <path d="M191,54 L191,132 L202,138" stroke="#78350f" stroke-width="2.4" fill="none" />

        <!-- Swinging Brass Bell, Brass Whistle & Sculpted Steam/Sand Domes -->
        <g transform="translate(145, 40)">
          <path d="M-7,14 L-5,0 L5,0 L7,14" fill="none" stroke="url(#brassGrad)" stroke-width="2.4" />
          <path class="bell-swing" d="M-6,11 L6,11 L4,2 L-4,2 Z" fill="url(#brassGrad)" />
        </g>
        <rect x="163" y="39" width="4.5" height="15" rx="1.5" fill="url(#brassGrad)" />
        <path d="M174,54 C174,28 208,28 208,54 Z" fill="url(#brassGrad)" stroke="#78350f" stroke-width="1.5" />
        <path d="M226,54 C226,36 248,36 248,54 Z" fill="url(#brassGrad)" stroke="#78350f" stroke-width="1.5" />

        <!-- Balloon-Crown Smokestack -->
        <polygon points="264,54 286,54 296,14 254,14" fill="url(#smokeboxGrad)" stroke="#0f172a" stroke-width="2" />
        <polygon points="250,14 300,14 292,4 258,4" fill="#334155" />
        <rect x="250" y="11" width="50" height="5.5" rx="2.5" fill="url(#brassGrad)" />

        <!-- Brass Headlight Lantern & Slatted Cowcatcher -->
        <rect x="302" y="64" width="22" height="24" rx="4" fill="url(#brassGrad)" stroke="#78350f" stroke-width="1.5" />
        <circle cx="322" cy="76" r="8" fill="#fef9c3" />
        <polygon points="302,144 348,144 302,102" fill="#451a03" stroke="url(#brassGrad)" stroke-width="1.8" />
        <line x1="312" y1="144" x2="302" y2="114" stroke="#fbbf24" stroke-width="1.6" />
        <line x1="324" y1="144" x2="302" y2="124" stroke="#fbbf24" stroke-width="1.6" />
        <line x1="336" y1="144" x2="302" y2="134" stroke="#fbbf24" stroke-width="1.6" />

        <!-- Heavy Steel Chassis & Crosshead Slide Bars -->
        <rect x="0" y="136" width="312" height="14" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
        <line x1="138" y1="144" x2="205" y2="144" stroke="#94a3b8" stroke-width="2.2" />
        <line x1="138" y1="156" x2="205" y2="156" stroke="#94a3b8" stroke-width="2.2" />

        <!-- Two Counterweighted Spoked Drive Wheels (R=25) -->
        <g transform="translate(54, 154)">
          <g class="drive-wheel">
            <circle r="25" fill="#7f1d1d" stroke="url(#brassGrad)" stroke-width="4" />
            <circle r="20" fill="#1e293b" />
            <path d="M-16,-10 A18,18 0 0,1 -16,10 Z" fill="#991b1b" />
            <g class="dw-spokes" stroke="#cbd5e1" stroke-width="2">
              <line x1="-20" y1="0" x2="20" y2="0"/><line x1="0" y1="-20" x2="0" y2="20"/>
              <line x1="-14" y1="-14" x2="14" y2="14"/><line x1="14" y1="-14" x2="-14" y2="14"/>
            </g>
            <circle class="dw-blur" r="19" fill="#94a3b8" opacity="0" />
            <circle r="6.5" fill="url(#brassGrad)" />
          </g>
        </g>
        <g transform="translate(126, 154)">
          <g class="drive-wheel">
            <circle r="25" fill="#7f1d1d" stroke="url(#brassGrad)" stroke-width="4" />
            <circle r="20" fill="#1e293b" />
            <path d="M-16,-10 A18,18 0 0,1 -16,10 Z" fill="#991b1b" />
            <g class="dw-spokes" stroke="#cbd5e1" stroke-width="2">
              <line x1="-20" y1="0" x2="20" y2="0"/><line x1="0" y1="-20" x2="0" y2="20"/>
              <line x1="-14" y1="-14" x2="14" y2="14"/><line x1="14" y1="-14" x2="-14" y2="14"/>
            </g>
            <circle class="dw-blur" r="19" fill="#94a3b8" opacity="0" />
            <circle r="6.5" fill="url(#brassGrad)" />
          </g>
        </g>

        <!-- Pilot Truck Wheels (R=16) -->
        <g transform="translate(236, 160)"><g class="wheel"><use href="#carWheel16"/></g></g>
        <g transform="translate(284, 160)"><g class="wheel"><use href="#carWheel16"/></g></g>

        <!-- Brass-Trimmed Steam Cylinder & Steam Chest -->
        <rect x="184" y="139" width="40" height="22" rx="4" fill="url(#smokeboxGrad)" stroke="url(#brassGrad)" stroke-width="2" />
        <rect x="190" y="134" width="28" height="7" rx="2" fill="#334155" stroke="url(#brassGrad)" stroke-width="1.2" />

        <!-- ANIMATED PISTON CROSSHEAD + MAIN ROD + VALVE ECCENTRIC + SIDE ROD! -->
        <line id="valveRod" x1="154" y1="138" x2="192" y2="138" stroke="#cbd5e1" stroke-width="2.4" />
        <line id="pistonRod" x1="162" y1="150" x2="190" y2="150" stroke="#f8fafc" stroke-width="4" />
        <rect id="crosshead" x="156" y="145" width="12" height="10" rx="2" fill="url(#steelRodGrad)" stroke="#334155" stroke-width="1.5" />
        <line id="mainRod" x1="126" y1="154" x2="162" y2="150" stroke="url(#steelRodGrad)" stroke-width="5.5" stroke-linecap="round" />
        <g id="sideRod">
          <rect x="50" y="151" width="80" height="6" rx="3" fill="url(#steelRodGrad)" stroke="#475569" stroke-width="1.3" />
          <circle cx="54" cy="154" r="3.6" fill="#fbbf24" />
          <circle cx="126" cy="154" r="3.6" fill="#fbbf24" />
        </g>
      </g>
    </g>

    <!-- PLANE 5 (1.65x): Foreground Split-Rail Fences, Brush & Mileposts -->
    <g id="foregroundPlane" style="will-change: transform;">
      <use href="#foregroundPassTile" x="0" /><use href="#foregroundPassTile" x="960" /><use href="#foregroundPassTile" x="1920" />
    </g>
  </svg>`
