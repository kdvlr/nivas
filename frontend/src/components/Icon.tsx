/** Material Symbols Rounded icon (self-hosted variable font). */
export default function Icon({
  name,
  filled = false,
  className = '',
  style,
}: {
  name: string
  filled?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={`msr shrink-0 ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'opsz' 40, 'wght' 500", ...style } : style}
    >
      {name}
    </span>
  )
}
