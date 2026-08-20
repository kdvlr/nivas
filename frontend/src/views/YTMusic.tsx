import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { Track } from '../components/ytmusic/MiniPlayerBar'
import AirPlaySelectorModal from '../components/ytmusic/AirPlaySelectorModal'
import TopClockHeader from '../components/TopClockHeader'

interface YTMusicViewProps {
  now?: Date
  config?: any
  currentTrack: Track | null
  isPlaying: boolean
  queue: Track[]
  elapsedSeconds: number
  durationSeconds: number
  onPlayTrack: (track: Track, queue?: Track[]) => void
  onTogglePlay: () => void
  onNextTrack: () => void
  onPrevTrack: () => void
  onSeek: (seconds: number) => void
  onQueueTrack: (track: Track, playNext: boolean) => void
  onQueueChange: (queue: Track[]) => void
}

type PlayerTab = 'queue' | 'lyrics'
type MusicView = 'browse' | 'now-playing'

const TARGET_PLAYLISTS = [
  { id: 'RDCLAK5uy_lBNUteBRencHzKelu5iDHwLF6mYqjL-JU', defaultTitle: 'Top Hindi Hits' },
  { id: 'RDCLAK5uy_nNhhgRET3NcJ4SJBvqhAIJ6t7vjsQYowc', defaultTitle: 'Tollywood Top 50' },
  { id: 'RDCLAK5uy_lyVnWI5JnuwKJiuE-n1x-Un0mj9WlEyZw', defaultTitle: 'Tollywood Hitlist' },
  { id: 'RDCLAK5uy_myv3cB_L96tlcINvAx0uS9LdgTdweJMYM', defaultTitle: 'Bollywood Dance Party' },
] as const

interface PlaylistItem {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string
  tracks?: Track[]
}

interface AlbumItem {
  browseId: string
  playlistId?: string
  title: string
  artist: string
  thumbnail?: string
  year?: string
  trackCount?: number
}

const isSong = (item: any) => {
  return Boolean(item && item.videoId)
}

const thumbnailUrl = (item: any): string | undefined => {
  const value = item?.thumbnails || item?.thumbnail
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const image = [...value].reverse().find((entry) => typeof entry === 'string' || entry?.url)
    return typeof image === 'string' ? image : image?.url
  }
  return value?.url
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
    thumbnail: thumbnailUrl(item),
    album: item.album?.name || item.album || '',
    duration,
    isPureAudio: item.isPureAudio !== undefined ? item.isPureAudio : (item.resultType === 'video' ? false : true),
  }
}

const formatTime = (seconds = 0) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

const highResolutionArtwork = (url?: string) => {
  if (!url) return ''
  return url
    .replace(/=w\d+-h\d+[^?&]*/, '=w1200-h1200-l90-rj')
    .replace(/=s\d+[^?&]*/, '=s1200')
}

// Daily pseudo-random generator seeded by date
function getDateRandom(date: Date) {
  const dateStr = date.toISOString().slice(0, 10)
  let h = 2166136261
  for (let i = 0; i < dateStr.length; i++) {
    h = Math.imul(h ^ dateStr.charCodeAt(i), 16777619)
  }
  return function nextFloat() {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h >>> 0) % 1000000) / 1000000
  }
}

