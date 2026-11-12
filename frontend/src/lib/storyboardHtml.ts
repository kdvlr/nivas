/**
 * Pure HTML template patcher for zero-network `srcdoc` celebration storyboards.
 * Injects `<base href="/celebrations/">` and `window.__NIVAS_SEARCH__` so query
 * parameters (`?embed=1&sound=0&points=10`) work identically inside `srcdoc`.
 */
export function buildInjectedSrcDoc(rawHtml: string, search: string): string {
  const bootstrap = `<base href="/celebrations/"><script>window.__NIVAS_SEARCH__=${JSON.stringify(search)};</script>`
  const patchedSearchHtml = rawHtml
    .replace(/window\.location\.search/g, '(window.__NIVAS_SEARCH__ ?? window.location.search)')
    .replace(/(?<!\.)location\.search/g, '(window.__NIVAS_SEARCH__ ?? location.search)')

  if (/<head[^>]*>/i.test(patchedSearchHtml)) {
    return patchedSearchHtml.replace(/<head[^>]*>/i, (match) => `${match}${bootstrap}`)
  }
  return `${bootstrap}${patchedSearchHtml}`
}
