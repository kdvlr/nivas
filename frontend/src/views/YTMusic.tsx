import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { Track } from '../components/ytmusic/MiniPlayerBar'
import AirPlaySelectorModal from '../components/ytmusic/AirPlaySelectorModal'

interface YTMusicViewProps {
  currentTrack: Track | null
  isPlaying: boolean
  onPlayTrack: (track: Track, queue?: Track[]) => void
  onTogglePlay: () => void
}

type TabType = 'explore' | 'library' | 'queue' | 'lyrics'
type FilterType = 'all' | 'songs' | 'albums' | 'artists' | 'playlists'

export default function YTMusic({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
}: YTMusicViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('explore')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [homeSections, setHomeSections] = useState<any[]>([])
  const [charts, setCharts] = useState<any>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [queue, setQueue] = useState<Track[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showAirPlayModal, setShowAirPlayModal] = useState(false)
  const [authStatus, setAuthStatus] = useState<any>({ authenticated: false })

  // Fetch initial home feed & charts
  useEffect(() => {
    fetchHome()
    fetchCharts()
    checkAuth()
    fetchPlayerState()
    const interval = setInterval(fetchPlayerState, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchPlayerState = async () => {
    try {
      const state = await api.get<any>('/api/ytmusic/player/state')
      if (state && Array.isArray(state.queue)) {
        setQueue(state.queue)
      }
    } catch (e) {
      // Ignore
    }
  }

  // Fetch lyrics when track changes
  useEffect(() => {
    if (currentTrack?.videoId) {
      fetchLyrics(currentTrack.videoId)
    }
  }, [currentTrack?.videoId])

  const checkAuth = async () => {
    try {
      const res = await api.get<any>('/api/ytmusic/auth')
      setAuthStatus(res)
    } catch (e) {
      console.error('Auth check error', e)
    }
  }

  const fetchHome = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/ytmusic/home?limit=8')
      if (Array.isArray(res)) {
        setHomeSections(res)
      }
    } catch (e) {
      console.error('Failed to load home feed', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCharts = async () => {
    try {
      const res = await api.get<any>('/api/ytmusic/charts?country=IN')
      setCharts(res)
    } catch (e) {
      console.error('Failed to load charts', e)
    }
  }

  const handleSearch = async (query: string = searchQuery, filter: FilterType = filterType) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setLoading(true)
    try {
      const filterParam = filter === 'all' ? null : filter
      const res = await api.get<any[]>(`/api/ytmusic/search?q=${encodeURIComponent(query)}${filterParam ? `&filter=${filterParam}` : ''}`)
      if (Array.isArray(res)) {
        setSearchResults(res)
      }
    } catch (e) {
      console.error('Search error', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchLyrics = async (videoId: string) => {
    try {
      const res = await api.get<any>(`/api/ytmusic/lyrics/${videoId}`)
      if (res && res.lyrics) {
        setLyrics(res.lyrics)
      } else {
        setLyrics('No lyrics found for this song.')
      }
    } catch (e) {
      setLyrics('Failed to load lyrics.')
    }
  }

  const openAlbum = async (browseId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/api/ytmusic/album/${browseId}`)
      setSelectedAlbum(res)
    } catch (e) {
      console.error('Failed to load album', e)
    } finally {
      setLoading(false)
    }
  }

  const playItem = (item: any) => {
    const videoId = item.videoId || item.id
    if (!videoId) return

    const track: Track = {
      videoId,
      title: item.title || item.name || 'Unknown Track',
      artist: Array.isArray(item.artists)
        ? item.artists.map((a: any) => a.name).join(', ')
        : item.artist?.name || item.artist || 'Unknown Artist',
      thumbnail: Array.isArray(item.thumbnails) && item.thumbnails.length > 0
        ? item.thumbnails[item.thumbnails.length - 1].url
        : item.thumbnail,
      album: item.album?.name || item.album || '',
      duration: item.duration_seconds || 0,
    }

    // Add to queue if not present
    setQueue((prev) => [...prev, track])
    onPlayTrack(track)
  }

  return (
    <div className="min-h-screen bg-[var(--surface,#0b0f19)] text-slate-100 p-4 md:p-8 pb-32">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-slate-950 shadow-lg shadow-rose-500/30">
            <Icon name="music_note" className="text-3xl font-bold" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">YouTube Music</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Fast InnerTube Engine</span>
              <span>·</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${authStatus.authenticated ? 'text-emerald-400' : 'text-amber-400'}`}>
                <Icon name={authStatus.authenticated ? 'verified' : 'account_circle'} className="text-xs" />
                {authStatus.authenticated ? 'Personal Account' : 'Guest Mode'}
              </span>
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <div className="relative flex items-center">
            <Icon name="search" className="absolute left-4 text-slate-400 text-xl" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleSearch(e.target.value, filterType)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery, filterType)}
              placeholder="Search songs, artists, albums, or playlists..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 pl-12 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500/60 focus:bg-white/10 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="absolute right-3 text-slate-400 hover:text-slate-200"
              >
                <Icon name="close" className="text-lg" />
              </button>
            )}
          </div>
        </div>

        {/* AirPlay Speaker Multi-Room Trigger */}
        <button
          onClick={() => setShowAirPlayModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-semibold text-sm transition shadow-lg shadow-sky-500/10"
        >
          <Icon name="airplay" className="text-xl" />
          <span>AirPlay 2 Multi-Room</span>
        </button>
      </div>

      {/* Filter Chips for Search */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'songs', 'albums', 'artists', 'playlists'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilterType(f)
                handleSearch(searchQuery, f)
              }}
              className={`capitalize px-4 py-1.5 rounded-full text-xs font-semibold transition border ${
                filterType === f
                  ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-md'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-3 border-b border-white/10 mb-8 pb-3">
          {[
            { id: 'explore', label: 'Explore & Charts', icon: 'explore' },
            { id: 'library', label: 'My Library', icon: 'library_music' },
            { id: 'queue', label: `Queue (${queue.length})`, icon: 'queue_music' },
            { id: 'lyrics', label: 'Lyrics', icon: 'short_text' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition border ${
                activeTab === tab.id
                  ? 'bg-white/10 text-rose-400 border-rose-500/40 shadow-md'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon name={tab.icon} className="text-lg" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Icon name="sync" className="text-4xl animate-spin text-rose-400" />
          <p className="text-sm font-medium">Loading YouTube Music feed...</p>
        </div>
      ) : searchQuery ? (
        /* Search Results Grid */
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-bold text-slate-200">
            Search Results for "{searchQuery}"
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((item, idx) => (
              <div
                key={item.videoId || item.browseId || idx}
                onClick={() => (item.videoId ? playItem(item) : item.browseId ? openAlbum(item.browseId) : null)}
                className="group flex items-center gap-4 rounded-2xl bg-white/5 p-3 border border-white/5 hover:border-rose-500/40 hover:bg-white/10 transition cursor-pointer"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800 border border-white/10">
                  {item.thumbnails && item.thumbnails.length > 0 ? (
                    <img
                      src={item.thumbnails[item.thumbnails.length - 1].url}
                      alt={item.title || item.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-rose-500/20 text-rose-400">
                      <Icon name="music_note" className="text-2xl" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Icon name="play_arrow" className="text-white text-2xl" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-100 truncate group-hover:text-rose-400 transition">
                    {item.title || item.name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {Array.isArray(item.artists)
                      ? item.artists.map((a: any) => a.name).join(', ')
                      : item.artist?.name || item.artist || item.resultType}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'explore' ? (
        /* Explore Section */
        <div className="flex flex-col gap-10">
          {/* Top Charts */}
          {charts && charts.songs && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Icon name="trending_up" className="text-rose-400" />
                  Top Songs Charts
                </h2>
                <span className="text-xs text-slate-400">US Top 100</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {charts.songs.items.slice(0, 6).map((song: any, i: number) => (
                  <div
                    key={song.videoId || i}
                    onClick={() => playItem(song)}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 border border-white/5 hover:border-rose-500/40 hover:bg-white/10 transition cursor-pointer"
                  >
                    <span className="font-mono font-bold text-slate-400 text-sm w-5 text-center">
                      {i + 1}
                    </span>
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                      <img
                        src={song.thumbnails?.[0]?.url}
                        alt={song.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold truncate">{song.title}</h4>
                      <p className="text-xs text-slate-400 truncate">
                        {Array.isArray(song.artists)
                          ? song.artists.map((a: any) => a.name).join(', ')
                          : song.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Home Feed Quick Sections */}
          {homeSections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-slate-200">{section.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {section.contents.map((item: any, i: number) => (
                  <div
                    key={item.videoId || item.browseId || i}
                    onClick={() => (item.videoId ? playItem(item) : item.browseId ? openAlbum(item.browseId) : null)}
                    className="group flex flex-col gap-2 rounded-2xl bg-white/5 p-3 border border-white/5 hover:border-rose-500/40 hover:bg-white/10 transition cursor-pointer"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-800">
                      <img
                        src={item.thumbnails?.[item.thumbnails.length - 1]?.url}
                        alt={item.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Icon name="play_arrow" className="text-white text-3xl" />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 truncate group-hover:text-rose-400 transition">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {Array.isArray(item.artists)
                        ? item.artists.map((a: any) => a.name).join(', ')
                        : item.description || 'YouTube Music'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'lyrics' ? (
        /* Lyrics View */
        <div className="flex flex-col items-center justify-center py-10 max-w-2xl mx-auto text-center gap-6">
          {currentTrack ? (
            <>
              <div>
                <h2 className="text-2xl font-black text-rose-400">{currentTrack.title}</h2>
                <p className="text-slate-400 text-sm">{currentTrack.artist}</p>
              </div>
              <div className="rounded-3xl bg-white/5 border border-white/10 p-8 w-full text-slate-200 text-base leading-relaxed whitespace-pre-line shadow-inner max-h-[60vh] overflow-y-auto">
                {lyrics || 'Loading lyrics...'}
              </div>
            </>
          ) : (
            <p className="text-slate-400">Play a song to view lyrics</p>
          )}
        </div>
      ) : activeTab === 'queue' ? (
        /* Queue View */
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-200">Current Play Queue</h2>
          {queue.length === 0 ? (
            <p className="text-slate-400 py-10 text-center">No tracks in queue. Search and play songs to populate!</p>
          ) : (
            queue.map((track, i) => (
              <div
                key={i}
                onClick={() => onPlayTrack(track)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer ${
                  currentTrack?.videoId === track.videoId
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-slate-400">{i + 1}</span>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">{track.title}</h4>
                    <p className="text-xs text-slate-400">{track.artist}</p>
                  </div>
                </div>
                {currentTrack?.videoId === track.videoId && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-slate-950">
                    NOW PLAYING
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Selected Album Modal */}
      {selectedAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[var(--surface-elevated,#0f172a)] border border-white/10 p-6 flex flex-col gap-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedAlbum.thumbnails?.[0]?.url}
                  alt={selectedAlbum.title}
                  className="h-16 w-16 rounded-2xl object-cover border border-white/10"
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-100">{selectedAlbum.title}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedAlbum.artists?.[0]?.name} · {selectedAlbum.trackCount} Tracks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlbum(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {selectedAlbum.tracks?.map((t: any, idx: number) => (
                <div
                  key={t.videoId || idx}
                  onClick={() => {
                    playItem(t)
                    setSelectedAlbum(null)
                  }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400 w-5 text-center">{idx + 1}</span>
                    <span className="font-medium text-slate-200">{t.title}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{t.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AirPlaySelectorModal
        isOpen={showAirPlayModal}
        onClose={() => setShowAirPlayModal(false)}
      />
    </div>
  )
}