function SongRow({
  track,
  index,
  active = false,
  onPlay,
  onQueue,
}: {
  track: Track
  index?: number
  active?: boolean
  onPlay: () => void
  onQueue?: (playNext: boolean) => void
}) {
  return (
    <div
      className={`group flex min-h-[4.5rem] items-center gap-3 border-b border-white/10 px-3 py-2 transition ${
        active ? 'bg-white/[0.12]' : 'hover:bg-white/[0.07]'
      }`}
    >
      {typeof index === 'number' && (
        <span className="w-5 shrink-0 text-center text-xs tabular-nums text-white/35">
          {index + 1}
        </span>
      )}
      <button
        onClick={onPlay}
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/10"
      >
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="music_note" className="text-2xl text-white/45" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          <Icon name="play_arrow" filled className="text-2xl text-white" />
        </span>
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate text-[0.95rem] font-semibold text-white">{track.title}</p>
          {track.isPureAudio === false && (
            <span className="inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/25 text-rose-300 border border-rose-500/30">
              <Icon name="smart_display" className="text-xs" /> Video
            </span>
          )}
        </div>
        <p className="truncate text-sm text-white/50">
          {track.artist}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </button>
      {track.duration ? (
        <span className="hidden text-sm tabular-nums text-white/50 sm:block">
          {formatTime(track.duration)}
        </span>
      ) : null}
      {onQueue && (
        <div className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={() => onQueue(true)}
            title="Play next"
            className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-white"
          >
            <Icon name="playlist_play" className="text-2xl" />
          </button>
          <button
            onClick={() => onQueue(false)}
            title="Add to queue"
            className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-white"
          >
            <Icon name="queue_music" className="text-xl" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function YTMusicView({
  now: initialNow,
  currentTrack,
  isPlaying,
  queue,
  elapsedSeconds,
  durationSeconds,
  onPlayTrack,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onQueueTrack,
  onQueueChange,
}: YTMusicViewProps) {
  const getSubViewFromHash = useCallback((): { view: MusicView; search: string; video: boolean } => {
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    const savedVideoOnly = (() => {
      try {
        return localStorage.getItem('ytmusic_video_only') === 'true'
      } catch {
        return false
      }
    })()
    if (queryIndex === -1) {
      return { view: currentTrack ? 'now-playing' : 'browse', search: '', video: savedVideoOnly }
    }
    const params = new URLSearchParams(hash.slice(queryIndex))
    const viewParam = params.get('view')
    const searchParam = params.get('search') || ''
    const videoParam = params.has('video') ? params.get('video') === '1' || params.get('video') === 'true' : savedVideoOnly
    return {
      view: (viewParam === 'now-playing' || viewParam === 'browse') ? viewParam : (currentTrack ? 'now-playing' : 'browse'),
      search: searchParam,
      video: videoParam,
    }
  }, [currentTrack])

  const initialParsed = getSubViewFromHash()
  const [searchQuery, setSearchQuery] = useState(initialParsed.search)
  const [videoOnly, setVideoOnly] = useState<boolean>(initialParsed.video)
  const [searchTopResult, setSearchTopResult] = useState<Track | null>(null)
  const [searchSongs, setSearchSongs] = useState<Track[]>([])
  const [searchAlbums, setSearchAlbums] = useState<AlbumItem[]>([])
  const [searchVideos, setSearchVideos] = useState<Track[]>([])
  const [searchCategory, setSearchCategory] = useState<'all' | 'songs' | 'albums' | 'videos'>('all')
  const [openingAlbumId, setOpeningAlbumId] = useState<string | null>(null)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // YouTube Music Home 10 Playlists (2 rows of 5)
  const [homePlaylists, setHomePlaylists] = useState<PlaylistItem[]>([])
  // Target 4 Playlists with tracks
  const [targetPlaylists, setTargetPlaylists] = useState<PlaylistItem[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(true)
  const [openingPlaylistId, setOpeningPlaylistId] = useState<string | null>(null)

  const [activeView, setActiveView] = useState<MusicView>(initialParsed.view)
  const [showAirPlayModal, setShowAirPlayModal] = useState(false)
  const airPlayButtonRef = useRef<HTMLButtonElement>(null)
  const [playerTab, setPlayerTab] = useState<PlayerTab>('queue')
  const [lyrics, setLyrics] = useState<string>('')
  const [loadingLyrics, setLoadingLyrics] = useState(false)
  const [now, setNow] = useState(new Date())

  // Queue state for drag-and-drop
  const [editableQueue, setEditableQueue] = useState<Track[]>(queue)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const editableQueueRef = useRef<Track[]>(queue)

  const syncUrlSubView = useCallback((nextView: MusicView, nextSearch: string = '', nextVideo?: boolean, replace = false) => {
    const params = new URLSearchParams()
    if (nextView) params.set('view', nextView)
    if (nextSearch) params.set('search', nextSearch)
    const effectiveVideo = typeof nextVideo === 'boolean' ? nextVideo : videoOnly
    if (effectiveVideo) params.set('video', '1')
    const newHash = `#/ytmusic${params.toString() ? `?${params.toString()}` : ''}`
    if (window.location.hash !== newHash) {
      if (replace) {
        window.history.replaceState(null, '', newHash)
      } else {
        window.history.pushState(null, '', newHash)
      }
    }
    setActiveView(nextView)
    setSearchQuery(nextSearch)
    if (typeof nextVideo === 'boolean') {
      setVideoOnly(nextVideo)
      try {
        localStorage.setItem('ytmusic_video_only', String(nextVideo))
      } catch {
        // Ignore
      }
    }
  }, [videoOnly])

  const handleToggleVideoOnly = useCallback((enabled: boolean) => {
    setVideoOnly(enabled)
    try {
      localStorage.setItem('ytmusic_video_only', String(enabled))
    } catch {
      // Ignore
    }
    syncUrlSubView(activeView, searchQuery, enabled, true)
  }, [activeView, searchQuery, syncUrlSubView])

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.hash.startsWith('#/ytmusic')) {
        const parsed = getSubViewFromHash()
        setActiveView(parsed.view)
        setSearchQuery(parsed.search)
        setVideoOnly(parsed.video)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [getSubViewFromHash])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activePointerIdRef.current === null) {
      setEditableQueue(queue)
      editableQueueRef.current = queue
    }
  }, [queue])

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    activePointerIdRef.current = index
    setDraggedIndex(index)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const sourceIndex = activePointerIdRef.current
    if (sourceIndex === null) return
    const targetElement = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-queue-index]') as HTMLElement | null
    const targetIndex = targetElement ? Number(targetElement.dataset.queueIndex) : Number.NaN
    if (!Number.isInteger(targetIndex) || targetIndex === sourceIndex) return

    const newQueue = [...editableQueueRef.current]
    const [movedTrack] = newQueue.splice(sourceIndex, 1)
    newQueue.splice(targetIndex, 0, movedTrack)
    editableQueueRef.current = newQueue
    activePointerIdRef.current = targetIndex
    setEditableQueue(newQueue)
    setDraggedIndex(targetIndex)
  }

  const handlePointerUp = () => {
    if (activePointerIdRef.current !== null) {
      activePointerIdRef.current = null
      setDraggedIndex(null)
      onQueueChange(editableQueueRef.current)
    }
  }

  const removeQueueTrack = (index: number) => {
    const nextQueue = editableQueue.filter((_, itemIndex) => itemIndex !== index)
    editableQueueRef.current = nextQueue
    setEditableQueue(nextQueue)
    onQueueChange(nextQueue)
  }

  // Load Top 10 YouTube Music Home playlists + The 4 Target Playlists
  useEffect(() => {
    Promise.all([
      // 1. Top 10 Home Playlists
      api.get<any[]>('/api/ytmusic/home?limit=10').catch(() => []),
      // 2. The 4 Target Playlists
      Promise.all(
        TARGET_PLAYLISTS.map(async (pl) => {
          try {
            const value = await api.get<any>(`/api/ytmusic/playlist/${pl.id}/songs?limit=25`)
            const rawTracks = Array.isArray(value?.tracks) ? value.tracks : []
            const tracks = rawTracks.map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
            const title = value?.title || pl.defaultTitle
            const thumbnail = thumbnailUrl(value) || tracks[0]?.thumbnail
            return {
              id: pl.id,
              title,
              subtitle: value?.author || 'Curated for you',
              thumbnail,
              tracks,
            }
          } catch {
            return {
              id: pl.id,
              title: pl.defaultTitle,
              subtitle: 'Curated for you',
              thumbnail: undefined,
              tracks: [],
            }
          }
        })
      ),
    ])
      .then(([homeData, targets]) => {
        // Extract 10 unique playlists from home data
        const seen = new Set<string>()
        const extracted: PlaylistItem[] = []
        for (const section of Array.isArray(homeData) ? homeData : []) {
          for (const item of section?.contents || []) {
            const plId = item?.playlistId || (item?.type === 'PLAYLIST' && item?.browseId)
            if (plId && !seen.has(plId)) {
              seen.add(plId)
              extracted.push({
                id: plId,
                title: item.title || 'Playlist',
                subtitle: item.description || section.title || 'YouTube Music',
                thumbnail: thumbnailUrl(item),
              })
            }
          }
        }
        setHomePlaylists(extracted.slice(0, 10))
        setTargetPlaylists(targets)
      })
      .finally(() => setDiscoveryLoading(false))
  }, [])

  // Play any playlist immediately
  const playAnyPlaylist = async (playlist: PlaylistItem) => {
    setOpeningPlaylistId(playlist.id)
    try {
      let tracks = playlist.tracks
      if (!tracks || !tracks.length) {
        const res = await api.get<any>(`/api/ytmusic/playlist/${playlist.id}/songs?limit=25`)
        tracks = (Array.isArray(res?.tracks) ? res.tracks : []).map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
      }
      if (tracks && tracks.length) {
        syncUrlSubView('now-playing')
        onPlayTrack(tracks[0], tracks.slice(1))
      }
    } finally {
      setOpeningPlaylistId(null)
    }
  }

  // Play full album immediately
  const playAlbum = async (album: AlbumItem) => {
    setOpeningAlbumId(album.browseId)
    try {
      const res = await api.get<any>(`/api/ytmusic/album/${album.browseId}/songs`)
      const tracks = (Array.isArray(res?.tracks) ? res.tracks : []).map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
      if (tracks && tracks.length) {
        syncUrlSubView('now-playing')
        onPlayTrack(tracks[0], tracks.slice(1))
      }
    } catch (err) {
      console.error('Failed to load album tracks:', err)
    } finally {
      setOpeningAlbumId(null)
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchTopResult(null)
      setSearchSongs([])
      setSearchAlbums([])
      setSearchVideos([])
      setLoading(false)
      return
    }
    setLoading(true)
    const filterType = videoOnly ? 'videos' : 'all'
    const handle = window.setTimeout(() => {
      api
        .get<any>(`/api/ytmusic/search?q=${encodeURIComponent(searchQuery)}&filter=${filterType}`)
        .then((res) => {
          if (Array.isArray(res)) {
            const tracks = res.map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
            setSearchTopResult(tracks[0] || null)
            setSearchSongs(tracks)
            setSearchAlbums([])
            setSearchVideos(tracks)
          } else if (res && typeof res === 'object') {
            const top = res.topResult ? toTrack(res.topResult) : null
            const songs = (Array.isArray(res.songs) ? res.songs : []).map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
            const albums: AlbumItem[] = Array.isArray(res.albums) ? res.albums : []
            const videos = (Array.isArray(res.videos) ? res.videos : []).map(toTrack).filter((t: Track | null): t is Track => Boolean(t))
            setSearchTopResult(top || songs[0] || videos[0] || null)
            setSearchSongs(songs)
            setSearchAlbums(albums)
            setSearchVideos(videos)
          } else {
            setSearchTopResult(null)
            setSearchSongs([])
            setSearchAlbums([])
            setSearchVideos([])
          }
        })
        .catch(() => {
          setSearchTopResult(null)
          setSearchSongs([])
          setSearchAlbums([])
          setSearchVideos([])
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [searchQuery, videoOnly])

  useEffect(() => {
    setLyrics('')
    if (!currentTrack || playerTab !== 'lyrics') return
    setLoadingLyrics(true)
    api
      .get<any>(`/api/ytmusic/lyrics/${currentTrack.videoId}`)
      .then((res) => setLyrics(res?.lyrics || res?.text || ''))
      .catch(() => setLyrics(''))
      .finally(() => setLoadingLyrics(false))
  }, [currentTrack?.videoId, playerTab])

  // Compute daily randomized layout presentation
  const dailyLayout = useMemo(() => {
    const rnd = getDateRandom(now)

    // Format for each of the 4 target playlists: 'icon' or 'songs'
    const targetPresentations = targetPlaylists.map((pl) => {
      const mode = rnd() > 0.5 ? ('songs' as const) : ('icon' as const)
      return {
        playlist: pl,
        mode,
      }
    })

    // Randomize whether Home 10 Playlists appear first or after a hero playlist
    const showHomeTop = rnd() > 0.35

    return {
      targetPresentations,
      showHomeTop,
    }
  }, [targetPlaylists, now])

  const searchIsOpen = Boolean(searchQuery.trim())
  const browseIsOpen = searchIsOpen || activeView === 'browse' || !currentTrack
  const effectiveDuration = durationSeconds || currentTrack?.duration || 0

  // Render Top 10 YouTube Music Home Playlists in 2 rows of 5
  const renderHome10Playlists = () => {
    if (!homePlaylists.length) return null

    return (
      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">From YouTube Music</p>
          <h2 className="text-2xl font-bold text-white tracking-tight">Featured Playlists for You</h2>
        </div>
        {/* 2 Rows of 5 Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {homePlaylists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => playAnyPlaylist(pl)}
              className="group flex flex-col rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] p-3 text-left transition active:scale-[0.98] border border-white/10 cursor-pointer"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/10 shadow-md">
                {pl.thumbnail ? (
                  <img
                    src={pl.thumbnail}
                    alt={pl.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <Icon name="album" className="absolute inset-0 m-auto text-5xl text-white/25" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl">
                    <Icon name="play_arrow" filled className="text-2xl" />
                  </span>
                </div>
                {openingPlaylistId === pl.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Icon name="progress_activity" className="animate-spin text-3xl text-white" />
                  </span>
                )}
              </div>
              <p className="mt-2.5 truncate font-bold text-white text-sm sm:text-base leading-snug">{pl.title}</p>
              <p className="mt-0.5 truncate text-xs text-white/50">{pl.subtitle}</p>
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className={`bg-black text-white ${browseIsOpen ? 'min-h-full' : 'h-dvh flex flex-col overflow-hidden'}`}>
      {/* Top Header */}
      <header className="flex shrink-0 min-h-[4rem] md:min-h-[4.5rem] items-center gap-2 md:gap-4 border-b border-white/15 bg-black/95 px-3 md:px-8 backdrop-blur-xl">
        {mobileSearchOpen ? (
          <div className="flex md:hidden flex-1 flex-col gap-2 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-white/55" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => syncUrlSubView('browse', e.target.value, undefined, true)}
                  placeholder="Search songs, albums..."
                  className="h-10 w-full rounded-xl border border-white/20 bg-[#292929] pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/45"
                />
                {searchQuery && (
                  <button
                    onClick={() => syncUrlSubView('browse', '')}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-white/55 hover:text-white"
                  >
                    <Icon name="close" className="text-lg" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  syncUrlSubView('browse', '')
                  setMobileSearchOpen(false)
                }}
                className="px-2 text-sm font-semibold text-white/70 hover:text-white shrink-0"
              >
                Cancel
              </button>
            </div>
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-xs font-medium text-white/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={videoOnly}
                  onChange={(e) => handleToggleVideoOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/30 bg-black/40 text-rose-500 focus:ring-0 accent-rose-500 cursor-pointer"
                />
                <Icon name="smart_display" className={`text-base ${videoOnly ? 'text-rose-400' : 'text-white/60'}`} />
                <span>Video only songs</span>
              </label>
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 rounded-full bg-white/10 p-1">
              <button
                onClick={() => syncUrlSubView('browse', '')}
                className={`flex h-9 md:h-11 items-center gap-1.5 md:gap-2 rounded-full px-3 md:px-4 text-xs md:text-sm font-semibold ${
                  activeView === 'browse' && !searchIsOpen ? 'bg-white text-black' : 'text-white/65 hover:text-white'
                }`}
              >
                <Icon name="home" className="text-lg md:text-xl" />
                Home
              </button>
              <button
                disabled={!currentTrack}
                onClick={() => syncUrlSubView('now-playing', '')}
                className={`flex h-9 md:h-11 items-center gap-1.5 md:gap-2 rounded-full px-3 md:px-4 text-xs md:text-sm font-semibold disabled:opacity-30 ${
                  activeView === 'now-playing' && !searchIsOpen ? 'bg-white text-black' : 'text-white/65 hover:text-white'
                }`}
              >
                <Icon name="graphic_eq" className="text-lg md:text-xl" /> <span className="whitespace-nowrap">Now Playing</span>
              </button>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden md:relative md:flex md:flex-1 max-w-[52rem] items-center gap-2.5">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-white/55" />
                <input
                  value={searchQuery}
                  onChange={(e) => syncUrlSubView('browse', e.target.value, undefined, true)}
                  placeholder="Search songs, albums..."
                  className="h-14 w-full rounded-xl border border-white/20 bg-[#292929] pl-14 pr-12 text-lg text-white outline-none placeholder:text-white/50 focus:border-white/45"
                />
                {searchQuery && (
                  <button
                    onClick={() => syncUrlSubView('browse', '')}
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/55 hover:text-white"
                  >
                    <Icon name="close" />
                  </button>
                )}
              </div>
              <label
                title="Filter for video-only songs"
                className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] px-3.5 py-3 text-sm font-medium text-white transition shrink-0"
              >
                <input
                  type="checkbox"
                  checked={videoOnly}
                  onChange={(e) => handleToggleVideoOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-black/40 text-rose-500 focus:ring-0 accent-rose-500 cursor-pointer"
                />
                <Icon name="smart_display" className={`text-lg ${videoOnly ? 'text-rose-400' : 'text-white/60'}`} />
                <span className="whitespace-nowrap">Videos only</span>
              </label>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
              <TopClockHeader now={now} className="hidden sm:flex text-white [&_*]:text-white" />
              <button
                onClick={() => setMobileSearchOpen(true)}
                title="Search music"
                className="flex md:hidden h-10 w-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <Icon name="search" className="text-2xl" />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Main Content Area */}
      {browseIsOpen ? (
        <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
          {searchIsOpen ? (
            <>
              <div className="mb-6 space-y-4 border-b border-white/15 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Search results</p>
                    <h1 className="mt-1 text-2xl font-bold">
                      {videoOnly ? 'Videos' : 'Results'} matching “{searchQuery}”
                    </h1>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none hover:text-white transition rounded-xl bg-white/[0.08] hover:bg-white/[0.14] px-3.5 py-2 border border-white/15">
                    <input
                      type="checkbox"
                      checked={videoOnly}
                      onChange={(e) => handleToggleVideoOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-black/40 text-rose-500 focus:ring-0 accent-rose-500 cursor-pointer"
                    />
                    <Icon name="smart_display" className={`text-base ${videoOnly ? 'text-rose-400' : 'text-white/60'}`} />
                    <span>Video only songs</span>
                  </label>
                </div>

                {/* Category Filter Chips (Matching YouTube Music) */}
                {!videoOnly && !loading && (searchTopResult || searchSongs.length > 0 || searchAlbums.length > 0 || searchVideos.length > 0) && (
                  <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                    <button
                      onClick={() => setSearchCategory('all')}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs md:text-sm font-semibold transition ${
                        searchCategory === 'all'
                          ? 'bg-white text-black'
                          : 'bg-[#282828] text-white/80 hover:bg-[#383838] hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {searchSongs.length > 0 && (
                      <button
                        onClick={() => setSearchCategory('songs')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs md:text-sm font-semibold transition ${
                          searchCategory === 'songs'
                            ? 'bg-white text-black'
                            : 'bg-[#282828] text-white/80 hover:bg-[#383838] hover:text-white'
                        }`}
                      >
                        Songs
                      </button>
                    )}
                    {searchAlbums.length > 0 && (
                      <button
                        onClick={() => setSearchCategory('albums')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs md:text-sm font-semibold transition ${
                          searchCategory === 'albums'
                            ? 'bg-white text-black'
                            : 'bg-[#282828] text-white/80 hover:bg-[#383838] hover:text-white'
                        }`}
                      >
                        Albums
                      </button>
                    )}
                    {searchVideos.length > 0 && (
                      <button
                        onClick={() => setSearchCategory('videos')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs md:text-sm font-semibold transition ${
                          searchCategory === 'videos'
                            ? 'bg-white text-black'
                            : 'bg-[#282828] text-white/80 hover:bg-[#383838] hover:text-white'
                        }`}
                      >
                        Videos
                      </button>
                    )}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 py-24 text-white/50">
                  <Icon name="progress_activity" className="animate-spin text-2xl" /> Finding results for “{searchQuery}”…
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Top Result Card (Replicating YouTube Music Screenshot) */}
                  {!videoOnly && searchCategory === 'all' && searchTopResult && (
                    <section>
                      <div className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 rounded-2xl bg-[#212121] hover:bg-[#282828] p-4 sm:p-5 border border-white/10 transition shadow-xl">
                        <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                          <button
                            onClick={() => {
                              syncUrlSubView('now-playing', '')
                              onPlayTrack(searchTopResult)
                            }}
                            className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-white/10 shadow-md group/art cursor-pointer"
                          >
                            {searchTopResult.thumbnail ? (
                              <img src={searchTopResult.thumbnail} alt="" className="h-full w-full object-cover transition group-hover/art:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Icon name="music_note" className="text-3xl text-white/40" />
                              </div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/art:opacity-100 transition">
                              <Icon name="play_arrow" filled className="text-2xl text-white" />
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <h2
                              onClick={() => {
                                syncUrlSubView('now-playing', '')
                                onPlayTrack(searchTopResult)
                              }}
                              className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-snug line-clamp-1 cursor-pointer hover:underline"
                              title={searchTopResult.title}
                            >
                              {searchTopResult.title}
                            </h2>
                            <p className="mt-1.5 text-sm sm:text-base text-white/60 truncate flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-white/70">
                                {searchTopResult.isPureAudio === false ? 'Video' : 'Song'}
                              </span>
                              <span>•</span>
                              <span className="font-medium text-white/90">{searchTopResult.artist}</span>
                              {searchTopResult.duration ? (
                                <>
                                  <span>•</span>
                                  <span className="tabular-nums">{formatTime(searchTopResult.duration)}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        {/* Top Result Action Buttons */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => {
                              syncUrlSubView('now-playing', '')
                              onPlayTrack(searchTopResult)
                            }}
                            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition active:scale-95 shadow-md cursor-pointer"
                          >
                            <Icon name="play_arrow" filled className="text-xl text-black" />
                            Play
                          </button>
                          <button
                            onClick={() => onQueueTrack(searchTopResult, false)}
                            title="Add to queue"
                            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition active:scale-95 cursor-pointer"
                          >
                            <Icon name="playlist_add" className="text-xl text-white" />
                            Save
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Songs List */}
                  {(searchCategory === 'all' || searchCategory === 'songs') && searchSongs.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                          <Icon name="music_note" className="text-xl text-emerald-400" />
                          Songs
                        </h2>
                      </div>
                      <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/5">
                        {searchSongs.map((track, index) => (
                          <SongRow
                            key={`${track.videoId}-${index}`}
                            track={track}
                            index={index}
                            onPlay={() => {
                              syncUrlSubView('now-playing', '')
                              onPlayTrack(track)
                            }}
                            onQueue={(playNext) => onQueueTrack(track, playNext)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Albums Shelf */}
                  {!videoOnly && (searchCategory === 'all' || searchCategory === 'albums') && searchAlbums.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                          <Icon name="album" className="text-xl text-rose-400" />
                          Albums
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {searchAlbums.map((album) => (
                          <button
                            key={album.browseId}
                            onClick={() => playAlbum(album)}
                            className="group relative flex flex-col rounded-2xl bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.09] focus:outline-none border border-white/5 cursor-pointer"
                          >
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/10">
                              {album.thumbnail ? (
                                <img
                                  src={album.thumbnail}
                                  alt={album.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-white/5">
                                  <Icon name="album" className="text-4xl text-white/30" />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg transition transform group-hover:scale-105">
                                  {openingAlbumId === album.browseId ? (
                                    <Icon name="progress_activity" className="animate-spin text-2xl text-black" />
                                  ) : (
                                    <Icon name="play_arrow" filled className="text-2xl text-black" />
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2.5 line-clamp-1 text-sm font-semibold text-white group-hover:text-white" title={album.title}>
                              {album.title}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
                              {album.artist}
                              {album.year ? ` · ${album.year}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Videos List */}
                  {(searchCategory === 'all' || searchCategory === 'videos') && searchVideos.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                          <Icon name="smart_display" className="text-xl text-rose-400" />
                          Videos
                        </h2>
                      </div>
                      <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/5">
                        {searchVideos.map((track, index) => (
                          <SongRow
                            key={`${track.videoId}-video-${index}`}
                            track={track}
                            index={index}
                            onPlay={() => {
                              syncUrlSubView('now-playing', '')
                              onPlayTrack(track)
                            }}
                            onQueue={(playNext) => onQueueTrack(track, playNext)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Empty state */}
                  {!searchTopResult && searchSongs.length === 0 && searchAlbums.length === 0 && searchVideos.length === 0 && (
                    <div className="py-24 text-center text-white/45">
                      <Icon name="search_off" className="mx-auto text-4xl text-white/25 mb-2" />
                      <p className="text-base font-medium">No results found for “{searchQuery}”</p>
                      <p className="text-xs text-white/35 mt-1">Try searching for a different song, artist, or album</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-12">
              {discoveryLoading && (
                <div className="flex items-center justify-center gap-3 py-16 text-white/50">
                  <Icon name="progress_activity" className="animate-spin text-2xl" /> Loading YouTube Music…
                </div>
              )}

              {/* Home 10 Playlists (when placed at top in daily layout) */}
              {!discoveryLoading && dailyLayout.showHomeTop && renderHome10Playlists()}

              {/* The 4 Target Playlists with Daily Randomized Presentations */}
              {!discoveryLoading &&
                dailyLayout.targetPresentations.map(({ playlist: pl, mode }) => {
                  return (
                    <section key={pl.id} className="pt-2">
                      {mode === 'icon' ? (
                        /* Presentation A: Large Hero Icon Card */
                        <div className="rounded-3xl border border-white/15 bg-gradient-to-r from-white/[0.08] to-white/[0.03] p-6 sm:p-7 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-6 shadow-xl">
                          <div className="relative aspect-square w-44 sm:w-52 shrink-0 overflow-hidden rounded-2xl bg-white/10 shadow-2xl">
                            {pl.thumbnail ? (
                              <img
                                src={highResolutionArtwork(pl.thumbnail)}
                                alt={pl.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Icon name="album" className="absolute inset-0 m-auto text-7xl text-white/25" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-center sm:text-left">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300 border border-red-500/30">
                              <Icon name="playlist_play" className="text-base" /> Playlist
                            </span>
                            <h3 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                              {pl.title}
                            </h3>
                            <p className="mt-1 text-sm text-white/60">
                              {pl.tracks?.length || 25} tracks curated for today
                            </p>
                            <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                              <button
                                onClick={() => playAnyPlaylist(pl)}
                                className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-white/90 px-6 py-3 text-sm font-bold text-black shadow-lg transition active:scale-95 cursor-pointer"
                              >
                                <Icon name="play_arrow" filled className="text-xl" />
                                <span>Play Playlist</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Presentation B: Expanded Song List Grid */
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                                Playlist Tracklist
                              </p>
                              <h3 className="text-2xl font-bold text-white tracking-tight">{pl.title}</h3>
                            </div>
                            <button
                              onClick={() => playAnyPlaylist(pl)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
                            >
                              <Icon name="play_arrow" filled className="text-base" />
                              <span>Play All</span>
                            </button>
                          </div>
                          {pl.tracks && pl.tracks.length ? (
                            <div className="grid grid-cols-1 gap-x-5 lg:grid-cols-2">
                              {pl.tracks.slice(0, 10).map((track, index) => (
                                <SongRow
                                  key={`${track.videoId}-${index}`}
                                  track={track}
                                  index={index}
                                  onPlay={() => {
                                    syncUrlSubView('now-playing', '')
                                    onPlayTrack(track, pl.tracks?.slice(index + 1))
                                  }}
                                  onQueue={(playNext) => onQueueTrack(track, playNext)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white/[0.04] p-8 text-center text-white/40">
                              Songs are loading…
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}

              {/* Home 10 Playlists (when placed after target playlists in daily layout) */}
              {!discoveryLoading && !dailyLayout.showHomeTop && renderHome10Playlists()}
            </div>
          )}
        </main>
      ) : (
        /* Now Playing View */
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col xl:grid xl:grid-cols-[minmax(24rem,1.1fr)_minmax(24rem,0.9fr)]">
          {/* Desktop Artwork View */}
          <section className="hidden xl:flex h-full min-w-0 flex-col items-center justify-center overflow-hidden p-8">
            <div
              className="max-w-full"
              style={{ width: 'min(100%, max(16rem, calc(100dvh - 12rem)))' }}
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#181818] shadow-2xl shadow-black">
                {currentTrack?.thumbnail ? (
                  <img
                    src={highResolutionArtwork(currentTrack.thumbnail)}
                    alt={currentTrack.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-white/25">
                    <Icon name="album" className="text-8xl" />
                    <p className="mt-4 text-lg">Choose a song to begin</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Mobile Player Bar */}
          <section className="flex shrink-0 flex-col border-b border-white/15 bg-white/[0.03] p-3 md:p-4 xl:hidden">
            {currentTrack && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 md:h-16 md:w-16 shrink-0 overflow-hidden rounded-lg bg-[#181818] shadow-md">
                    {currentTrack.thumbnail ? (
                      <img
                        src={highResolutionArtwork(currentTrack.thumbnail)}
                        alt={currentTrack.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/25">
                        <Icon name="music_note" className="text-2xl" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-bold text-white">{currentTrack.title}</h1>
                    <p className="mt-0.5 truncate text-xs text-white/55">
                      {currentTrack.artist}
                      {currentTrack.album ? ` · ${currentTrack.album}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={onPrevTrack}
                      aria-label="Previous song"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="skip_previous" className="text-2xl" />
                    </button>
                    <button
                      onClick={onTogglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 cursor-pointer"
                    >
                      <Icon name={isPlaying ? 'pause' : 'play_arrow'} filled className="text-2xl" />
                    </button>
                    <button
                      onClick={onNextTrack}
                      aria-label="Next song"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="skip_next" className="text-2xl" />
                    </button>
                    <button
                      onClick={() => setShowAirPlayModal(true)}
                      title="Choose AirPlay rooms"
                      aria-label="Choose AirPlay rooms"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="airplay" className="text-xl" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] tabular-nums text-white/45">
                  <span>{formatTime(elapsedSeconds)}</span>
                  <input
                    type="range"
                    min={0}
                    max={effectiveDuration || 100}
                    value={Math.min(elapsedSeconds, effectiveDuration || 100)}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    aria-label="Playback position"
                    className="h-1 flex-1 cursor-pointer accent-white"
                  />
                  <span>{formatTime(effectiveDuration)}</span>
                </div>
              </>
            )}
          </section>

          {/* Right/Bottom Panel: Controls + Queue/Lyrics */}
          <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden xl:border-l xl:border-white/15">
            {currentTrack && (
              <div className="hidden border-b border-white/15 px-6 py-5 xl:block">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-bold">{currentTrack.title}</h1>
                    <p className="mt-1 truncate text-sm text-white/55">
                      {currentTrack.artist}
                      {currentTrack.album ? ` · ${currentTrack.album}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={onPrevTrack}
                      aria-label="Previous song"
                      className="flex h-12 w-12 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="skip_previous" className="text-3xl" />
                    </button>
                    <button
                      onClick={onTogglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 cursor-pointer"
                    >
                      <Icon name={isPlaying ? 'pause' : 'play_arrow'} filled className="text-3xl" />
                    </button>
                    <button
                      onClick={onNextTrack}
                      aria-label="Next song"
                      className="flex h-12 w-12 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="skip_next" className="text-3xl" />
                    </button>
                    <button
                      ref={airPlayButtonRef}
                      onClick={() => setShowAirPlayModal(true)}
                      title="Choose AirPlay rooms"
                      aria-label="Choose AirPlay rooms"
                      className="flex h-12 w-12 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Icon name="airplay" className="text-2xl" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs tabular-nums text-white/45">
                  <span>{formatTime(elapsedSeconds)}</span>
                  <input
                    type="range"
                    min={0}
                    max={effectiveDuration || 100}
                    value={Math.min(elapsedSeconds, effectiveDuration || 100)}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    aria-label="Playback position"
                    className="h-1 flex-1 cursor-pointer accent-white"
                  />
                  <span>{formatTime(effectiveDuration)}</span>
                </div>
              </div>
            )}

            <div className="grid shrink-0 grid-cols-2 border-b border-white/15">
              {[
                ['queue', 'Up next'],
                ['lyrics', 'Lyrics'],
              ].map(([tabKey, tabLabel]) => (
                <button
                  key={tabKey}
                  onClick={() => setPlayerTab(tabKey as PlayerTab)}
                  className={`relative py-3 text-xs font-semibold uppercase tracking-wide transition md:py-4 md:text-sm ${
                    playerTab === tabKey ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {tabLabel}
                  {playerTab === tabKey && <span className="absolute inset-x-4 bottom-0 h-0.5 bg-white" />}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {playerTab === 'queue' && (
                <div className="py-2">
                  {editableQueue.length ? (
                    editableQueue.map((track, index) => (
                      <div
                        key={`${track.videoId}-${index}`}
                        data-queue-index={index}
                        className={`flex items-center transition ${
                          draggedIndex === index ? 'bg-white/[0.14] opacity-80' : ''
                        }`}
                      >
                        <button
                          onPointerDown={(e) => handlePointerDown(e, index)}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          aria-label={`Move ${track.title}`}
                          title="Drag to reorder"
                          className="flex h-[4.5rem] w-10 shrink-0 touch-none items-center justify-center text-white/35 hover:text-white"
                        >
                          <Icon name="drag_indicator" className="text-2xl" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <SongRow
                            track={track}
                            active={false}
                            onPlay={() => onPlayTrack(track, editableQueue.slice(index + 1))}
                          />
                        </div>
                        <button
                          onClick={() => removeQueueTrack(index)}
                          aria-label={`Remove ${track.title} from queue`}
                          title="Remove from queue"
                          className="flex h-[4.5rem] w-11 shrink-0 items-center justify-center text-white/40 hover:text-red-400"
                        >
                          <Icon name="close" className="text-xl" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-12 text-center text-sm text-white/45">
                      Recommendations will appear after playback starts.
                    </p>
                  )}
                </div>
              )}

              {playerTab === 'lyrics' && (
                <div className="px-4 py-7">
                  {loadingLyrics ? (
                    <div className="flex items-center gap-2 text-white/45">
                      <Icon name="progress_activity" className="animate-spin" /> Loading lyrics…
                    </div>
                  ) : lyrics ? (
                    <p className="whitespace-pre-line text-lg md:text-xl font-medium leading-relaxed text-white/85">
                      {lyrics}
                    </p>
                  ) : (
                    <p className="py-12 text-center text-white/45">Lyrics are not available for this song.</p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </main>
      )}

      <AirPlaySelectorModal
        isOpen={showAirPlayModal}
        onClose={() => setShowAirPlayModal(false)}
        anchorRef={airPlayButtonRef}
      />
    </div>
  )
}
