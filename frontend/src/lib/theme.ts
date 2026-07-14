export type Appearance = 'auto' | 'light' | 'dark'
export type ThemeStyle = 'material' | 'glass' | 'woodland'
export type FontChoice = 'outfit' | 'roboto' | 'arial' | 'nunito' | 'quicksand'

export const FONTS: { id: FontChoice; label: string; stack: string }[] = [
  { id: 'outfit', label: 'Outfit', stack: "'Outfit', sans-serif" },
  { id: 'roboto', label: 'Roboto', stack: "'Roboto', sans-serif" },
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'nunito', label: 'Nunito', stack: "'Nunito', sans-serif" },
  { id: 'quicksand', label: 'Quicksand', stack: "'Quicksand', sans-serif" },
]

export const getFont = (): FontChoice => {
  const v = localStorage.getItem('fontFamily')
  if (v === 'google-sans') return 'outfit' // legacy value from before publishing prep
  return FONTS.some((f) => f.id === v) ? (v as FontChoice) : 'outfit'
}

export function setFont(f: FontChoice) {
  localStorage.setItem('fontFamily', f)
  document.documentElement.dataset.font = f
}

export const getAppearance = (): Appearance => {
  const v = localStorage.getItem('appearance') ?? localStorage.getItem('theme') // legacy key
  return v === 'light' || v === 'dark' ? v : 'auto'
}

export const getStyle = (): ThemeStyle => {
  const s = localStorage.getItem('themeStyle')
  return s === 'glass' || s === 'woodland' ? s : 'material'
}

export function applyTheme(appearance: Appearance = getAppearance(), style: ThemeStyle = getStyle()) {
  const dark =
    appearance === 'dark' ||
    (appearance === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = style
  document.documentElement.dataset.font = getFont()

  const accent = localStorage.getItem('accentColor')
  if (accent) {
    document.documentElement.style.setProperty('--primary', accent)
  } else {
    document.documentElement.style.removeProperty('--primary')
  }
}

export function setAppearance(a: Appearance) {
  localStorage.setItem('appearance', a)
  localStorage.removeItem('theme')
  applyTheme(a, getStyle())
}

export function setStyle(s: ThemeStyle) {
  localStorage.setItem('themeStyle', s)
  applyTheme(getAppearance(), s)
}

export function setAccentColor(color: string | null) {
  if (color) {
    localStorage.setItem('accentColor', color)
  } else {
    localStorage.removeItem('accentColor')
  }
  applyTheme(getAppearance(), getStyle())
}

/** Re-apply when the OS switches light/dark while in auto mode. Returns unsubscribe. */
export function watchSystemTheme(): () => void {
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const fn = () => {
    if (getAppearance() === 'auto') applyTheme()
  }
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}
