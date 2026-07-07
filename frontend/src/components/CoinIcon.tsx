/** The family "coin" — money bag, readable at any size on any theme. */
export default function CoinIcon({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block leading-none ${className}`}>
      💰
    </span>
  )
}
