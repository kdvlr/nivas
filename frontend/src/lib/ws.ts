type Listener = (scope: string) => void
type MessageListener = (message: any) => void
type OpenListener = () => void

const listeners = new Set<Listener>()
const messageListeners = new Set<MessageListener>()
const openListeners = new Set<OpenListener>()
let socket: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pongTimeout: ReturnType<typeof setTimeout> | null = null
let lastActivityAt = 0

function scheduleReconnect(delayMs = 3000) {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delayMs)
}

function forceReconnect() {
  if (pongTimeout) {
    clearTimeout(pongTimeout)
    pongTimeout = null
  }
  const prev = socket
  socket = null
  if (prev) {
    prev.onclose = null
    prev.onerror = null
    prev.onmessage = null
    prev.onopen = null
    try {
      prev.close()
    } catch {
      /* ignore */
    }
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  connect()
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws`)
  socket = ws
  ws.onopen = () => {
    lastActivityAt = Date.now()
    openListeners.forEach((fn) => fn())
  }
  ws.onmessage = (ev) => {
    lastActivityAt = Date.now()
    if (pongTimeout) {
      clearTimeout(pongTimeout)
      pongTimeout = null
    }
    try {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'pong') return
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
  ws.onerror = () => {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
  ws.onclose = () => {
    if (socket === ws) {
      socket = null
      scheduleReconnect(3000)
    }
  }
  if (pingTimer) clearInterval(pingTimer)
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send('ping')
      } catch {
        forceReconnect()
      }
    }
  }, 30000)
}

/**
 * Verify the WebSocket is alive (especially after iOS PWA suspension).
 * Sends a ping and forces a fresh reconnect if no message/pong arrives within 2.5s.
 */
export function ensureWsConnected() {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    forceReconnect()
    return
  }
  if (socket.readyState === WebSocket.OPEN) {
    const before = lastActivityAt
    try {
      socket.send('ping')
    } catch {
      forceReconnect()
      return
    }
    if (pongTimeout) clearTimeout(pongTimeout)
    pongTimeout = setTimeout(() => {
      pongTimeout = null
      if (lastActivityAt === before) {
        forceReconnect()
      }
    }, 2500)
  }
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

export function onWsOpen(fn: OpenListener): () => void {
  openListeners.add(fn)
  return () => openListeners.delete(fn)
}
