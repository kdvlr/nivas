import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { Track } from '../components/ytmusic/MiniPlayerBar'
import AirPlaySelectorModal from '../components/ytmusic/AirPlaySelectorModal'

interface YTMusicViewProps {
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

type PlayerTab = 'queue' | 'lyrics' | 'related'
type MusicView = 'browse' | 'now-playing'

const CURATED_PLAYLISTS = [
  { id: 'RDCLAK5uy_nTbyVypdXPQd00z15bTWjZr7pG-26yyQ4', title: 'Kollywood Hitlist' },
  { id: 'RDCLAK5uy_lhIiKLMQM6_gokxx581SC-xQBSfJm9gqc', title: 'Bollywood Essentials' },
  { id: 'RDCLAK5uy_n9Fbdw7e6ap-98_A-8JYBmPv64v-Uaq1g', title: 'Bollywood Hitlist' },
  { id: 'RDCLAK5uy_lyVnWI5JnuwKJiuE-n1x-Un0mj9WlEyZw', title: 'Tollywood Hitlist' },
  { id: 'PL4fGSI1pDJn69On1f-8NAvX_CYlx7QyZc', title: 'Top 100 United States · Audio' },
] as const

interface DiscoverySection {
  id: string
  title: string
  tracks: Track[]
}

interface DiscoveryCard {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string
  kind: 'playlist' | 'album'
}

const isSong = (item: any) => {
  if (!item?.videoId || item.resultType === 'video') return false
  const videoType = String(item.videoType || '').toUpperCase()
  return !videoType.includes('_OMV') && !videoType.includes('_UGC')
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
    <div className={`group flex min-h-[4.5rem] items-center gap-3 border-b border-white/10 px-3 py-2 transition ${active ? 'bg-white/[0.12]' : 'hover:bg-white/[0.07]'}`}>
      {typeof index === 'number' && <span className="w-5 shrink-0 text-center text-xs tabular-nums text-white/35">{index + 1}</span>}
      <button onClick={onPlay} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-white/10">
        {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : <Icon name="music_note" className="text-2xl text-white/45" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          <Icon name="play_arrow" filled className="text-2xl text-white" />
        </span>
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[0.95rem] font-semibold text-white">{track.title}</p>
        <p className="truncate text-sm text-white/50">{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
      </button>
      {track.duration ? <span className="hidden text-sm tabular-nums text-white/50 sm:block">{formatTime(track.duration)}</span> : null}
      {onQueue && (
        <div className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={() => onQueue(true)} title="Play next" className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-white">
            <Icon name="playlist_play" className="text-2xl" />
          </button>
          <button onClick={() => onQueue(false)} title="Add to queue" className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-white">
            <Icon name="queue_music" className="text-xl" />
          </button>
        </div>
      )}
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
  onPrevTrack,
  onSeek,
  onQueueTrack,
  onQueueChange,
}: YTMusicViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [discoverySections, setDiscoverySections] = useState<DiscoverySection[]>([])
  const [mixCards, setMixCards] = useState<DiscoveryCard[]>([])
  const [releaseCards, setReleaseCards] = useState<DiscoveryCard[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(true)
  const [openingCardId, setOpeningCardId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<MusicView>(() => currentTrack ? 'now-playing' : 'browse')
  const [loading, setLoading] = useState(false)
  const [showAirPlayModal, setShowAirPlayModal] = useState(false)
  const airPlayButtonRef = useRef<HTMLButtonElement>(null)
  const [activeTab, setActiveTab] = useState<PlayerTab>('queue')
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [editableQueue, setEditableQueue] = useState<Track[]>(queue)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const editableQueueRef = useRef<Track[]>(queue)

  useEffect(() => {
    if (dragIndexRef.current === null) {
      setEditableQueue(queue)
      editableQueueRef.current = queue
    }
  }, [queue])

  const startQueueDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragIndexRef.current = index
    setDragIndex(index)
  }

  const moveQueueDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const fromIndex = dragIndexRef.current
    if (fromIndex === null) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-queue-index]')
    const toIndex = target ? Number(target.dataset.queueIndex) : Number.NaN
    if (!Number.isInteger(toIndex) || toIndex === fromIndex) return
    const reordered = [...editableQueueRef.current]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    editableQueueRef.current = reordered
    dragIndexRef.current = toIndex
    setEditableQueue(reordered)
    setDragIndex(toIndex)
  }

  const finishQueueDrag = () => {
    if (dragIndexRef.current === null) return
    dragIndexRef.current = null
    setDragIndex(null)
    onQueueChange(editableQueueRef.current)
  }

  const removeQueueTrack = (index: number) => {
    const nextQueue = editableQueue.filter((_, itemIndex) => itemIndex !== index)
    editableQueueRef.current = nextQueue
    setEditableQueue(nextQueue)
    onQueueChange(nextQueue)
  }

  useEffect(() => {
    Promise.all([
      Promise.all(CURATED_PLAYLISTS.map(async (playlist) => {
        try {
          const value = await api.get<any>(`/api/ytmusic/playlist/${playlist.id}/songs?limit=12`)
          const tracks = (Array.isArray(value?.tracks) ? value.tracks : []).map(toTrack).filter((track: Track | null): track is Track => Boolean(track))
          return { id: playlist.id, title: playlist.title, tracks }
        } catch {
          return { id: playlist.id, title: playlist.title, tracks: [] }
        }
      })),
      api.get<any[]>('/api/ytmusic/home?limit=20').catch(() => []),
      api.get<any>('/api/ytmusic/explore').catch(() => ({})),
    ]).then(([sections, home, explore]) => {
      setDiscoverySections(sections)
      const seenMixes = new Set<string>()
      setMixCards((Array.isArray(home) ? home : []).flatMap((section: any) => section?.contents || [])
        .filter((item: any) => item?.playlistId && !seenMixes.has(item.playlistId) && seenMixes.add(item.playlistId))
        .slice(0, 10)
        .map((item: any) => ({ id: item.playlistId, title: item.title || 'Mix', subtitle: item.description || 'YouTube Music', thumbnail: thumbnailUrl(item), kind: 'playlist' as const })))

      const homeReleases = (Array.isArray(home) ? home : []).find((section: any) => String(section?.title || '').toLowerCase().includes('new releases'))?.contents || []
      const releases = Array.isArray(explore?.new_releases) && explore.new_releases.length ? explore.new_releases : homeReleases
      setReleaseCards(releases.filter((item: any) => item?.browseId).slice(0, 10).map((item: any) => ({
        id: item.browseId,
        title: item.title || 'New release',
        subtitle: Array.isArray(item.artists) ? item.artists.map((artist: any) => artist.name).filter(Boolean).join(', ') : item.artist || item.type || 'Album',
        thumbnail: thumbnailUrl(item),
        kind: 'album' as const,
      })))
    }).finally(() => setDiscoveryLoading(false))
  }, [])

  const playDiscoveryCard = async (card: DiscoveryCard) => {
    setOpeningCardId(card.id)
    try {
      const value = card.kind === 'playlist'
        ? await api.get<any>(`/api/ytmusic/playlist/${card.id}/songs?limit=25`)
        : await api.get<any>(`/api/ytmusic/album/${card.id}`)
      const tracks = (Array.isArray(value?.tracks) ? value.tracks : []).map(toTrack).filter((track: Track | null): track is Track => Boolean(track))
      if (tracks.length) {
        setViewMode('now-playing')
        onPlayTrack(tracks[0], tracks.slice(1))
      }
    } finally {
      setOpeningCardId(null)
    }
  }

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

  useEffect(() => {
    setLyrics('')
    if (!currentTrack || activeTab !== 'lyrics') return
    setLyricsLoading(true)
    api.get<any>(`/api/ytmusic/lyrics/${currentTrack.videoId}`)
      .then((value) => setLyrics(value?.lyrics || value?.text || ''))
      .catch(() => setLyrics(''))
      .finally(() => setLyricsLoading(false))
  }, [currentTrack?.videoId, activeTab])

  useEffect(() => {
    setRelatedTracks([])
    if (!currentTrack || activeTab !== 'related') return
    setRelatedLoading(true)
    api.get<any>(`/api/ytmusic/watch?video_id=${encodeURIComponent(currentTrack.videoId)}`)
      .then((value) => {
        const tracks: any[] = Array.isArray(value?.tracks) ? value.tracks : []
        const seen = new Set([currentTrack.videoId])
        setRelatedTracks(tracks.map(toTrack).filter((track): track is Track => {
          if (!track || seen.has(track.videoId)) return false
          seen.add(track.videoId)
          return true
        }).slice(0, 20))
      })
      .catch(() => setRelatedTracks([]))
      .finally(() => setRelatedLoading(false))
  }, [currentTrack?.videoId, activeTab])

  const resultTracks = useMemo(
    () => searchResults.map(toTrack).filter((track): track is Track => Boolean(track)),
    [searchResults],
  )
  const searchIsOpen = Boolean(searchQuery.trim())
  const browseIsOpen = searchIsOpen || viewMode === 'browse' || !currentTrack
  const progressDuration = durationSeconds || currentTrack?.duration || 0

  return (
    <div className="min-h-full bg-black text-white">
      <header className="sticky top-0 z-20 flex min-h-[5.5rem] items-center gap-4 border-b border-white/15 bg-black/95 px-4 backdrop-blur-xl md:px-8">
        <div className="flex shrink-0 rounded-full bg-white/10 p-1">
          <button onClick={() => { setSearchQuery(''); setViewMode('browse') }} className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${viewMode === 'browse' && !searchIsOpen ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}><Icon name="home" className="text-xl" /> Home</button>
          <button disabled={!currentTrack} onClick={() => { setSearchQuery(''); setViewMode('now-playing') }} className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-30 ${viewMode === 'now-playing' && !searchIsOpen ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}><Icon name="graphic_eq" className="text-xl" /> Now Playing</button>
        </div>
        <div className="relative w-full max-w-[52rem]">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-white/55" />
          <input
            value={searchQuery}
            onChange={(event) => { setSearchQuery(event.target.value); setViewMode('browse') }}
            placeholder="Search songs, albums, artists"
            className="h-14 w-full rounded-xl border border-white/20 bg-[#292929] pl-14 pr-12 text-base text-white outline-none placeholder:text-white/50 focus:border-white/45 md:text-lg"
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/55 hover:text-white"><Icon name="close" /></button>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button ref={airPlayButtonRef} onClick={() => setShowAirPlayModal(true)} title="Choose AirPlay rooms" className="flex h-12 w-12 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white">
            <Icon name="airplay" className="text-[2rem]" />
          </button>
          <div className="hidden h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-lg font-semibold sm:flex">N</div>
        </div>
      </header>

      {browseIsOpen ? (
        <main className="mx-auto max-w-6xl px-4 py-7 md:px-8">
          {searchIsOpen ? <><div className="mb-5 flex items-end justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Search results</p>
              <h1 className="mt-1 text-2xl font-bold">Songs matching “{searchQuery}”</h1>
            </div>
            <span className="hidden text-sm text-white/45 sm:block">Songs only</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-white/50"><Icon name="progress_activity" className="animate-spin text-2xl" /> Finding songs…</div>
          ) : resultTracks.length ? (
            <div>{resultTracks.map((track, index) => <SongRow key={`${track.videoId}-${index}`} track={track} index={index} onPlay={() => { setSearchQuery(''); setViewMode('now-playing'); onPlayTrack(track, resultTracks.slice(index + 1)) }} onQueue={(playNext) => onQueueTrack(track, playNext)} />)}</div>
          ) : (
            <div className="py-24 text-center text-white/45">No audio-only songs found.</div>
          )}</> : (
            <div className="space-y-10">
              {discoveryLoading && <div className="flex items-center justify-center gap-3 py-16 text-white/50"><Icon name="progress_activity" className="animate-spin text-2xl" /> Loading YouTube Music…</div>}

              {mixCards.length > 0 && <section>
                <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Personalized</p><h1 className="text-2xl font-bold">Mixed for You</h1></div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {mixCards.map((card) => <button key={card.id} onClick={() => playDiscoveryCard(card)} className="group min-w-0 rounded-lg bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.1]">
                    <div className="relative aspect-square overflow-hidden rounded-md bg-white/10">{card.thumbnail ? <img src={card.thumbnail} alt="" className="h-full w-full object-cover" /> : <Icon name="album" className="absolute inset-0 m-auto text-5xl text-white/25" />}{openingCardId === card.id && <span className="absolute inset-0 flex items-center justify-center bg-black/55"><Icon name="progress_activity" className="animate-spin text-3xl" /></span>}</div>
                    <p className="mt-3 truncate font-semibold">{card.title}</p><p className="mt-0.5 truncate text-sm text-white/45">{card.subtitle}</p>
                  </button>)}
                </div>
              </section>}

              {releaseCards.length > 0 && <section>
                <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Albums</p><h1 className="text-2xl font-bold">New Releases</h1></div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {releaseCards.map((card) => <button key={card.id} onClick={() => playDiscoveryCard(card)} className="group min-w-0 rounded-lg bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.1]">
                    <div className="relative aspect-square overflow-hidden rounded-md bg-white/10">{card.thumbnail ? <img src={card.thumbnail} alt="" className="h-full w-full object-cover" /> : <Icon name="album" className="absolute inset-0 m-auto text-5xl text-white/25" />}{openingCardId === card.id && <span className="absolute inset-0 flex items-center justify-center bg-black/55"><Icon name="progress_activity" className="animate-spin text-3xl" /></span>}</div>
                    <p className="mt-3 truncate font-semibold">{card.title}</p><p className="mt-0.5 truncate text-sm text-white/45">{card.subtitle}</p>
                  </button>)}
                </div>
              </section>}

              {discoverySections.map((section) => (
                <section key={section.title}>
                  <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">YouTube Music playlist</p><h1 className="text-2xl font-bold">{section.title}</h1></div>
                  {section.tracks.length ? <div className="grid grid-cols-1 gap-x-5 lg:grid-cols-2">{section.tracks.map((track, index) => <SongRow key={track.videoId} track={track} index={index} onPlay={() => { setViewMode('now-playing'); onPlayTrack(track, section.tracks.slice(index + 1)) }} onQueue={(playNext) => onQueueTrack(track, playNext)} />)}</div> : <div className="rounded-xl bg-white/[0.04] p-8 text-center text-white/40">Trending songs are loading…</div>}
                </section>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="grid h-[calc(100dvh-5.5rem)] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(30rem,1.12fr)_minmax(27rem,0.88fr)]">
          <section className="flex h-full min-w-0 flex-col items-center justify-center overflow-hidden px-5 py-6 md:px-10">
            <div
              className="max-w-full"
              style={{ width: 'min(100%, max(16rem, calc(100dvh - 12.5rem)))' }}
            >
              <div className="aspect-square w-full overflow-hidden rounded-md bg-[#181818] shadow-2xl shadow-black">
                {currentTrack?.thumbnail ? (
                  <img src={highResolutionArtwork(currentTrack.thumbnail)} alt={currentTrack.title} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-white/25">
                    <Icon name="album" className="text-8xl" />
                    <p className="mt-4 text-lg">Choose a song to begin</p>
                  </div>
                )}
              </div>

            </div>
          </section>

          <aside className="h-full min-w-0 overflow-hidden border-t border-white/15 px-4 py-5 md:px-7 xl:border-l xl:border-t-0">
            <div className="flex h-full min-h-0 flex-col">
              {currentTrack && (
                <div className="border-b border-white/15 px-3 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <h1 className="truncate text-xl font-bold">{currentTrack.title}</h1>
                      <p className="mt-1 truncate text-sm text-white/55">{currentTrack.artist}{currentTrack.album ? ` · ${currentTrack.album}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={onPrevTrack} aria-label="Previous song" className="flex h-12 w-12 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><Icon name="skip_previous" className="text-3xl" /></button>
                      <button onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"><Icon name={isPlaying ? 'pause' : 'play_arrow'} filled className="text-3xl" /></button>
                      <button onClick={onNextTrack} aria-label="Next song" className="flex h-12 w-12 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><Icon name="skip_next" className="text-3xl" /></button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs tabular-nums text-white/45">
                    <span>{formatTime(elapsedSeconds)}</span>
                    <input type="range" min={0} max={progressDuration || 100} value={Math.min(elapsedSeconds, progressDuration || 100)} onChange={(event) => onSeek(Number(event.target.value))} aria-label="Playback position" className="h-1 flex-1 cursor-pointer accent-white" />
                    <span>{formatTime(progressDuration)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 border-b border-white/15">
                {([['queue', 'Up next'], ['lyrics', 'Lyrics'], ['related', 'Related']] as [PlayerTab, string][]).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`relative py-4 text-sm font-semibold uppercase tracking-wide transition ${activeTab === tab ? 'text-white' : 'text-white/50 hover:text-white/80'}`}>
                    {label}
                    {activeTab === tab && <span className="absolute inset-x-4 bottom-0 h-0.5 bg-white" />}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {activeTab === 'queue' && (
                <div>
                  <div className="flex items-center justify-between px-3 py-6">
                    <div>
                      <p className="text-sm text-white/50">Playing from</p>
                      <p className="mt-0.5 text-lg font-semibold">{currentTrack?.album || 'Autoplay'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">Autoplay</p>
                        <p className="hidden text-xs text-white/45 sm:block">Similar songs continue</p>
                      </div>
                      <span role="switch" aria-checked="true" aria-label="Autoplay enabled" className="relative h-7 w-12 rounded-full bg-sky-500"><span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white shadow" /></span>
                    </div>
                  </div>
                  {editableQueue.length ? editableQueue.map((track, index) => (
                    <div key={track.videoId} data-queue-index={index} className={`flex items-center transition ${dragIndex === index ? 'bg-white/[0.14] opacity-80' : ''}`}>
                      <button
                        onPointerDown={(event) => startQueueDrag(event, index)}
                        onPointerMove={moveQueueDrag}
                        onPointerUp={finishQueueDrag}
                        onPointerCancel={finishQueueDrag}
                        aria-label={`Move ${track.title}`}
                        title="Drag to reorder"
                        className="flex h-[4.5rem] w-10 shrink-0 touch-none items-center justify-center text-white/35 hover:text-white"
                      >
                        <Icon name="drag_indicator" className="text-2xl" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <SongRow track={track} active={false} onPlay={() => onPlayTrack(track, editableQueue.slice(index + 1))} />
                      </div>
                      <button onClick={() => removeQueueTrack(index)} aria-label={`Remove ${track.title} from queue`} title="Remove from queue" className="flex h-[4.5rem] w-11 shrink-0 items-center justify-center text-white/40 hover:text-red-400">
                        <Icon name="close" className="text-xl" />
                      </button>
                    </div>
                  )) : <p className="px-3 py-12 text-center text-sm text-white/45">Recommendations will appear after playback starts.</p>}
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="px-4 py-7">
                  {lyricsLoading ? <div className="flex items-center gap-2 text-white/45"><Icon name="progress_activity" className="animate-spin" /> Loading lyrics…</div>
                    : lyrics ? <p className="whitespace-pre-line text-xl font-medium leading-relaxed text-white/85">{lyrics}</p>
                      : <p className="py-12 text-center text-white/45">Lyrics are not available for this song.</p>}
                </div>
              )}

              {activeTab === 'related' && (
                <div>
                  {relatedLoading ? <p className="px-3 py-12 text-center text-sm text-white/45">Loading recommendations…</p> : relatedTracks.length ? relatedTracks.map((track, index) => (
                    <SongRow key={`${track.videoId}-${index}`} track={track} onPlay={() => onPlayTrack(track, relatedTracks.slice(index + 1))} onQueue={(playNext) => onQueueTrack(track, playNext)} />
                  )) : <p className="px-3 py-12 text-center text-sm text-white/45">No related songs were returned for this track.</p>}
                </div>
              )}
              </div>
            </div>
          </aside>
        </main>
      )}

      <AirPlaySelectorModal isOpen={showAirPlayModal} onClose={() => setShowAirPlayModal(false)} anchorRef={airPlayButtonRef} />
    </div>
  )
}
