/**
 * Imports audio files picked from the device into the Atlas Music.
 * Persist file-backed Blobs in IndexedDB without a second whole-file JavaScript copy.
 */
import { audioMime } from "./formats";
import { equalAudioBytes } from "./originals";
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
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ImportSummary> {
  const existing = await getAllTracks();
  const summary: ImportSummary = { imported: 0, duplicates: 0, failed: [] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    try {
      const mimeType = audioMime(file);
      if (!mimeType)
        throw new Error(
          "Not a recognised audio format. Choose an audio file, not a playlist or document.",
        );
      const blob = file.slice(0, file.size, mimeType);
      const parsed = await parseAudioFile(file);

      // Names/tags aren't identities: lossless editions and different recordings can share them.
      let isDuplicate = false;
      for (const candidate of existing) {
        if (
          candidate.audioBlob?.size === blob.size &&
          (await equalAudioBytes(candidate.audioBlob, blob))
        ) {
          isDuplicate = true;
          break;
        }
      }
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
      summary.failed.push(
        `${file.name}: ${e instanceof Error ? e.message : "failed"}`,
      );
    }
  }
  onProgress?.(files.length, files.length, "");
  return summary;
}
