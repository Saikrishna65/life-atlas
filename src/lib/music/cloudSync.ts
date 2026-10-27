/**
 * Life Atlas Music Vault - Online Cloud Synchronization Service
 * Manages dual persistence between local IndexedDB and Neon Postgres / Object Storage.
 */

import { MusicTrack, MusicPlaylist } from './types';
import { saveTrack, getTrack, getAllTracks } from './storage';

export interface CloudSyncResponse {
  success: boolean;
  tracks?: MusicTrack[];
  playlists?: MusicPlaylist[];
  error?: string;
}

/**
 * Uploads a music track and its audio file to the online database and cloud storage
 */
export async function uploadTrackToCloud(
  track: MusicTrack,
  fileBlob?: Blob | File | null
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  try {
    const formData = new FormData();

    // Use provided blob or track.audioBlob or fetch from IndexedDB
    let blobToUpload = fileBlob || track.audioBlob;
    if (!blobToUpload) {
      const stored = await getTrack(track.id);
      if (stored?.audioBlob) {
        blobToUpload = stored.audioBlob;
      }
    }

    if (blobToUpload) {
      const filename = track.fileName || `${track.id}.mp3`;
      formData.append('file', blobToUpload, filename);
    }

    // Strip raw blob from metadata JSON to keep payload clean
    const { audioBlob, ...metaToUpload } = track;
    formData.append('metadata', JSON.stringify(metaToUpload));

    const response = await fetch('/api/music', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Cloud upload responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.track) {
      const updatedUrl = data.track.audioUrl;
      // Mark track as synced locally
      const localTrack = (await getTrack(track.id)) || track;
      localTrack.audioUrl = updatedUrl;
      localTrack.streamUrl = updatedUrl || localTrack.streamUrl;
      localTrack.syncedToCloud = true;
      await saveTrack(localTrack);
      return { success: true, audioUrl: updatedUrl };
    }

    return { success: false, error: data.error };
  } catch (error) {
    console.warn('Cloud sync error for track:', track.title, error);
    return { success: false };
  }
}

/**
 * Fetches all tracks and playlists stored in the online database
 */
export async function fetchCloudTracks(): Promise<{
  tracks: MusicTrack[];
  playlists: MusicPlaylist[];
}> {
  try {
    const response = await fetch('/api/music', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      return { tracks: [], playlists: [] };
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.tracks)) {
      const mappedTracks: MusicTrack[] = data.tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album || 'Unknown Album',
        genre: t.genre || 'Soundtrack',
        duration: Number(t.duration || 0),
        format: t.format || 'audio/mpeg',
        size: Number(t.size || 0),
        bitrate: t.bitrate ? Number(t.bitrate) : undefined,
        artworkUrl: t.artworkUrl || undefined,
        audioUrl: t.audioUrl || undefined,
        streamUrl: t.audioUrl || `/api/music/stream/${t.id}`,
        source: 'STREAM' as const, // initially STREAM until downloaded to local storage
        downloadStatus: 'IDLE' as const,
        downloadProgress: 0,
        isFavorite: Boolean(t.isFavorite),
        playCount: Number(t.playCount || 0),
        lastPlayedAt: t.lastPlayedAt ? new Date(t.lastPlayedAt).getTime() : undefined,
        addedAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
        fileName: t.fileName || `${t.id}.mp3`,
        year: t.year || undefined,
        lyrics: t.lyrics || undefined,
        tripId: t.tripId || undefined,
        syncedToCloud: true,
      }));

      const mappedPlaylists: MusicPlaylist[] = (data.playlists || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || undefined,
        coverUrl: p.coverUrl || undefined,
        trackIds: p.trackIds || [],
        isSmart: Boolean(p.isSmart),
        smartType: p.smartType || undefined,
        tripId: p.tripId || undefined,
        createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : Date.now(),
      }));

      return { tracks: mappedTracks, playlists: mappedPlaylists };
    }
    return { tracks: [], playlists: [] };
  } catch (err) {
    console.warn('Failed to fetch from cloud:', err);
    return { tracks: [], playlists: [] };
  }
}

/**
 * Downloads a track from the online database URL into local IndexedDB storage
 */
export async function downloadTrackToLocalStorage(
  track: MusicTrack,
  onProgress?: (progress: number) => void
): Promise<MusicTrack> {
  const downloadUrl = track.audioUrl || `/api/music/stream/${track.id}`;

  try {
    if (onProgress) onProgress(10);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);

    if (onProgress) onProgress(60);
    const blob = await response.blob();

    track.audioBlob = blob;
    track.source = 'DOWNLOADED';
    track.downloadStatus = 'DOWNLOADED';
    track.downloadProgress = 100;
    track.size = blob.size;
    track.syncedToCloud = true;

    await saveTrack(track);
    if (onProgress) onProgress(100);
    return track;
  } catch (error) {
    track.downloadStatus = 'FAILED';
    await saveTrack(track);
    throw error;
  }
}

/**
 * Syncs / restores all cloud tracks that are not yet stored in local IndexedDB
 */
export async function syncCloudToLocalStorage(
  onTrackRestored?: (track: MusicTrack, index: number, total: number) => void
): Promise<{ added: number; total: number }> {
  const { tracks: cloudTracks, playlists: cloudPlaylists } = await fetchCloudTracks();
  const localTracks = await getAllTracks();
  const localMap = new Map(localTracks.map((t) => [t.id, t]));

  let addedCount = 0;

  for (let i = 0; i < cloudTracks.length; i++) {
    const cloudTrack = cloudTracks[i];
    const existing = localMap.get(cloudTrack.id);

    if (!existing) {
      // Local storage perished or was cleared! Add track metadata so user can stream or download
      await saveTrack(cloudTrack);
      addedCount++;
      if (onTrackRestored) onTrackRestored(cloudTrack, i + 1, cloudTracks.length);
    } else {
      // Keep existing local blob, update cloud audioUrl
      if (!existing.audioUrl && cloudTrack.audioUrl) {
        existing.audioUrl = cloudTrack.audioUrl;
        existing.syncedToCloud = true;
        await saveTrack(existing);
      }
    }
  }

  return { added: addedCount, total: cloudTracks.length };
}

/**
 * Deletes a track from the online database and cloud storage
 */
export async function deleteTrackFromCloud(trackId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/music?id=${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (err) {
    console.warn('Failed to delete track from cloud:', err);
    return false;
  }
}

/**
 * Syncs a playlist to the online database
 */
export async function syncPlaylistToCloud(playlist: MusicPlaylist): Promise<boolean> {
  try {
    const response = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SYNC_PLAYLIST', playlist }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Failed to sync playlist to cloud:', err);
    return false;
  }
}

/**
 * Deletes a playlist from the online database
 */
export async function deletePlaylistFromCloud(playlistId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_PLAYLIST', id: playlistId }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Failed to delete playlist from cloud:', err);
    return false;
  }
}

