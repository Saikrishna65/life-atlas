/**
 * Life Atlas: Music Vault IndexedDB Storage Engine (Phase 16)
 * Dedicated database: life_atlas_music_db
 * Completely isolated from life_atlas_trip_vault_db to guarantee zero data interference.
 */

import { MusicTrack, MusicPlaylist, MusicStorageReport, SmartPlaylistType } from "./types";
import { SAMPLE_DEFAULT_TRACK_TITLES } from "./samples";

export const MUSIC_DB_NAME = "life_atlas_music_db";
export const MUSIC_DB_VERSION = 1;

let cachedDB: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens or retrieves the cached Music Vault IndexedDB instance
 */
export async function getMusicDB(): Promise<IDBDatabase> {
  if (cachedDB) return cachedDB;
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported or available in this environment."));
      return;
    }

    const request = indexedDB.open(MUSIC_DB_NAME, MUSIC_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Tracks Store
      if (!db.objectStoreNames.contains("tracks")) {
        const tracksStore = db.createObjectStore("tracks", { keyPath: "id" });
        tracksStore.createIndex("artist", "artist", { unique: false });
        tracksStore.createIndex("album", "album", { unique: false });
        tracksStore.createIndex("isFavorite", "isFavorite", { unique: false });
        tracksStore.createIndex("source", "source", { unique: false });
        tracksStore.createIndex("addedAt", "addedAt", { unique: false });
        tracksStore.createIndex("playCount", "playCount", { unique: false });
        tracksStore.createIndex("tripId", "tripId", { unique: false });
      }

      // 2. Playlists Store
      if (!db.objectStoreNames.contains("playlists")) {
        const playlistsStore = db.createObjectStore("playlists", { keyPath: "id" });
        playlistsStore.createIndex("title", "title", { unique: false });
        playlistsStore.createIndex("tripId", "tripId", { unique: false });
        playlistsStore.createIndex("isSmart", "isSmart", { unique: false });
      }

      // 3. Play History Store
      if (!db.objectStoreNames.contains("history")) {
        const historyStore = db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
        historyStore.createIndex("trackId", "trackId", { unique: false });
        historyStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // 4. Settings Store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      cachedDB = (event.target as IDBOpenDBRequest).result;
      cachedDB.onclose = () => {
        cachedDB = null;
        dbOpenPromise = null;
      };
      resolve(cachedDB);
    };

    request.onerror = (event) => {
      dbOpenPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbOpenPromise;
}

export function closeMusicDB() {
  if (cachedDB) {
    cachedDB.close();
    cachedDB = null;
  }
  dbOpenPromise = null;
}

export async function deleteMusicDB(): Promise<void> {
  closeMusicDB();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(MUSIC_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Completely scrubs any default nature/adventure sample songs from IndexedDB
 */
export async function purgeDefaultSampleTracks(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  try {
    const db = await getMusicDB();
    return new Promise((resolve) => {
      const tx = db.transaction(["tracks", "playlists"], "readwrite");
      const trackStore = tx.objectStore("tracks");
      const playlistStore = tx.objectStore("playlists");
      const req = trackStore.getAll();

      req.onsuccess = () => {
        const tracks = (req.result || []) as MusicTrack[];
        const sampleIds = new Set<string>();

        for (const t of tracks) {
          const isSample =
            SAMPLE_DEFAULT_TRACK_TITLES.includes(t.title) ||
            (t.streamUrl && t.streamUrl.includes("soundhelix.com")) ||
            (t.artist &&
              (t.artist.includes("Himalayan Wind") ||
                t.artist.includes("Kasol Acoustic") ||
                t.artist.includes("Thar Dune") ||
                t.artist.includes("Ladakh Monastic")));

          if (isSample) {
            sampleIds.add(t.id);
            trackStore.delete(t.id);
          }
        }

        if (sampleIds.size > 0) {
          const plReq = playlistStore.getAll();
          plReq.onsuccess = () => {
            const playlists = (plReq.result || []) as MusicPlaylist[];
            for (const pl of playlists) {
              const filtered = pl.trackIds.filter((id) => !sampleIds.has(id));
              if (filtered.length !== pl.trackIds.length) {
                pl.trackIds = filtered;
                pl.updatedAt = Date.now();
                playlistStore.put(pl);
              }
            }
          };
        }
      };

      tx.oncomplete = () => resolve(1);
      tx.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// =============================================================================
// TRACK OPERATIONS
// =============================================================================

export async function saveTrack(track: MusicTrack): Promise<MusicTrack> {
  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readwrite");
    const store = tx.objectStore("tracks");
    const req = store.put(track);

    req.onsuccess = () => resolve(track);
    req.onerror = () => reject(req.error);
  });
}

export async function getTrack(id: string): Promise<MusicTrack | null> {
  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readonly");
    const store = tx.objectStore("tracks");
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllTracks(): Promise<MusicTrack[]> {
  // Always ensure default sample songs are purged
  await purgeDefaultSampleTracks().catch(() => {});

  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readonly");
    const store = tx.objectStore("tracks");
    const req = store.getAll();

    req.onsuccess = () => {
      let tracks = (req.result || []) as MusicTrack[];
      // Extra safety filter against default sample tracks
      tracks = tracks.filter(
        (t) =>
          !SAMPLE_DEFAULT_TRACK_TITLES.includes(t.title) &&
          !(t.streamUrl && t.streamUrl.includes("soundhelix.com")) &&
          !(t.artist &&
            (t.artist.includes("Himalayan Wind") ||
              t.artist.includes("Kasol Acoustic") ||
              t.artist.includes("Thar Dune") ||
              t.artist.includes("Ladakh Monastic")))
      );
      // Sort newest first by default
      tracks.sort((a, b) => b.addedAt - a.addedAt);
      resolve(tracks);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTrack(id: string, deleteOnline: boolean = true): Promise<void> {
  const db = await getMusicDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["tracks", "playlists"], "readwrite");
    const trackStore = tx.objectStore("tracks");
    const playlistStore = tx.objectStore("playlists");

    // Remove track
    trackStore.delete(id);

    // Also remove trackId from any playlists that contain it
    const playlistReq = playlistStore.getAll();
    playlistReq.onsuccess = () => {
      const playlists = (playlistReq.result || []) as MusicPlaylist[];
      for (const pl of playlists) {
        if (pl.trackIds.includes(id)) {
          pl.trackIds = pl.trackIds.filter((tId) => tId !== id);
          pl.updatedAt = Date.now();
          playlistStore.put(pl);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (deleteOnline && typeof window !== "undefined") {
    import("./cloudSync")
      .then(({ deleteTrackFromCloud }) => {
        deleteTrackFromCloud(id).catch(() => {});
      })
      .catch(() => {});
  }
}

export async function toggleFavoriteTrack(id: string): Promise<boolean> {
  const track = await getTrack(id);
  if (!track) throw new Error(`Track with ID ${id} not found.`);

  track.isFavorite = !track.isFavorite;
  await saveTrack(track);

  // Sync favorite update to online database
  if (typeof window !== "undefined") {
    fetch("/api/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_METADATA",
        trackId: id,
        updates: { isFavorite: track.isFavorite },
      }),
    }).catch(() => {});
  }

  return track.isFavorite;
}

export async function incrementPlayCount(id: string): Promise<void> {
  const track = await getTrack(id);
  if (!track) return;

  track.playCount = (track.playCount || 0) + 1;
  track.lastPlayedAt = Date.now();
  await saveTrack(track);

  // Record in history
  const db = await getMusicDB();
  const tx = db.transaction("history", "readwrite");
  tx.objectStore("history").add({
    trackId: id,
    timestamp: Date.now(),
    durationPlayed: track.duration,
  });

  // Sync playcount to online database
  if (typeof window !== "undefined") {
    fetch("/api/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_METADATA",
        trackId: id,
        updates: {
          playCount: track.playCount,
          lastPlayedAt: new Date(track.lastPlayedAt).toISOString(),
        },
      }),
    }).catch(() => {});
  }
}

export async function updateTrackMetadata(
  id: string,
  updates: Partial<Pick<MusicTrack, "title" | "artist" | "album" | "genre" | "year" | "lyrics">>
): Promise<MusicTrack> {
  const track = await getTrack(id);
  if (!track) throw new Error(`Track with ID ${id} not found.`);

  Object.assign(track, updates);
  await saveTrack(track);

  if (typeof window !== "undefined") {
    fetch("/api/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_METADATA",
        trackId: id,
        updates,
      }),
    }).catch(() => {});
  }

  return track;
}

// =============================================================================
// PLAYLIST OPERATIONS
// =============================================================================

export async function savePlaylist(playlist: MusicPlaylist, syncOnline: boolean = true): Promise<MusicPlaylist> {
  const db = await getMusicDB();
  await new Promise<MusicPlaylist>((resolve, reject) => {
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
    const req = store.put(playlist);

    req.onsuccess = () => resolve(playlist);
    req.onerror = () => reject(req.error);
  });

  if (syncOnline && typeof window !== "undefined") {
    import("./cloudSync")
      .then(({ syncPlaylistToCloud }) => {
        syncPlaylistToCloud(playlist).catch(() => {});
      })
      .catch(() => {});
  }

  return playlist;
}

export async function getPlaylist(id: string): Promise<MusicPlaylist | null> {
  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPlaylists(): Promise<MusicPlaylist[]> {
  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");
    const req = store.getAll();

    req.onsuccess = () => {
      const list = (req.result || []) as MusicPlaylist[];
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a playlist. CRITICAL: Never deletes underlying audio files!
 */
export async function deletePlaylist(id: string, deleteOnline: boolean = true): Promise<void> {
  const db = await getMusicDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("playlists", "readwrite");
    const store = tx.objectStore("playlists");
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (deleteOnline && typeof window !== "undefined") {
    import("./cloudSync")
      .then(({ deletePlaylistFromCloud }) => {
        deletePlaylistFromCloud(id).catch(() => {});
      })
      .catch(() => {});
  }
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<MusicPlaylist> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);

  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId);
    playlist.updatedAt = Date.now();
    await savePlaylist(playlist);
  }
  return playlist;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<MusicPlaylist> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);

  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  return playlist;
}

