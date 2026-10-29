/**
 * Imports audio files picked from the device into the Music Vault.
 * Bytes are copied into memory first so Android content:// handles can't expire.
 */
import { parseAudioFile } from "./metadataParser";
import { saveTrack, getAllTracks } from "./storage";
import { uploadTrackToCloud } from "./cloudSync";
import { MusicTrack } from "./types";

export interface ImportSummary {
  imported: number;
  duplicates: number;
  failed: string[];
}

export async function importAudioFiles(
  files: File[],
  onProgress?: (done: number, total: number, name: string) => void
): Promise<ImportSummary> {
  const existing = await getAllTracks();
  const summary: ImportSummary = { imported: 0, duplicates: 0, failed: [] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    try {
      const buffer = await file.arrayBuffer();
      const mimeType = file.type || "audio/mpeg";
      const blob = new Blob([buffer], { type: mimeType });
      const parsed = await parseAudioFile(file);

      const isDuplicate = existing.some(
        (t) =>
          (t.title.toLowerCase() === parsed.title.toLowerCase() &&
            t.artist.toLowerCase() === parsed.artist.toLowerCase()) ||
          (t.fileName === file.name && t.size === blob.size)
      );
      if (isDuplicate) {
        summary.duplicates++;
        continue;
      }

      const track: MusicTrack = {
        id: `trk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album,
        genre: parsed.genre,
        year: parsed.year,
        duration: parsed.duration || 0,
        format: mimeType,
        size: blob.size,
        artworkUrl: parsed.artworkUrl,
        audioBlob: blob,
        source: "IMPORTED",
        isFavorite: false,
        playCount: 0,
        addedAt: Date.now(),
        fileName: file.name,
      };
      await saveTrack(track);
      existing.push(track);
      summary.imported++;

      // Best-effort cloud backup; never blocks or fails the import.
      uploadTrackToCloud(track, blob).catch(() => {});
    } catch (e) {
      summary.failed.push(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  onProgress?.(files.length, files.length, "");
  return summary;
}

