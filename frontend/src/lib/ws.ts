type Listener = (scope: string) => void

const listeners = new Set<Listener>()
let socket: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null

function connect() {
  if (socket) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '') // remove trailing slash
  socket = new WebSocket(`${proto}://${location.host}${baseUrl}/ws`)
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'refresh') listeners.forEach((fn) => fn(msg.scope))
    } catch {
      /* ignore */
    }
  }
  socket.onclose = () => {
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
