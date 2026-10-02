import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../Icon'
import { api } from '../../lib/api'
import VolumeCapsuleScrubber from './VolumeCapsuleScrubber'

export interface AirPlayDevice {
  id: string
  name: string
  address: string
  port: number
  model: string
  isSelected: boolean
  volume: number
  syncOffsetMs: number
  isConnected: boolean
  isHidden: boolean
}

interface AirPlaySelectorModalProps {
  isOpen: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
  anchorEl?: HTMLElement | null
}

interface PanelPosition {
  top?: number
  bottom?: number
  left?: number
  right?: number
  maxHeight?: number
  isMobile: boolean
  origin: string
}

export function computeMasterVolume(devList: AirPlayDevice[]): number {
  const selected = devList.filter((d) => d.isSelected && !d.isHidden)
  if (selected.length === 0) return 0
  return Math.round(selected.reduce((sum, d) => sum + d.volume, 0) / selected.length)
}

export default function AirPlaySelectorModal({ isOpen, onClose, anchorRef, anchorEl }: AirPlaySelectorModalProps) {
  const [devices, setDevices] = useState<AirPlayDevice[]>([])
  const [masterVolume, setMasterVolume] = useState(0)
  const devicesRef = useRef<AirPlayDevice[]>(devices)
  devicesRef.current = devices

  const [loading, setLoading] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [calibratingDeviceId, setCalibratingDeviceId] = useState<string | null>(null)
  const [position, setPosition] = useState<PanelPosition>({ top: 84, right: 20, maxHeight: 520, isMobile: false, origin: 'top right' })

  const isInteractingRef = useRef(false)
  const lastInteractionTimeRef = useRef(0)

  // Network queue for device volume
  const deviceInFlightRef = useRef<Map<string, boolean>>(new Map())
  const pendingDeviceVolRef = useRef<Map<string, number>>(new Map())
  const deviceThrottleTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Network queue for group/master volume
  const masterInFlightRef = useRef(false)
  const pendingMasterVolRef = useRef<number | null>(null)
  const masterThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (masterThrottleTimerRef.current) clearTimeout(masterThrottleTimerRef.current)
      deviceThrottleTimerRef.current.forEach((timer) => clearTimeout(timer))
      deviceThrottleTimerRef.current.clear()
    }
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await api.get<any>('/api/ytmusic/player/state')
      const isInteracting = isInteractingRef.current || (Date.now() - lastInteractionTimeRef.current < 1500)
      if (Array.isArray(response?.devices)) {
        if (isInteracting) {
          // Preserve local optimistic volumes, update other metadata
          setDevices((previous) => {
            const prevMap = new Map(previous.map((d) => [d.id, d]))
            const updated = response.devices.map((remote: AirPlayDevice) => {
              const local = prevMap.get(remote.id)
              return local ? { ...remote, volume: local.volume } : remote
            })
            devicesRef.current = updated
            return updated
          })
        } else {
          devicesRef.current = response.devices
          setDevices(response.devices)
          setMasterVolume(
            typeof response?.masterVolume === 'number'
              ? response.masterVolume
              : computeMasterVolume(response.devices)
          )
        }
      } else if (typeof response?.masterVolume === 'number' && !isInteracting) {
        setMasterVolume(response.masterVolume)
      }
    } catch (error) {
      console.error('Failed to fetch AirPlay devices', error)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchDevices().finally(() => setLoading(false))
    const interval = window.setInterval(fetchDevices, 4000)
    return () => window.clearInterval(interval)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) return
    const placePanel = () => {
      const isMobile = window.innerWidth < 640
      const targetAnchor = anchorEl || anchorRef?.current
      const rectangle = targetAnchor?.getBoundingClientRect()
      const margin = 12
      const gap = 8
      const maxPanelHeight = 520

      if (isMobile) {
        if (rectangle && (rectangle.width > 0 || rectangle.height > 0)) {
          const spaceBelow = window.innerHeight - rectangle.bottom - gap - margin
          const spaceAbove = rectangle.top - gap - margin
          if (spaceAbove >= spaceBelow) {
            const bottom = Math.max(margin, window.innerHeight - rectangle.top + gap)
            const maxHeight = Math.min(maxPanelHeight, Math.max(160, rectangle.top - gap - margin))
            setPosition({
              bottom,
              maxHeight,
              isMobile: true,
              origin: 'bottom center',
            })
          } else {
            const top = Math.max(margin, rectangle.bottom + gap)
            const maxHeight = Math.min(maxPanelHeight, Math.max(160, window.innerHeight - top - margin))
            setPosition({
              top,
              maxHeight,
              isMobile: true,
              origin: 'top center',
            })
          }
        } else {
          const bottom = 84
          const maxHeight = Math.min(maxPanelHeight, Math.max(160, window.innerHeight - bottom - margin))
          setPosition({
            bottom,
            maxHeight,
            isMobile: true,
            origin: 'bottom center',
          })
        }
        return
      }

      // Desktop / Tablet
      if (!rectangle || (rectangle.width === 0 && rectangle.height === 0)) {
        const top = 72
        const right = 20
        const maxHeight = Math.min(maxPanelHeight, Math.max(160, window.innerHeight - top - margin))
        setPosition({ top, right, maxHeight, isMobile: false, origin: 'top right' })
        return
      }

      const panelWidth = 368
      const anchorCenterX = (rectangle.left + rectangle.right) / 2
      const isAnchorOnLeft = anchorCenterX < window.innerWidth / 2

      let left: number | undefined
      let right: number | undefined
      if (isAnchorOnLeft) {
        left = Math.max(margin, Math.min(window.innerWidth - panelWidth - margin, rectangle.left))
      } else {
        const calculatedRight = window.innerWidth - rectangle.right
        const maxRight = window.innerWidth - panelWidth - margin
        right = Math.max(margin, Math.min(maxRight, calculatedRight))
      }

      const spaceBelow = window.innerHeight - rectangle.bottom - gap - margin
      const spaceAbove = rectangle.top - gap - margin

      const numItems = showHidden ? hiddenDevices.length : displayedDevices.length
      const estimatedHeight = Math.min(
        maxPanelHeight,
        80 + Math.max(numItems, 1) * 52 + (hiddenDevices.length > 0 || showHidden ? 44 : 0)
      )

      let placeBelow = true
      if (spaceBelow >= estimatedHeight) {
        placeBelow = true
      } else if (spaceAbove >= estimatedHeight) {
        placeBelow = false
      } else {
        placeBelow = spaceBelow >= spaceAbove
      }

      if (placeBelow) {
        const top = Math.max(margin, rectangle.bottom + gap)
        const maxHeight = Math.min(maxPanelHeight, Math.max(160, window.innerHeight - top - margin))
        setPosition({
          top,
          left,
          right,
          maxHeight,
          isMobile: false,
          origin: isAnchorOnLeft ? 'top left' : 'top right',
        })
      } else {
        const bottom = Math.max(margin, window.innerHeight - rectangle.top + gap)
        const maxHeight = Math.min(maxPanelHeight, Math.max(160, rectangle.top - gap - margin))
        setPosition({
          bottom,
          left,
          right,
          maxHeight,
          isMobile: false,
          origin: isAnchorOnLeft ? 'bottom left' : 'bottom right',
        })
      }
    }
    placePanel()
    window.addEventListener('resize', placePanel)
    return () => window.removeEventListener('resize', placePanel)
  }, [isOpen, anchorRef, anchorEl, devices.length, showHidden])

  const toggleDevice = async (device: AirPlayDevice) => {
    const selected = !device.isSelected
    const currentDevices = devicesRef.current
    const nextDevices = currentDevices.map((item) =>
      item.id === device.id ? { ...item, isSelected: selected } : item
    )
    devicesRef.current = nextDevices
    setDevices(nextDevices)
    setMasterVolume(computeMasterVolume(nextDevices))

    try {
      const response = await api.post<any>('/api/ytmusic/airplay/devices/toggle', { deviceId: device.id, selected })
      if (Array.isArray(response?.devices)) {
        if (!isInteractingRef.current) {
          devicesRef.current = response.devices
          setDevices(response.devices)
          setMasterVolume(
            typeof response?.masterVolume === 'number'
              ? response.masterVolume
              : computeMasterVolume(response.devices)
          )
        }
      }
    } catch (error) {
      console.error('Failed to toggle AirPlay device', error)
      fetchDevices()
    }
  }

  const sendDeviceVolumeRequest = async (deviceId: string, volume: number) => {
    deviceInFlightRef.current.set(deviceId, true)
    try {
      await api.post<any>('/api/ytmusic/airplay/volume/device', { deviceId, volume })
    } catch (error) {
      console.error('Failed to update AirPlay volume', error)
    } finally {
      deviceInFlightRef.current.set(deviceId, false)
      if (pendingDeviceVolRef.current.has(deviceId)) {
        const nextVol = pendingDeviceVolRef.current.get(deviceId)!
        pendingDeviceVolRef.current.delete(deviceId)
        sendDeviceVolumeRequest(deviceId, nextVol)
      }
    }
  }

  const handleDeviceVolumeChange = (deviceId: string, volume: number) => {
    isInteractingRef.current = true
    lastInteractionTimeRef.current = Date.now()

    const currentDevices = devicesRef.current
    const nextDevices = currentDevices.map((device) =>
      device.id === deviceId ? { ...device, volume } : device
    )
    devicesRef.current = nextDevices
    setDevices(nextDevices)
    setMasterVolume(computeMasterVolume(nextDevices))

    pendingDeviceVolRef.current.set(deviceId, volume)
    if (!deviceInFlightRef.current.get(deviceId) && !deviceThrottleTimerRef.current.has(deviceId)) {
      pendingDeviceVolRef.current.delete(deviceId)
      sendDeviceVolumeRequest(deviceId, volume)
    } else if (!deviceThrottleTimerRef.current.has(deviceId)) {
      const timer = setTimeout(() => {
        deviceThrottleTimerRef.current.delete(deviceId)
        if (!deviceInFlightRef.current.get(deviceId) && pendingDeviceVolRef.current.has(deviceId)) {
          const nextVol = pendingDeviceVolRef.current.get(deviceId)!
          pendingDeviceVolRef.current.delete(deviceId)
          sendDeviceVolumeRequest(deviceId, nextVol)
        }
      }, 50)
      deviceThrottleTimerRef.current.set(deviceId, timer)
    }
  }

  const handleDeviceVolumeCommit = (deviceId: string, volume: number) => {
    isInteractingRef.current = false
    lastInteractionTimeRef.current = Date.now()

    const timer = deviceThrottleTimerRef.current.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      deviceThrottleTimerRef.current.delete(deviceId)
    }

    if (deviceInFlightRef.current.get(deviceId)) {
      pendingDeviceVolRef.current.set(deviceId, volume)
    } else {
      pendingDeviceVolRef.current.delete(deviceId)
      sendDeviceVolumeRequest(deviceId, volume)
    }
  }

  const sendGroupVolumeRequest = async (volume: number) => {
    masterInFlightRef.current = true
    try {
      await api.post<any>('/api/ytmusic/airplay/volume/master', { volume })
    } catch (error) {
      console.error('Failed to update group volume', error)
    } finally {
      masterInFlightRef.current = false
      if (pendingMasterVolRef.current !== null) {
        const nextVol = pendingMasterVolRef.current
        pendingMasterVolRef.current = null
        sendGroupVolumeRequest(nextVol)
      }
    }
  }

  const handleGroupVolumeChange = (newVolume: number) => {
    isInteractingRef.current = true
    lastInteractionTimeRef.current = Date.now()

    const currentDevices = devicesRef.current
    const selected = currentDevices.filter((d) => d.isSelected && !d.isHidden)
    if (selected.length === 0) {
      setMasterVolume(0)
      return
    }

    const currentAvg = Math.round(selected.reduce((sum, d) => sum + d.volume, 0) / selected.length)
    const delta = newVolume - currentAvg

    const nextDevices = currentDevices.map((device) => {
      if (!device.isSelected || device.isHidden) return device
      let nextVol: number
      if (newVolume === 0) {
        nextVol = 0
      } else if (newVolume === 100) {
        nextVol = 100
      } else {
        nextVol = Math.max(0, Math.min(100, device.volume + delta))
      }
      return { ...device, volume: nextVol }
    })

    const newAvg = computeMasterVolume(nextDevices)
    devicesRef.current = nextDevices
    setDevices(nextDevices)
    setMasterVolume(newAvg)

    pendingMasterVolRef.current = newVolume
    if (!masterInFlightRef.current && !masterThrottleTimerRef.current) {
      pendingMasterVolRef.current = null
      sendGroupVolumeRequest(newVolume)
    } else if (!masterThrottleTimerRef.current) {
      masterThrottleTimerRef.current = setTimeout(() => {
        masterThrottleTimerRef.current = null
        if (!masterInFlightRef.current && pendingMasterVolRef.current !== null) {
          const nextVol = pendingMasterVolRef.current
          pendingMasterVolRef.current = null
          sendGroupVolumeRequest(nextVol)
        }
      }, 50)
    }
  }

  const handleGroupVolumeCommit = (newVolume: number) => {
    isInteractingRef.current = false
    lastInteractionTimeRef.current = Date.now()

    if (masterThrottleTimerRef.current) {
      clearTimeout(masterThrottleTimerRef.current)
      masterThrottleTimerRef.current = null
    }

    if (masterInFlightRef.current) {
      pendingMasterVolRef.current = newVolume
    } else {
      pendingMasterVolRef.current = null
      sendGroupVolumeRequest(newVolume)
    }
  }

  const setDeviceHidden = async (deviceId: string, hidden: boolean) => {
    const currentDevices = devicesRef.current
    const nextDevices = currentDevices.map((device) =>
      device.id === deviceId
        ? { ...device, isHidden: hidden, isSelected: hidden ? false : device.isSelected }
        : device
    )
    devicesRef.current = nextDevices
    setDevices(nextDevices)
    setMasterVolume(computeMasterVolume(nextDevices))

    try {
      const response = await api.post<any>('/api/ytmusic/airplay/devices/hide', { deviceId, hidden })
      if (Array.isArray(response?.devices)) {
        if (!isInteractingRef.current) {
          devicesRef.current = response.devices
          setDevices(response.devices)
          setMasterVolume(
            typeof response?.masterVolume === 'number'
              ? response.masterVolume
              : computeMasterVolume(response.devices)
          )
        }
      }
    } catch (error) {
      console.error('Failed to update speaker visibility', error)
      fetchDevices()
    }
  }

  const updateDeviceSyncOffset = (deviceId: string, offsetMs: number) => {
    setDevices((previous) => previous.map((device) =>
      device.id === deviceId ? { ...device, syncOffsetMs: offsetMs } : device
    ))
  }

  const commitDeviceSyncOffset = async (deviceId: string, offsetMs: number) => {
    updateDeviceSyncOffset(deviceId, offsetMs)
    try {
      await api.post<any>('/api/ytmusic/airplay/sync-offset/device', { deviceId, offsetMs })
    } catch (error) {
      console.error('Failed to update speaker sync offset', error)
      fetchDevices()
    }
  }

  const hiddenDevices = devices.filter((device) => device.isHidden)
  const displayedDevices = devices.filter((device) => showHidden ? device.isHidden : !device.isHidden)
  const selectedCount = devices.filter((device) => device.isSelected && !device.isHidden).length

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] pointer-events-auto" onPointerDown={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: position.bottom ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: position.bottom ? 6 : -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.isMobile ? undefined : position.left,
              right: position.isMobile ? undefined : position.right,
              maxHeight: position.maxHeight,
              transformOrigin: position.origin,
            }}
            className={`fixed z-[150] pointer-events-auto flex flex-col overflow-hidden rounded-[1.35rem] border border-[var(--outline-var)] glass p-2.5 text-ink shadow-[0_20px_55px_rgba(0,0,0,0.35)] backdrop-blur-2xl ${
              position.isMobile
                ? 'left-3 right-3 mx-auto w-auto max-w-[23rem]'
                : 'w-[23rem]'
            }`}
          >
            {showHidden ? (
              <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[var(--outline-var)] px-2 pb-2">
                <span className="text-sm font-semibold text-ink">Hidden Speakers</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close AirPlay speakers"
                  title="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
                >
                  <Icon name="close" className="text-xl" />
                </button>
              </div>
            ) : (
              <div className="mb-2 flex shrink-0 items-center gap-2 border-b border-[var(--outline-var)] px-1 pb-2">
                <div className="min-w-0 flex-1">
                  <VolumeCapsuleScrubber
                    value={masterVolume}
                    onChange={handleGroupVolumeChange}
                    onChangeEnd={handleGroupVolumeCommit}
                    label={selectedCount === 0 ? "No Speakers Selected" : "All Speakers"}
                    disabled={selectedCount === 0}
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close AirPlay speakers"
                  title="Close"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
                >
                  <Icon name="close" className="text-xl" />
                </button>
              </div>
            )}
            <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {displayedDevices.length ? displayedDevices.map((device) => (
                <div key={device.id} className="flex flex-col rounded-2xl px-1">
                  <div className="flex h-12 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => device.isHidden ? setDeviceHidden(device.id, false) : toggleDevice(device)}
                    aria-label={device.isHidden ? `Show ${device.name}` : `${device.isSelected ? 'Deselect' : 'Select'} ${device.name}`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition cursor-pointer ${
                      device.isHidden
                        ? 'border-[var(--outline)] text-ink-soft'
                        : device.isSelected
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                          : 'border-[var(--outline)] text-transparent hover:border-[var(--primary)]'
                    }`}
                  >
                    <Icon name={device.isHidden ? 'add' : 'check'} filled className="text-lg" />
                  </button>

                  <div className="min-w-0 flex-1">
                    {device.isSelected ? (
                      <VolumeCapsuleScrubber
                        value={device.volume}
                        onChange={(vol) => handleDeviceVolumeChange(device.id, vol)}
                        onChangeEnd={(vol) => handleDeviceVolumeCommit(device.id, vol)}
                        label={device.name}
                      />
                    ) : (
                      <div
                        onClick={() => !device.isHidden && toggleDevice(device)}
                        className={`flex h-11 min-w-0 flex-1 items-center px-3 rounded-xl border border-[var(--outline-var)] bg-[var(--sc)] transition ${
                          device.isHidden ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-[var(--sc-high)]'
                        }`}
                      >
                        <span className="truncate text-[0.92rem] font-medium text-ink">
                          {device.name}
                        </span>
                      </div>
                    )}
                  </div>

                    {!showHidden && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCalibratingDeviceId((current) => current === device.id ? null : device.id)}
                          aria-label={`Adjust sync for ${device.name}`}
                          title="Adjust speaker sync"
                          className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
                            calibratingDeviceId === device.id ? 'bg-[var(--sc-high)] text-[var(--primary)]' : 'text-ink-soft hover:bg-[var(--sc-high)] hover:text-ink'
                          }`}
                        >
                          <Icon name="tune" className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeviceHidden(device.id, true)}
                          aria-label={`Hide ${device.name}`}
                          title="Hide speaker"
                          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
                        >
                          <Icon name="visibility_off" className="text-lg" />
                        </button>
                      </>
                    )}
                  </div>
                  {calibratingDeviceId === device.id && !showHidden && (
                    <div className="mb-2 ml-9 rounded-xl border border-[var(--outline-var)] bg-[var(--sc)] px-3 py-2">
                      <div className="mb-1 flex items-center justify-between text-[0.7rem] text-ink-soft">
                        <span>Speaker sync</span>
                        <span>{device.syncOffsetMs > 0 ? `Delay ${device.syncOffsetMs} ms` : device.syncOffsetMs < 0 ? `Advance ${Math.abs(device.syncOffsetMs)} ms` : 'Matched'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="-500"
                          max="500"
                          step="5"
                          value={device.syncOffsetMs ?? 0}
                          onChange={(event) => updateDeviceSyncOffset(device.id, Number(event.target.value))}
                          onPointerUp={(event) => commitDeviceSyncOffset(device.id, Number(event.currentTarget.value))}
                          onKeyUp={(event) => commitDeviceSyncOffset(device.id, Number(event.currentTarget.value))}
                          aria-label={`Sync offset for ${device.name}`}
                          className="min-w-0 flex-1 accent-[var(--primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => commitDeviceSyncOffset(device.id, 0)}
                          className="rounded-lg px-2 py-1 text-[0.7rem] font-medium text-ink-soft hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-ink-soft">
                  {loading ? 'Scanning for AirPlay speakers...' : 'No speakers found.'}
                </div>
              )}
            </div>

            {(hiddenDevices.length > 0 || showHidden) && (
              <button
                type="button"
                onClick={() => setShowHidden((value) => !value)}
                className="mt-1 flex shrink-0 h-10 w-full items-center justify-center gap-2 border-t border-[var(--outline-var)] text-xs font-medium text-ink-soft transition hover:text-ink cursor-pointer"
              >
                <Icon name={showHidden ? 'arrow_back' : 'visibility'} className="text-base" />
                {showHidden ? 'Speakers' : `${hiddenDevices.length} hidden`}
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
