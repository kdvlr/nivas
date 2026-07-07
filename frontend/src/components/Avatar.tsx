/** Google profile photo when available, otherwise a colored initial disc. */
export default function Avatar({
  name,
  color,
  src,
  size = 48,
}: {
  name: string
  color: string
  src?: string
  size?: number
}) {
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
