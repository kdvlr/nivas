import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SCRYPTED_NVR_URL } from './cameras.ts'

describe('Cameras Section & Scrypted NVR Configuration', () => {
  it('has valid Scrypted same-origin NVR stream URL', () => {
    assert.strictEqual(
      SCRYPTED_NVR_URL,
      '/api/scrypted/900d8642daf8d72436dd06b99ff2ff6f/endpoint/@scrypted/nvr/public/#/'
    )
    assert.match(SCRYPTED_NVR_URL, /^\/api\/scrypted\//)
    assert.match(SCRYPTED_NVR_URL, /\/@scrypted\/nvr\/public\/#\/$/)
    assert.ok(SCRYPTED_NVR_URL.includes('900d8642daf8d72436dd06b99ff2ff6f'))
  })
})
