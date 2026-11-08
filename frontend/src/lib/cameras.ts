/**
 * Scrypted NVR Camera Stream Configuration
 *
 * Uses same-origin relative URL so that the stream seamlessly proxies through
 * Nivas's own reverse-proxy edge without cross-origin iframe security blocks
 * or third-party cookie restrictions in kiosk webviews (Fully Kiosk Browser).
 */
export const SCRYPTED_NVR_URL =
  '/api/scrypted/900d8642daf8d72436dd06b99ff2ff6f/endpoint/@scrypted/nvr/public/#/'
