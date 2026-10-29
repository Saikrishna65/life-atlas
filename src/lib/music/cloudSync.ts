/**
 * Life Atlas Music Vault - Online Cloud Synchronization Service
 * Manages dual persistence between local IndexedDB and Neon Postgres / Object Storage.
 */

import { MusicTrack, MusicPlaylist } from './types';
import { saveTrack, getTrack, getAllTracks } from './storage';
import { extractAudioDuration } from './metadataParser';
import { canExtractOnDevice, extractAudioOnDevice } from './clientYouTube';

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
    // Use provided blob or track.audioBlob or fetch from IndexedDB
    let blobToUpload = fileBlob || track.audioBlob;
    if (!blobToUpload) {
      const stored = await getTrack(track.id);
      if (stored?.audioBlob) {
        blobToUpload = stored.audioBlob;
      }
    }

    const fileExt = (track.fileName || 'track.mp3').split('.').pop() || 'mp3';
    const sanitizedId = track.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageFilename = `${sanitizedId}.${fileExt}`;
    const contentType = blobToUpload?.type || track.format || 'audio/mpeg';

    let directUploadSucceeded = false;

    // Strategy 1: Direct presigned PUT upload (handles ANY file size > 4.5 MB without Vercel 413 limits)
    if (blobToUpload) {
      try {
        const presignRes = await fetch(
          `/api/music/upload-url?filename=${encodeURIComponent(storageFilename)}&contentType=${encodeURIComponent(contentType)}`
        );
        if (presignRes.ok) {
          const presignData = await presignRes.json();
          if (presignData.success && presignData.uploadUrl) {
            const uploadPutRes = await fetch(presignData.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': contentType },
              body: blobToUpload,
            });
            if (uploadPutRes.ok) {
              directUploadSucceeded = true;
            }
          }
        }
      } catch (presignErr) {
        console.warn('Direct S3 presigned upload failed, falling back:', presignErr);
      }
    }

    const { audioBlob, ...metaToUpload } = track;
    metaToUpload.audioUrl = `/api/music/stream/${encodeURIComponent(track.id)}`;
    metaToUpload.streamUrl = `/api/music/stream/${encodeURIComponent(track.id)}`;
    metaToUpload.fileName = storageFilename;

    if (directUploadSucceeded) {
      // Save metadata JSON to Neon Postgres
      const response = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_METADATA',
          trackId: track.id,
          updates: {
            title: metaToUpload.title,
            artist: metaToUpload.artist,
            album: metaToUpload.album || null,
            genre: metaToUpload.genre || null,
            duration: metaToUpload.duration ? Number(metaToUpload.duration) : 0,
            format: metaToUpload.format || 'audio/mpeg',
            size: blobToUpload ? blobToUpload.size : (metaToUpload.size || 0),
            artworkUrl: metaToUpload.artworkUrl || null,
            audioUrl: metaToUpload.audioUrl,
            fileName: storageFilename,
          },
        }),
      });

      // If track doesn't exist yet in DB, multipart fallback or standard upsert
      if (!response.ok) {
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(metaToUpload));
        await fetch('/api/music', { method: 'POST', body: formData });
      }

      const localTrack = (await getTrack(track.id)) || track;
      localTrack.audioUrl = metaToUpload.audioUrl;
      localTrack.streamUrl = metaToUpload.streamUrl;
      localTrack.syncedToCloud = true;
      await saveTrack(localTrack);
      window.dispatchEvent(new Event('lifeatlas_tracks_updated'));
      return { success: true, audioUrl: metaToUpload.audioUrl };
    }

    // Strategy 2: Multipart form-data upload fallback
    const formData = new FormData();
    if (blobToUpload) {
      formData.append('file', blobToUpload, storageFilename);
    }
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
      const updatedUrl = data.track.audioUrl || `/api/music/stream/${encodeURIComponent(track.id)}`;
      const localTrack = (await getTrack(track.id)) || track;
      localTrack.audioUrl = updatedUrl;
      localTrack.streamUrl = updatedUrl || localTrack.streamUrl;
      localTrack.syncedToCloud = true;
      await saveTrack(localTrack);
      window.dispatchEvent(new Event('lifeatlas_tracks_updated'));
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
  const streamEndpoint = `/api/music/stream/${encodeURIComponent(track.id)}`;
  const primaryUrl =
    track.audioUrl && !track.audioUrl.includes('X-Amz-Expires=')
      ? track.audioUrl
      : streamEndpoint;

  try {
    if (onProgress) onProgress(10);
    let blob: Blob | null = null;

    let response = await fetch(primaryUrl).catch(() => null);
    if ((!response || !response.ok) && primaryUrl !== streamEndpoint) {
      response = await fetch(streamEndpoint).catch(() => null);
    }

    if (response && response.ok) {
      if (onProgress) onProgress(60);
      blob = await response.blob();
    } else {
      // On Android, if a YouTube cloud track has no stored binary yet (404/500),
      // extract it directly on-device from YouTube!
      const ytMatch = track.id.match(/^trk_yt_([a-zA-Z0-9_-]{11})(?:_|$)/);
      if (ytMatch?.[1] && canExtractOnDevice()) {
        const extracted = await extractAudioOnDevice(ytMatch[1], onProgress);
        blob = extracted.blob;
        track.format = extracted.mimeType;
        if (!track.duration && extracted.duration) {
          track.duration = extracted.duration;
        }
        uploadTrackToCloud(track, blob).catch(() => {});
      } else {
        throw new Error(`Download failed with HTTP ${response?.status || 'network error'}`);
      }
    }

    if (!blob || blob.size < 500) {
      throw new Error('Downloaded audio file is empty or invalid');
    }

    if (!track.duration || track.duration === 0) {
      const measuredDuration = await extractAudioDuration(blob).catch(() => 0);
      if (measuredDuration > 0) {
        track.duration = measuredDuration;
      }
    }

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

