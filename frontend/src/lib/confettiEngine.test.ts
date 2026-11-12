import test from 'node:test'
import assert from 'node:assert/strict'
import { getOptimalDpr, scaleTabletParticleCount } from './confettiEngine.ts'
import { buildInjectedSrcDoc } from './storyboardHtml.ts'

test('scaleTabletParticleCount scales down particle budgets for Apolosign Mali-G52 tablet while keeping a minimum floor', () => {
  assert.equal(scaleTabletParticleCount(100, true), 44)
  assert.equal(scaleTabletParticleCount(100, false), 85)
  assert.equal(scaleTabletParticleCount(5, true), 8)
})

test('getOptimalDpr returns 1 in SSR/Node environments', () => {
  assert.equal(getOptimalDpr(), 1)
})

test('buildInjectedSrcDoc injects base href, __NIVAS_SEARCH__, and rewrites location.search lookups safely', () => {
  const sampleHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body><script>
    const a = new URLSearchParams(location.search);
    const b = new URLSearchParams(window.location.search);
  </script></body></html>`
  const out = buildInjectedSrcDoc(sampleHtml, '?embed=1&points=15&sound=0')

  assert.ok(out.includes('<head><base href="/celebrations/"><script>window.__NIVAS_SEARCH__="?embed=1&points=15&sound=0";</script>'))
  assert.ok(out.includes('new URLSearchParams((window.__NIVAS_SEARCH__ ?? location.search))'))
  assert.ok(out.includes('new URLSearchParams((window.__NIVAS_SEARCH__ ?? window.location.search))'))
  assert.ok(!out.includes('window.(window.__NIVAS_SEARCH__'))
})
