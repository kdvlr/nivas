import React, { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../Icon'
import { api } from '../../lib/api'

export interface AirPlayDevice {
  id: string
  name: string
  address: string
  port: number
  model: string
  isSelected: boolean
  volume: number
  isConnected: boolean
  isHidden: boolean
}

interface AirPlaySelectorModalProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

interface PanelPosition {
  top?: number
  bottom?: number
  right?: number
  isMobile: boolean
  origin: string
}

export default function AirPlaySelectorModal({ isOpen, onClose, anchorRef }: AirPlaySelectorModalProps) {
  const [devices, setDevices] = useState<AirPlayDevice[]>([])
  const [masterVolume, setMasterVolume] = useState(70)
  const [loading, setLoading] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [position, setPosition] = useState<PanelPosition>({ top: 84, right: 20, isMobile: false, origin: 'top right' })

  const fetchDevices = async () => {
    try {
      const response = await api.get<any>('/api/ytmusic/player/state')
      if (Array.isArray(response?.devices)) setDevices(response.devices)
      if (typeof response?.masterVolume === 'number') setMasterVolume(response.masterVolume)
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
      if (isMobile) {
        const rectangle = anchorRef.current?.getBoundingClientRect()
        const bottom = rectangle && rectangle.top > 0
          ? Math.max(16, window.innerHeight - rectangle.top + 8)
          : 84
        setPosition({
          bottom,
          isMobile: true,
          origin: 'bottom center',
        })
        return
      }

      const rectangle = anchorRef.current?.getBoundingClientRect()
      if (!rectangle || (rectangle.width === 0 && rectangle.height === 0)) {
        setPosition({ bottom: 20, right: 16, isMobile: false, origin: 'bottom right' })
        return
      }
      const panelWidth = 368
      const calculatedRight = Math.max(12, window.innerWidth - rectangle.right)
      const maxRight = Math.max(12, window.innerWidth - panelWidth - 12)
      const right = Math.min(maxRight, calculatedRight)
      const estimatedHeight = Math.min(520, 76 + devices.length * 52)
      if (rectangle.bottom + estimatedHeight + 12 <= window.innerHeight) {
        setPosition({ top: rectangle.bottom + 8, right, isMobile: false, origin: 'top right' })
      } else {
        setPosition({ bottom: Math.max(12, window.innerHeight - rectangle.top + 8), right, isMobile: false, origin: 'bottom right' })
      }
    }
    placePanel()
    window.addEventListener('resize', placePanel)
    return () => window.removeEventListener('resize', placePanel)
  }, [isOpen, anchorRef, devices.length])

  const toggleDevice = async (device: AirPlayDevice) => {
    const selected = !device.isSelected
    setDevices((previous) => previous.map((item) => item.id === device.id ? { ...item, isSelected: selected } : item))
    try {
      const response = await api.post<any>('/api/ytmusic/airplay/devices/toggle', { deviceId: device.id, selected })
      if (Array.isArray(response?.devices)) setDevices(response.devices)
    } catch (error) {
      console.error('Failed to toggle AirPlay device', error)
      fetchDevices()
    }
  }

  const setDeviceVolume = async (deviceId: string, volume: number) => {
    setDevices((previous) => previous.map((device) => device.id === deviceId ? { ...device, volume } : device))
    try {
      const response = await api.post<any>('/api/ytmusic/airplay/volume/device', { deviceId, volume })
      if (Array.isArray(response?.devices)) setDevices(response.devices)
    } catch (error) {
      console.error('Failed to update AirPlay volume', error)
    }
  }

  const setGroupVolume = async (volume: number) => {
    setMasterVolume(volume)
    setDevices((previous) => previous.map((device) => device.isSelected ? { ...device, volume } : device))
    try {
      const response = await api.post<any>('/api/ytmusic/airplay/volume/master', { volume })
      if (Array.isArray(response?.devices)) setDevices(response.devices)
    } catch (error) {
      console.error('Failed to update group volume', error)
    }
  }

  const setDeviceHidden = async (deviceId: string, hidden: boolean) => {
    setDevices((previous) => previous.map((device) => device.id === deviceId ? { ...device, isHidden: hidden, isSelected: hidden ? false : device.isSelected } : device))
    try {
      const response = await api.post<any>('/api/ytmusic/airplay/devices/hide', { deviceId, hidden })
      if (Array.isArray(response?.devices)) setDevices(response.devices)
    } catch (error) {
      console.error('Failed to update speaker visibility', error)
      fetchDevices()
    }
  }

  const hiddenDevices = devices.filter((device) => device.isHidden)
  const displayedDevices = devices.filter((device) => showHidden ? device.isHidden : !device.isHidden)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150]" onPointerDown={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: position.bottom ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: position.bottom ? 6 : -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              top: position.top,
              bottom: position.bottom,
              right: position.isMobile ? undefined : position.right,
              transformOrigin: position.origin,
            }}
            className={`fixed z-[150] overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#242427]/95 p-2 text-white shadow-[0_20px_55px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${
              position.isMobile
                ? 'left-3 right-3 mx-auto w-auto max-w-[23rem]'
                : 'w-[23rem]'
            }`}
          >
            {!showHidden && (
              <div className="mb-1 flex h-14 items-center gap-2 border-b border-white/10 px-1.5 pb-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <Icon name="volume_up" className="text-lg" />
                </div>
                <div className="relative h-11 min-w-0 flex-1 overflow-hidden rounded-xl bg-white/[0.09]">
                  <div className="absolute inset-y-0 left-0 bg-white/[0.13]" style={{ width: `${masterVolume}%` }} />
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-3">
                    <span className="text-[0.95rem] font-semibold text-white/95">All Speakers</span>
                    <span className="text-xs tabular-nums text-white/55">{masterVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masterVolume}
                    onChange={(event) => setGroupVolume(Number(event.target.value))}
                    aria-label="All speakers volume"
                    className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0 touch-none"
                  />
                </div>
                <div className="w-8 shrink-0" />
              </div>
            )}
            <div className="max-h-[min(31rem,calc(100vh-7rem))] overflow-y-auto overscroll-contain">
              {displayedDevices.length ? displayedDevices.map((device) => (
                <div key={device.id} className="flex h-14 items-center gap-2 rounded-2xl px-1.5 transition hover:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => device.isHidden ? setDeviceHidden(device.id, false) : toggleDevice(device)}
                    aria-label={device.isHidden ? `Show ${device.name}` : `${device.isSelected ? 'Deselect' : 'Select'} ${device.name}`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      device.isHidden
                        ? 'border-white/30 text-white/70'
                        : device.isSelected
                          ? 'border-sky-400 bg-sky-500 text-white'
                          : 'border-white/35 text-transparent hover:border-white/65'
                    }`}
                  >
                    <Icon name={device.isHidden ? 'add' : 'check'} filled className="text-lg" />
                  </button>

                  <div className={`relative h-11 min-w-0 flex-1 overflow-hidden rounded-xl ${device.isSelected ? 'bg-white/[0.09]' : 'bg-transparent'}`}>
                    {device.isSelected && (
                      <div className="absolute inset-y-0 left-0 bg-white/[0.13]" style={{ width: `${device.volume}%` }} />
                    )}
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between gap-2 px-3">
                      <span className={`truncate text-[0.95rem] font-medium ${device.isHidden ? 'text-white/55' : 'text-white/95'}`}>{device.name}</span>
                      {device.isSelected && <span className="text-xs tabular-nums text-white/55">{device.volume}%</span>}
                    </div>
                    {device.isSelected && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={device.volume}
                        onChange={(event) => setDeviceVolume(device.id, Number(event.target.value))}
                        aria-label={`${device.name} volume`}
                        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                      />
                    )}
                  </div>

                  {!showHidden && (
                    <button
                      type="button"
                      onClick={() => setDeviceHidden(device.id, true)}
                      aria-label={`Hide ${device.name}`}
                      title="Hide speaker"
                      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-white/25 transition hover:bg-white/10 hover:text-white/65"
                    >
                      <Icon name="visibility_off" className="text-lg" />
                    </button>
                  )}
                </div>
              )) : (
                <div className="flex h-24 items-center justify-center gap-2 text-sm text-white/45">
                  {loading && <Icon name="progress_activity" className="animate-spin" />}
                  {showHidden ? 'No hidden speakers' : 'Looking for speakers…'}
                </div>
              )}
            </div>

            {(hiddenDevices.length > 0 || showHidden) && (
              <button
                type="button"
                onClick={() => setShowHidden((value) => !value)}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 border-t border-white/10 text-xs font-medium text-white/45 transition hover:text-white/75"
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
}
