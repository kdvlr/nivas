/**
 * Display picture for a family member. Precedence:
 *   1. a chosen emoji ("display picture") on their color disc
 *   2. a Google profile photo
 *   3. a colored disc with their initial
 */
export default function Avatar({
  name,
  color,
  src,
  emoji,
  size = 48,
}: {
  name: string
  color: string
  src?: string
  emoji?: string
  size?: number
}) {
  if (emoji) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full shadow-sm"
        style={{ width: size, height: size, background: color, fontSize: size * 0.58 }}
      >
        {emoji}
      </span>
    )
  }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover shadow-sm"
        style={{ width: size, height: size, border: `2.5px solid ${color}` }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
