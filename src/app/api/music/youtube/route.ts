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

    // 1. Fetch metadata
    const metadata = await fetchYouTubeMetadata(videoId);
    const finalTitle = customTitle?.trim() || metadata.title;
    const finalArtist = customArtist?.trim() || metadata.artist;

    // 2. Extract audio stream
    const audioResult = await extractAudioFromYouTube(videoId);

    // 3. Upload audio buffer to Neon Object Storage
    const trackId = `trk_yt_${videoId}_${Date.now()}`;
    const filename = `${trackId}.mp3`;

    let audioUrl: string | null = null;
    try {
      await getMusicFiles().upload(filename, audioResult.buffer, {
        contentType: audioResult.format || 'audio/mpeg',
      });
      audioUrl = await getMusicFiles().url(filename);
    } catch (uploadErr) {
      console.warn('Neon storage upload failed, using stream fallback:', uploadErr);
    }

    // 4. Save track to PostgreSQL via Prisma
    const savedTrack = await prisma.musicTrack.create({
      data: {
        id: trackId,
        title: finalTitle,
        artist: finalArtist,
        album: 'YouTube Audio',
        genre: 'YouTube',
        duration: metadata.duration || 0,
        format: audioResult.format || 'audio/mpeg',
        size: audioResult.size || 0,
        artworkUrl: metadata.thumbnailUrl,
        audioUrl: audioUrl || `/api/music/stream/${trackId}`,
        fileName: filename,
        source: 'IMPORTED',
        isFavorite: false,
        playCount: 0,
      },
    });

    // 5. Link to requested playlist
    let targetPlaylist = null;

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

    return NextResponse.json({
      success: true,
      track: savedTrack,
      playlist: targetPlaylist,
      audioUrl,
    });
  } catch (error) {
    console.error('Error extracting and saving YouTube audio:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to extract audio from YouTube',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

