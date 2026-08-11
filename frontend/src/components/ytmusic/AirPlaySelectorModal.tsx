import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
}

interface AirPlaySelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AirPlaySelectorModal({ isOpen, onClose }: AirPlaySelectorModalProps) {
  const [devices, setDevices] = useState<AirPlayDevice[]>([])
  const [masterVolume, setMasterVolume] = useState<number>(70)
  const [loading, setLoading] = useState<boolean>(false)

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await api.get<any>('/api/ytmusic/airplay/devices')
      if (Array.isArray(res)) {
        setDevices(res)
      }
      const status = await api.get<any>('/api/ytmusic/airplay/status')
      if (status && typeof status.masterVolume === 'number') {
        setMasterVolume(status.masterVolume)
      }
    } catch (e) {
      console.error('Failed to fetch AirPlay devices', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchDevices()
      const interval = setInterval(fetchDevices, 5000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const toggleDevice = async (deviceId: string, currentSelected: boolean) => {
    try {
      const updated = await api.post<any>('/api/ytmusic/airplay/devices/toggle', {
        deviceId,
        selected: !currentSelected,
      })
      if (Array.isArray(updated)) {
        setDevices(updated)
      }
    } catch (e) {
      console.error('Failed to toggle device', e)
    }
  }

  const handleDeviceVolume = async (deviceId: string, vol: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, volume: vol } : d))
    )
    try {
      await api.post<any>('/api/ytmusic/airplay/volume/device', { deviceId, volume: vol })
    } catch (e) {
      console.error('Failed to update device volume', e)
    }
  }

  const handleMasterVolume = async (vol: number) => {
    setMasterVolume(vol)
    try {
      const res = await api.post<any>('/api/ytmusic/airplay/volume/master', { volume: vol })
      if (res && Array.isArray(res.devices)) {
        setDevices(res.devices)
      }
    } catch (e) {
      console.error('Failed to update master volume', e)
    }
  }

  if (!isOpen) return null

  const selectedCount = devices.filter((d) => d.isSelected).length

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg overflow-hidden rounded-3xl bg-[var(--surface-elevated,#1e293b)] border border-white/10 shadow-2xl text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400">
                <Icon name="airplay" className="text-2xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-wide">AirPlay 2 Speakers</h3>
                <p className="text-xs text-slate-400">
                  {selectedCount > 0
                    ? `Streaming to ${selectedCount} speaker${selectedCount > 1 ? 's' : ''}`
                    : 'Select speakers for multi-room output'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-slate-300"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
            {/* Master Volume */}
            <div className="rounded-2xl bg-white/5 p-4 flex flex-col gap-2 border border-white/5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Icon name="volume_up" className="text-sky-400" />
                  Master Multi-Room Volume
                </span>
                <span className="text-sky-400">{masterVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={masterVolume}
                onChange={(e) => handleMasterVolume(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-700 accent-sky-400 cursor-pointer"
              />
            </div>

            {/* Device List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Discovered Speakers ({devices.length})</span>
                <button
                  onClick={fetchDevices}
                  disabled={loading}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition"
                >
                  <Icon name="sync" className={`text-sm ${loading ? 'animate-spin' : ''}`} />
                  Scan
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 rounded-2xl bg-white/5 text-slate-400 gap-2 border border-dashed border-white/10">
                  <Icon name="speaker_group" className="text-4xl text-slate-500" />
                  <p className="text-sm font-medium">Scanning local network for AirPlay 2 devices...</p>
                  <p className="text-xs text-slate-500">Ensure HomePods or Apple TVs are on the same Wi-Fi</p>
                </div>
              ) : (
                devices.map((device) => (
                  <div
                    key={device.id}
                    className={`flex flex-col gap-3 rounded-2xl p-4 transition-all duration-200 border ${
                      device.isSelected
                        ? 'bg-sky-950/40 border-sky-500/50 shadow-md'
                        : 'bg-white/5 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => toggleDevice(device.id, device.isSelected)}
                        className="flex items-center gap-3 cursor-pointer select-none flex-1"
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                            device.isSelected
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {device.isSelected && <Icon name="check" className="text-base font-bold" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100">{device.name}</span>
                            {device.isSelected && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {device.model} · {device.address}
                          </span>
                        </div>
                      </div>
                    </div>

                    {device.isSelected && (
                      <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                        <Icon name="volume_down" className="text-slate-400 text-sm" />
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={device.volume}
                          onChange={(e) => handleDeviceVolume(device.id, Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-slate-700 accent-sky-400 cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-300 w-8 text-right">
                          {device.volume}%
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-t border-white/10 text-xs text-slate-400">
            <span>Synchronized AirPlay 2 Engine</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition shadow-lg shadow-sky-500/20"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
