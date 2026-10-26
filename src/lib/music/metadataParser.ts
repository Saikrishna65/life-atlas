/**
 * Lightweight, zero-dependency ID3v2 & Audio Metadata Parser
 * Extracts Title, Artist, Album, Year, Genre, and embedded APIC Album Artwork.
 */

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year?: string;
  artworkUrl?: string;
  duration?: number;
}

/**
 * Decodes string from ArrayBuffer slice using the given ID3 encoding byte.
 * 0: ISO-8859-1 (Latin1)
 * 1: UTF-16 with BOM
 * 2: UTF-16BE
 * 3: UTF-8
 */
function decodeText(bytes: Uint8Array, encodingByte: number): string {
  try {
    let decoder: TextDecoder;
    if (encodingByte === 1) {
      decoder = new TextDecoder('utf-16');
    } else if (encodingByte === 2) {
      decoder = new TextDecoder('utf-16be');
    } else if (encodingByte === 3) {
      decoder = new TextDecoder('utf-8');
    } else {
      decoder = new TextDecoder('iso-8859-1');
    }
    const str = decoder.decode(bytes);
    // Strip trailing null characters
    return str.replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

/**
 * Parses ID3v2 header and frames from an ArrayBuffer
 */
export function parseID3Tags(buffer: ArrayBuffer): Partial<ParsedAudioMetadata> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return {};

  // Check magic "ID3"
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const majorVersion = bytes[3]; // 2, 3, or 4
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const maxOffset = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  const result: Partial<ParsedAudioMetadata> = {};

  while (offset + 10 < maxOffset) {
    // Check for padding (null bytes)
    if (bytes[offset] === 0) break;

    // Read 4-character frame ID
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );

    // Frame size
    let frameSize = 0;
    if (majorVersion === 4) {
      // Synchsafe integer in ID3v2.4
      frameSize =
        ((bytes[offset + 4] & 0x7f) << 21) |
        ((bytes[offset + 5] & 0x7f) << 14) |
        ((bytes[offset + 6] & 0x7f) << 7) |
        (bytes[offset + 7] & 0x7f);
    } else {
      // Standard 32-bit big-endian in ID3v2.3
      frameSize =
        (bytes[offset + 4] << 24) |
        (bytes[offset + 5] << 16) |
        (bytes[offset + 6] << 8) |
        bytes[offset + 7];
    }

    if (frameSize <= 0 || offset + 10 + frameSize > maxOffset) {
      break;
    }

    const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);
    offset += 10 + frameSize;

    if (frameData.length === 0) continue;

    const encoding = frameData[0];
    const content = frameData.subarray(1);

    switch (frameId) {
      case 'TIT2': // Title
      case 'TT2':
        result.title = decodeText(content, encoding);
        break;
      case 'TPE1': // Artist
      case 'TP1':
        result.artist = decodeText(content, encoding);
        break;
      case 'TALB': // Album
      case 'TAL':
        result.album = decodeText(content, encoding);
        break;
      case 'TCON': // Genre
      case 'TCO':
        result.genre = decodeText(content, encoding);
        break;
      case 'TYER': // Year
      case 'TDRC':
        result.year = decodeText(content, encoding);
        break;
      case 'APIC': // Attached Picture (Cover Art)
        try {
          // Parse MIME type
          let mimeEnd = 0;
          while (mimeEnd < content.length && content[mimeEnd] !== 0) {
            mimeEnd++;
          }
          const mimeType =
            new TextDecoder('iso-8859-1').decode(content.subarray(0, mimeEnd)) ||
            'image/jpeg';

          // Skip null terminator and picture type byte
          let picDataStart = mimeEnd + 2;
          // Skip description string
          if (encoding === 1 || encoding === 2) {
            // 2-byte null terminator
            while (
              picDataStart + 1 < content.length &&
              !(content[picDataStart] === 0 && content[picDataStart + 1] === 0)
            ) {
              picDataStart += 2;
            }
            picDataStart += 2;
          } else {
            // 1-byte null terminator
            while (picDataStart < content.length && content[picDataStart] !== 0) {
              picDataStart++;
            }
            picDataStart += 1;
          }

          if (picDataStart < content.length) {
            const imgBytes = content.subarray(picDataStart);
            if (typeof Buffer !== 'undefined') {
              const base64 = Buffer.from(imgBytes).toString('base64');
              result.artworkUrl = `data:${mimeType};base64,${base64}`;
            } else if (typeof btoa !== 'undefined') {
              let binary = '';
              const len = imgBytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(imgBytes[i]);
              }
              const base64 = btoa(binary);
              result.artworkUrl = `data:${mimeType};base64,${base64}`;
            }
          }
        } catch {
          // Ignore image extraction errors
        }
        break;
    }
  }

  return result;
}

/**
 * Fallback parser from audio file name (e.g., "Artist - Song.mp3" or "01 Song.mp3")
 */
export function parseFileNameMetadata(fileName: string): { title: string; artist: string } {
  // Strip extension
  const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // Pattern: "Artist - Title"
  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    const artist = parts[0].trim();
    const title = parts.slice(1).join(' - ').trim();
    return {
      artist: artist || 'Unknown Artist',
      title: title || cleanName,
    };
  }

  // Pattern: "01. Title" or "01 - Title" or "01 Title"
  const strippedNumber = cleanName.replace(/^\d+[\s.-]+/, '').trim();

  return {
    title: strippedNumber || cleanName,
    artist: 'Unknown Artist',
  };
}

/**
 * Determines audio duration using HTML5 Audio if in browser
 */
export async function extractAudioDuration(blobOrUrl: Blob | string): Promise<number> {
  if (typeof window === 'undefined') return 0;

  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
      
      const cleanup = () => {
        if (typeof blobOrUrl !== 'string') {
          URL.revokeObjectURL(url);
        }
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
      };

      const onLoaded = () => {
        const d = audio.duration;
        cleanup();
        resolve(Number.isFinite(d) ? Math.round(d) : 0);
      };

      const onError = () => {
        cleanup();
        resolve(0);
      };

      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
      audio.src = url;

      // Timeout after 3 seconds if metadata doesn't fire
      setTimeout(() => {
        cleanup();
        resolve(0);
      }, 3000);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Full file processing pipeline: extracts metadata from File or Blob
 */
export async function parseAudioFile(file: File | Blob, originalFileName?: string): Promise<ParsedAudioMetadata> {
  const fileName = (file as File).name || originalFileName || 'audio_track.mp3';
  const nameFallback = parseFileNameMetadata(fileName);

  let id3: Partial<ParsedAudioMetadata> = {};
  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer(); // Read first 128KB for ID3 header
    id3 = parseID3Tags(buffer);
  } catch {
    // Fall back to filename
  }

  let duration = 0;
  try {
    duration = await extractAudioDuration(file);
  } catch {
    duration = 0;
  }

  return {
    title: (id3.title && id3.title.trim()) || nameFallback.title,
    artist: (id3.artist && id3.artist.trim()) || nameFallback.artist,
    album: (id3.album && id3.album.trim()) || 'Unknown Album',
    genre: (id3.genre && id3.genre.trim()) || 'Acoustic / Ambient',
    year: id3.year,
    artworkUrl: id3.artworkUrl,
    duration,
  };
}