export async function reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<MusicPlaylist> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);

  playlist.trackIds = trackIds;
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  return playlist;
}

// =============================================================================
// SMART PLAYLISTS RESOLVER
// =============================================================================

export async function getSmartPlaylistTracks(type: SmartPlaylistType): Promise<MusicTrack[]> {
  const all = await getAllTracks();

  switch (type) {
    case "FAVORITES":
      return all.filter((t) => t.isFavorite);
    case "RECENTLY_PLAYED":
      return all
        .filter((t) => typeof t.lastPlayedAt === "number" && t.lastPlayedAt > 0)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
    case "MOST_PLAYED":
      return all
        .filter((t) => (t.playCount || 0) > 0)
        .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    case "OFFLINE":
      return all.filter((t) => t.source === "IMPORTED" || t.source === "DOWNLOADED" || !!t.audioBlob);
    default:
      return [];
  }
}

// =============================================================================
// TRIP VAULT EXPEDITION LINKING
// =============================================================================

export async function getPlaylistsForTrip(tripId: string): Promise<MusicPlaylist[]> {
  const db = await getMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");
    const index = store.index("tripId");
    const req = index.getAll(tripId);

    req.onsuccess = () => resolve((req.result || []) as MusicPlaylist[]);
    req.onerror = () => reject(req.error);
  });
}

