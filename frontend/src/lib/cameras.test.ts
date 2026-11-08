import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SCRYPTED_NVR_URL } from './cameras.ts'

describe('Cameras Section & Scrypted NVR Configuration', () => {
  it('has valid Scrypted public NVR stream URL', () => {
    assert.strictEqual(
      SCRYPTED_NVR_URL,
      'https://frisco.dkiran.com/api/scrypted/900d8642daf8d72436dd06b99ff2ff6f/endpoint/@scrypted/nvr/public/#/'
    )
    assert.match(SCRYPTED_NVR_URL, /^https:\/\/frisco\.dkiran\.com\/api\/scrypted\//)
    assert.match(SCRYPTED_NVR_URL, /\/@scrypted\/nvr\/public\/#\/$/)
  })

  it('verifies secure URL structure and public endpoint token format', () => {
    const url = new URL(SCRYPTED_NVR_URL)
    assert.strictEqual(url.protocol, 'https:')
    assert.strictEqual(url.hostname, 'frisco.dkiran.com')
    assert.strictEqual(url.hash, '#/')
    assert.ok(url.pathname.includes('900d8642daf8d72436dd06b99ff2ff6f'))
  })
})
