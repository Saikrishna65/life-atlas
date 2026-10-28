import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMusicFiles } from '@/lib/music/cloudFiles';
import {
  extractYouTubeVideoId,
  fetchYouTubeMetadata,
  extractAudioFromYouTube,
} from '@/lib/music/youtubeExtractor';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url') || '';
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported YouTube link.' },
        { status: 400 }
      );
    }

    const metadata = await fetchYouTubeMetadata(videoId);
    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    console.error('Error fetching YouTube preview:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to preview YouTube video',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, playlistId, newPlaylistTitle, customTitle, customArtist } = body;

    const videoId = extractYouTubeVideoId(url || '');
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Valid YouTube URL or video ID is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch metadata and extract audio stream
    const [metadata, audioResult] = await Promise.all([
      fetchYouTubeMetadata(videoId),
      extractAudioFromYouTube(videoId),
    ]);

    const finalTitle = customTitle?.trim() || metadata.title;
    const finalArtist = customArtist?.trim() || metadata.artist;
    const finalDuration = audioResult.duration || metadata.duration || 0;
    const mimeType = audioResult.format || 'audio/mp4';
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('webm') ? 'webm' : 'mp3';

    // 2. Upload audio buffer to Neon Object Storage (optional cloud backup)
    const trackId = `trk_yt_${videoId}_${Date.now()}`;
    const filename = `${trackId}.${ext}`;

    let audioUrl: string | null = null;
    try {
      await getMusicFiles().upload(filename, audioResult.buffer, {
        contentType: mimeType,
      });
      audioUrl = await getMusicFiles().url(filename);
    } catch (uploadErr) {
      console.warn('Neon storage upload skipped, using direct stream endpoint:', uploadErr);
    }

    // 3. Save track to PostgreSQL via Prisma (if DB is reachable)
    let savedTrack = {
      id: trackId,
      title: finalTitle,
      artist: finalArtist,
      album: 'YouTube Audio',
      genre: 'YouTube',
      duration: finalDuration,
      format: mimeType,
      size: audioResult.size || audioResult.buffer.length,
      artworkUrl: metadata.thumbnailUrl,
      audioUrl: audioUrl || `/api/music/stream/${trackId}`,
      fileName: filename,
      source: 'DOWNLOADED',
      isFavorite: false,
      playCount: 0,
    };

    let targetPlaylist = null;

    try {
      const dbTrack = await prisma.musicTrack.create({
        data: savedTrack,
      });
      savedTrack = {
        ...savedTrack,
        ...dbTrack,
        album: dbTrack.album || 'YouTube Audio',
        genre: dbTrack.genre || 'YouTube',
        artworkUrl: dbTrack.artworkUrl || metadata.thumbnailUrl,
        audioUrl: dbTrack.audioUrl || `/api/music/stream/${trackId}`,
        fileName: dbTrack.fileName || filename,
        format: dbTrack.format || mimeType,
      };

      // 4. Link to requested playlist in DB
      if (newPlaylistTitle && newPlaylistTitle.trim()) {
        targetPlaylist = await prisma.musicPlaylist.create({
          data: {
            id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: newPlaylistTitle.trim(),
            description: `Created from YouTube: ${finalTitle}`,
            trackIds: [savedTrack.id],
          },
        });
      } else if (playlistId && playlistId.trim()) {
        const existing = await prisma.musicPlaylist.findUnique({
          where: { id: playlistId.trim() },
        });
        if (existing) {
          const updatedTrackIds = existing.trackIds.includes(savedTrack.id)
            ? existing.trackIds
            : [...existing.trackIds, savedTrack.id];

          targetPlaylist = await prisma.musicPlaylist.update({
            where: { id: playlistId.trim() },
            data: { trackIds: updatedTrackIds },
          });
        }
      }
    } catch (dbErr) {
      console.warn('PostgreSQL save skipped or offline, returning extracted track directly:', dbErr);
    }

    // Return the extracted audio bytes directly as Base64 so the client immediately
    // stores the full binary Blob in IndexedDB with zero data loss!
    return NextResponse.json({
      success: true,
      track: savedTrack,
      playlist: targetPlaylist,
      audioUrl: savedTrack.audioUrl,
      audioBase64: audioResult.buffer.toString('base64'),
      mimeType,
      size: audioResult.size,
      duration: finalDuration,
    });
  } catch (error) {
    console.error('Error extracting and saving YouTube audio:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract audio from YouTube',
      },
      { status: 500 }
    );
  }
}