export async function linkPlaylistToTrip(playlistId: string, tripId: string): Promise<MusicPlaylist> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);

  playlist.tripId = tripId;
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  return playlist;
}

export async function unlinkPlaylistFromTrip(playlistId: string): Promise<MusicPlaylist> {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);

  delete playlist.tripId;
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  return playlist;
}

// =============================================================================
// STORAGE & USAGE REPORTING
// =============================================================================

export async function getStorageReport(): Promise<MusicStorageReport> {
  const tracks = await getAllTracks();

  let importedCount = 0;
  let downloadedCount = 0;
  let streamCount = 0;
  let totalBytes = 0;

  for (const t of tracks) {
    if (t.source === "IMPORTED") importedCount++;
    else if (t.source === "DOWNLOADED") downloadedCount++;
    else streamCount++;

    const byteSize = t.audioBlob?.size || t.size || 0;
    if (byteSize > 0) {
      totalBytes += byteSize;
    }
  }

  let formattedSize = "0 MB";
  if (totalBytes > 1024 * 1024 * 1024) {
    formattedSize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (totalBytes > 0 && totalBytes < 100 * 1024) {
    formattedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else {
    formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  let quotaBytes: number | undefined;
  let quotaUsedPercentage: number | undefined;

  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaBytes = est.quota;
      if (est.quota && est.usage) {
        quotaUsedPercentage = Math.round((est.usage / est.quota) * 100);
      }
    } catch {
      // Ignore quota estimate errors
    }
  }

  return {
    totalTracks: tracks.length,
    importedTracks: importedCount,
    downloadedTracks: downloadedCount,
    streamTracks: streamCount,
    totalBytes,
    formattedSize,
    quotaBytes,
    quotaUsedPercentage,
  };
}

// =============================================================================
// EXPORT & IMPORT (M3U & JSON)
// =============================================================================

export function exportPlaylistM3U(playlist: MusicPlaylist, tracks: MusicTrack[]): string {
  let m3u = `#EXTM3U\n#PLAYLIST:${playlist.title}\n`;
  for (const t of tracks) {
    m3u += `#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}\n`;
    m3u += `${t.fileName || t.title}.mp3\n`;
  }
  return m3u;
}

export async function exportLibraryJSON(): Promise<string> {
  const tracks = await getAllTracks();
  const playlists = await getAllPlaylists();

  // Export tracks metadata without heavy audioBlobs for clean portable JSON backup
  const portableTracks = tracks.map(({ audioBlob, ...meta }) => meta);

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      tracks: portableTracks,
      playlists,
    },
    null,
    2
  );
}
