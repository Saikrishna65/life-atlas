/**
 * Life Atlas Music Vault - Data Types & Interfaces (Phase 16)
 */

export type AudioSourceType = 'IMPORTED' | 'STREAM' | 'DOWNLOADED';
export type DownloadStatus = 'IDLE' | 'DOWNLOADING' | 'DOWNLOADED' | 'FAILED';
export type RepeatMode = 'OFF' | 'ALL' | 'ONE';
export type SmartPlaylistType = 'FAVORITES' | 'RECENTLY_PLAYED' | 'MOST_PLAYED' | 'OFFLINE';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // in seconds
  format: string; // MIME type or extension, e.g. 'audio/mpeg'
  size: number; // bytes
  bitrate?: number; // kbps
  artworkUrl?: string; // base64 or blob URL or remote URL
  audioBlob?: Blob | null; // stored in IndexedDB for local/downloaded tracks
  streamUrl?: string; // for remote streams
  audioUrl?: string; // Online cloud storage URL
  source: AudioSourceType;
  downloadStatus?: DownloadStatus;
  downloadProgress?: number; // 0 to 100
  isFavorite: boolean;
  playCount: number;
  lastPlayedAt?: number; // Unix timestamp
  addedAt: number; // Unix timestamp
  fileName?: string;
  year?: string;
  lyrics?: string;
  tripId?: string; // Optional direct expedition association
  syncedToCloud?: boolean; // Cloud sync state
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  isSmart?: boolean;
  smartType?: SmartPlaylistType;
  tripId?: string; // Associated Trip Vault Trip ID
  createdAt: number;
  updatedAt: number;
}

export interface PlayHistoryRecord {
  id?: number;
  trackId: string;
  timestamp: number;
  durationPlayed: number;
}

export interface MusicStorageReport {
  totalTracks: number;
  importedTracks: number;
  downloadedTracks: number;
  streamTracks: number;
  totalBytes: number;
  formattedSize: string;
  quotaBytes?: number;
  quotaUsedPercentage?: number;
}

export interface PlaybackState {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  playbackRate: number; // 0.5 to 2.0
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: MusicTrack[];
  queueIndex: number;
  error: string | null;
  sourceContext?: {
    type: 'LIBRARY' | 'PLAYLIST' | 'ALBUM' | 'ARTIST' | 'SMART_PLAYLIST';
    id?: string;
    title?: string;
  };
}
