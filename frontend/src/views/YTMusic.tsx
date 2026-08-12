import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { Track } from '../components/ytmusic/MiniPlayerBar'
import AirPlaySelectorModal from '../components/ytmusic/AirPlaySelectorModal'
import NowPlayingQueue from '../components/ytmusic/NowPlayingQueue'

interface YTMusicViewProps {
  currentTrack: Track | null
  isPlaying: boolean
  queue: Track[]
  elapsedSeconds: number
  durationSeconds: number
  onPlayTrack: (track: Track, queue?: Track[]) => void
  onTogglePlay: () => void
  onNextTrack: () => void
  onQueueTrack: (track: Track, playNext: boolean) => void
}

const isSong = (item: any) => {
  if (!item?.videoId || item.resultType === 'video') return false
  const videoType = String(item.videoType || '').toUpperCase()
  return !videoType.includes('_OMV') && !videoType.includes('_UGC')
}

const toTrack = (item: any): Track | null => {
  if (!isSong(item)) return null
  const durationValue = item.duration_seconds || item.durationSeconds || item.duration || 0
  let duration = Number(durationValue) || 0
  if (!duration && typeof durationValue === 'string' && durationValue.includes(':')) {
    duration = durationValue.split(':').reduce((total: number, part: string) => total * 60 + Number(part), 0)
  }
  return {
    videoId: item.videoId,
    title: item.title || 'Unknown Track',
    artist: Array.isArray(item.artists)
      ? item.artists.map((artist: any) => artist.name).filter(Boolean).join(', ')
      : item.artist?.name || item.artist || 'Unknown Artist',
    thumbnail: item.thumbnails?.at(-1)?.url || item.thumbnail,
    album: item.album?.name || item.album || '',
    duration,
  }
}

function SongRow({
  item,
  onPlay,
  onQueue,
}: {
  item: any
  onPlay: (track: Track) => void
  onQueue: (track: Track, playNext: boolean) => void
}) {
  const track = toTrack(item)
  if (!track) return null
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-2.5 transition hover:border-rose-400/35 hover:bg-white/[0.08]">
      <button onClick={() => onPlay(track)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">
        {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : <Icon name="music_note" className="text-2xl text-rose-300" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
          <Icon name="play_arrow" className="text-2xl text-white" />
        </span>
      </button>
      <button onClick={() => onPlay(track)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-bold text-white group-hover:text-rose-300">{track.title}</p>
        <p className="truncate text-xs text-white/45">{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
      </button>
      <button onClick={() => onQueue(track, true)} title="Play next" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-rose-500/20 hover:text-rose-300">
        <Icon name="playlist_play" className="text-xl" />
      </button>
      <button onClick={() => onQueue(track, false)} title="Add to queue" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
        <Icon name="queue_music" className="text-xl" />
      </button>
    </div>
  )
}

export default function YTMusic({
  currentTrack,
  isPlaying,
  queue,
  elapsedSeconds,
  durationSeconds,
  onPlayTrack,
  onTogglePlay,
  onNextTrack,
  onQueueTrack,
}: YTMusicViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [homeSections, setHomeSections] = useState<any[]>([])
  const [charts, setCharts] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showAirPlayModal, setShowAirPlayModal] = useState(false)
  const [authStatus, setAuthStatus] = useState<any>({ authenticated: false })

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/api/ytmusic/home?limit=8').then((value) => setHomeSections(Array.isArray(value) ? value : [])),
      api.get<any>('/api/ytmusic/charts?country=IN').then(setCharts),
      api.get<any>('/api/ytmusic/auth').then(setAuthStatus),
    ]).catch(() => {})
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      api.get<any[]>(`/api/ytmusic/search?q=${encodeURIComponent(searchQuery)}&filter=songs`)
        .then((results) => setSearchResults(Array.isArray(results) ? results.filter(isSong) : []))
        .catch(() => setSearchResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const discoverySongs = useMemo(() => {
    const songs: any[] = []
    const seen = new Set<string>()
    const add = (item: any) => {
      if (isSong(item) && !seen.has(item.videoId)) {
        seen.add(item.videoId)
        songs.push(item)
      }
    }
    charts?.songs?.items?.forEach(add)
    homeSections.forEach((section) => section.contents?.forEach(add))
    return songs.slice(0, 24)
  }, [charts, homeSections])

  const visibleSongs = searchQuery.trim() ? searchResults : discoverySongs

  return (
    <div className="min-h-full bg-[var(--surface,#0b0f19)] p-4 pb-32 text-slate-100 md:p-6 md:pb-32">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-slate-950 shadow-lg shadow-rose-500/25">
            <Icon name="music_note" className="text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">YouTube Music</h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              Audio-only · Autoplay on · {authStatus.authenticated ? 'Personal account' : 'Guest mode'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowAirPlayModal(true)} className="flex items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/20 px-4 py-2.5 text-sm font-semibold text-sky-300">
          <Icon name="airplay" className="text-xl" /> AirPlay rooms
        </button>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.72fr)]">
        <section className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 md:p-5">
          <div className="relative mb-5">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-white/40" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search songs only…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-12 pr-12 text-sm outline-none transition focus:border-rose-400/60"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45"><Icon name="close" /></button>}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold">{searchQuery ? `Songs matching “${searchQuery}”` : 'Songs for you'}</h2>
              <p className="text-xs text-white/40">Videos and user uploads are filtered out</p>
            </div>
            {!searchQuery && <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">Music only</span>}
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-white/45"><Icon name="sync" className="animate-spin text-2xl text-rose-300" /> Finding songs…</div>
            ) : visibleSongs.length ? (
              visibleSongs.map((item, index) => <SongRow key={`${item.videoId}-${index}`} item={item} onPlay={onPlayTrack} onQueue={onQueueTrack} />)
            ) : (
              <div className="py-16 text-center text-sm text-white/40">{searchQuery ? 'No audio-only songs found.' : 'Search for a song to begin.'}</div>
            )}
          </div>
        </section>

        <aside className="xl:sticky xl:top-4">
          {currentTrack ? (
            <NowPlayingQueue
              currentTrack={currentTrack}
              queue={queue}
              isPlaying={isPlaying}
              elapsedSeconds={elapsedSeconds}
              durationSeconds={durationSeconds}
              onTogglePlay={onTogglePlay}
              onNextTrack={onNextTrack}
            />
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
              <Icon name="album" className="mb-4 text-6xl text-rose-300/60" />
              <h2 className="text-xl font-black">Choose a song</h2>
              <p className="mt-2 max-w-xs text-sm text-white/40">The album, playback progress, and autoplay queue will stay visible here.</p>
            </div>
          )}
        </aside>
      </div>

      <AirPlaySelectorModal isOpen={showAirPlayModal} onClose={() => setShowAirPlayModal(false)} />
    </div>
  )
}
