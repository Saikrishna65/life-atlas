import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMusicFiles } from '@/lib/music/cloudFiles';
import { extractAudioFromYouTube } from '@/lib/music/youtubeExtractor';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing track id' }, { status: 400 });
    }

    const track = await prisma.musicTrack
      .findUnique({
        where: { id },
      })
      .catch(() => null);

    // 1. Only redirect if track.audioUrl is an external absolute HTTP(S) URL
    if (
      track?.audioUrl &&
      (track.audioUrl.startsWith('http://') || track.audioUrl.startsWith('https://'))
    ) {
      return NextResponse.redirect(track.audioUrl, { status: 302 });
    }

    // 2. Attempt download via Neon Object Storage (files-sdk)
    try {
      const fileExt = (track?.fileName || 'track.mp3').split('.').pop() || 'mp3';
      const filename = track?.fileName || `${id}.${fileExt}`;
      const fileData = await getMusicFiles().download(filename);
      const arrayBuffer = await fileData.arrayBuffer();

      return new Response(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': track?.format || 'audio/mpeg',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // Fall through to on-demand YouTube stream extraction if applicable
    }

    // 3. If this is a YouTube track (id pattern: trk_yt_<11-char-videoId>_<timestamp>),
    // extract and stream the real YouTube audio on-demand!
    const ytMatch = id.match(/^trk_yt_([a-zA-Z0-9_-]{11})(?:_|$)/);
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      const extracted = await extractAudioFromYouTube(videoId);

      // Update duration/size in DB if previously saved as 0
      if (track && (!track.duration || track.duration === 0 || !track.size)) {
        prisma.musicTrack
          .update({
            where: { id },
            data: {
              duration: extracted.duration || track.duration || 0,
              size: extracted.size || track.size || 0,
              format: extracted.format || track.format || 'audio/mp4',
            },
          })
          .catch(() => {});
      }

      return new Response(new Uint8Array(extracted.buffer), {
        status: 200,
        headers: {
          'Content-Type': extracted.format || 'audio/mp4',
          'Content-Length': String(extracted.size),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json({ error: 'Audio stream not found' }, { status: 404 });
  } catch (error) {
    console.error('Error streaming track:', error);
    return NextResponse.json(
      { error: 'Failed to stream audio track' },
      { status: 500 }
    );
  }
}
