/**
 * Read a query param from anywhere in the URL.
 *
 * The app is hash-routed, so overrides normally arrive inside the fragment
 * ("#/photos?sky=night&fx=high") where `location.search` is empty. Check the
 * real query string first, then fall back to whatever follows the first "?".
 */
export const getQueryParam = (key: string): string | null => {
  const searchQP = new URLSearchParams(window.location.search)
  if (searchQP.has(key)) return searchQP.get(key)
  const qIdx = window.location.href.indexOf('?')
  if (qIdx !== -1) {
    const qp = new URLSearchParams(window.location.href.substring(qIdx))
    if (qp.has(key)) return qp.get(key)
  }
  return null
}
