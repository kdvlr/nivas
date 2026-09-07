type Listener = (scope: string) => void
type MessageListener = (message: any) => void

const listeners = new Set<Listener>()
const connectionListeners = new Set<(connected: boolean) => void>()
const messageListeners = new Set<MessageListener>()
let socket: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null

function connect() {
  if (socket) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  socket = new WebSocket(`${proto}://${location.host}/ws`)
  socket.onopen = () => connectionListeners.forEach((fn) => fn(true))
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      messageListeners.forEach((fn) => fn(msg))
      if (msg.type === 'refresh') listeners.forEach((fn) => fn(msg.scope))
      if (msg.type === 'theme_changed') {
        if (msg.appearance) {
          localStorage.setItem('appearance', msg.appearance)
        }
        if (msg.reload) {
          window.location.reload()
        } else if (msg.appearance) {
          window.dispatchEvent(new CustomEvent('appearance-changed', { detail: msg.appearance }))
        }
      }
    } catch {
      /* ignore */
    }
  }
  socket.onclose = () => {
    connectionListeners.forEach((fn) => fn(false))
    socket = null
    setTimeout(connect, 3000)
  }
  if (pingTimer) clearInterval(pingTimer)
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
  }, 30000)
}

export function startWs() {
  if (!socket) connect()
}

/** Subscribe to server refresh hints. Returns unsubscribe. */
export function onRefresh(scope: string | string[], fn: () => void): () => void {
  const scopes = Array.isArray(scope) ? scope : [scope]
  const listener: Listener = (s) => {
    if (scopes.includes(s)) fn()
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function onWsMessage(fn: MessageListener): () => void {
  messageListeners.add(fn)
  return () => messageListeners.delete(fn)
}

export function onWsConnection(fn: (connected: boolean) => void): () => void {
  connectionListeners.add(fn)
  fn(socket?.readyState === WebSocket.OPEN)
  return () => connectionListeners.delete(fn)
}
