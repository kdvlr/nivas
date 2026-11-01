import type { SkyPhase } from './sky/skyEngine'

// Small SVG groups share the existing horizon. No new canvas, blur, or timers.
export function DiwaliSceneDetails({ phase }: { phase: SkyPhase }) {
  const evening = phase === 'dusk' || phase === 'night'
  return (
    <g aria-hidden="true">
      {/* Still water and broken reflections below the steps. */}
      <path d="M0 169Q450 164 960 171T1920 169V188H0Z" fill={evening ? '#172e40' : '#537c83'} opacity="0.85" />
      {[96, 210, 400, 620, 1300, 1520, 1710, 1824].map((x, i) => (
        <g key={x} opacity={evening ? 0.65 : 0.22} stroke="#fbbf24" strokeLinecap="round">
          <path d={`M${x - 5} 173h10m-13 4h16m-12 4h8`} strokeWidth="1.4" />
          <ellipse cx={x} cy="167" rx="5" ry="2" fill="#9a3412" stroke="none" />
          <path d={`M${x} 165q-3-5 0-8q3 3 0 8`} fill={i % 2 ? '#fef08a' : '#fbbf24'} stroke="none" />
        </g>
      ))}
      {/* Marigold garlands stay at the outer corners, clear of the photos. */}
      {[0, 1].map(side => (
        <g key={side} transform={side ? 'translate(1920 0) scale(-1 1)' : undefined}>
          <path d="M0 28Q80 68 160 28" fill="none" stroke="#65752b" strokeWidth="2" />
          {Array.from({ length: 13 }, (_, i) => (
            <circle key={i} cx={i * 13} cy={28 + Math.sin(i / 12 * Math.PI) * 20}
              r="4" fill={i % 2 ? '#f59e0b' : '#ea580c'} />
          ))}
        </g>
      ))}
    </g>
  )
}

export function FallSceneDetails({ phase, thanksgiving }: { phase: SkyPhase; thanksgiving: boolean }) {
  const evening = phase === 'dusk' || phase === 'night'
  return (
    <g aria-hidden="true">
      <style>{`
        @keyframes fallChimneySmoke {
          0%, 70%, 100% { opacity: 0; transform: translateY(0); }
          76% { opacity: .25; }
          94% { opacity: 0; transform: translateY(-12px); }
        }
        @keyframes fallOwlGlance {
          0%, 85%, 100% { transform: rotate(0deg); }
          88%, 94% { transform: rotate(12deg); }
        }
      `}</style>
      {/* A small farmhouse at the edge; its window warms at dusk. */}
      <g transform="translate(1650 83)">
        <path d="M0 23L28 4L56 23V60H0Z" fill={evening ? '#382b28' : '#9b694c'} />
        <path d="M-5 24L28 0L61 24" fill="none" stroke="#382b28" strokeWidth="5" />
        <path d="M43 12V0H50V18" fill="#61483c" />
        <rect x="10" y="29" width="13" height="15" fill={evening ? '#fcd88d' : '#a1b4b3'} />
        <path d="M16.5 29V44M10 36H23" stroke="#61483c" />
        <rect x="34" y="32" width="13" height="28" fill="#49382d" />
        {evening && thanksgiving && <path d="M46-2C33-11 55-14 44-24" fill="none" stroke="#d4ccc1" strokeWidth="4"
          style={{ animation: 'fallChimneySmoke 36s ease-out infinite' }} />}
      </g>
      {/* Fence and scarf frame the lower left instead of the photo center. */}
      <g stroke={evening ? '#584334' : '#a98159'} strokeWidth="4" fill="none">
        <path d="M12 134L230 141M12 150L230 157M32 119V170M112 124V173M202 128V175" />
      </g>
      <path d="M108 125Q120 122 127 129L122 151L114 148L116 133L108 132Z" fill={thanksgiving ? '#eee0c8' : '#9f3b32'} />
      {/* Shared harvest basket is also the turkey's stopping place. */}
      <g transform="translate(346 158)">
        <path d="M-23-4Q0-34 23-4" fill="none" stroke="#925c32" strokeWidth="3" />
        <ellipse cx="-12" cy="-5" rx="8" ry="7" fill="#9f342d" />
        <ellipse cx="1" cy="-7" rx="9" ry="8" fill={thanksgiving ? '#d98b35' : '#b9472e'} />
        <ellipse cx="14" cy="-5" rx="7" ry="6" fill="#ca8a04" />
        <path d="M-26-2H26L21 16H-21Z" fill="#925c32" stroke="#573a27" />
        <path d="M-22 4H22M-21 11H21M-10-1V16M0-1V16M10-1V16" stroke="#c39151" fill="none" />
        {thanksgiving && <g fill="#d6b67b" stroke="#b18a4a">
          <path d="M23 6L33-31M27 8L41-25" fill="none" />
          {[0, 1, 2].map(i => <g key={i}><ellipse cx={31 - i * 2} cy={-26 + i * 7} rx="3" ry="5" /><ellipse cx={38 - i * 2} cy={-20 + i * 7} rx="3" ry="5" /></g>)}
        </g>}
      </g>
      {thanksgiving ? (
        <g transform="translate(145 101)">
          <path d="M0 0V30" stroke="#6e5139" strokeWidth="3" />
          <rect x="-26" y="-9" width="52" height="21" rx="2" fill="#74442f" />
          <text textAnchor="middle" y="5" fill="#eee0c8" fontSize="11" fontFamily="serif">Gather</text>
        </g>
      ) : evening && (
        <g transform="translate(1840 108)">
          <path d="M-40 18H45M12 18L35 4" stroke="#61483c" strokeWidth="4" fill="none" />
          <ellipse cy="6" rx="10" ry="14" fill="#776052" />
          <g style={{ transformOrigin: '0px 0px', animation: 'fallOwlGlance 48s ease-in-out infinite' }}>
            <path d="M-10 0L-11-12L-3-7Q0-8 3-7L11-12L10 0Z" fill="#776052" />
            <ellipse cx="-4" cy="-2" rx="4" ry="5" fill="#d8c6a5" /><ellipse cx="4" cy="-2" rx="4" ry="5" fill="#d8c6a5" />
            <circle cx="-4" cy="-2" r="1.8" fill="#241c17" /><circle cx="4" cy="-2" r="1.8" fill="#241c17" />
            <path d="M-2 3H2L0 6Z" fill="#c39151" />
          </g>
        </g>
      )}
    </g>
  )
}
