import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMusicFiles } from '@/lib/music/cloudFiles';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing track id' }, { status: 400 });
    }

    const track = await prisma.musicTrack.findUnique({
      where: { id },
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // If direct audioUrl exists, redirect directly
    if (track.audioUrl) {
      return NextResponse.redirect(track.audioUrl, { status: 302 });
    }

    // Or attempt download via files-sdk
    const fileExt = (track.fileName || 'track.mp3').split('.').pop() || 'mp3';
    const filename = `${id}.${fileExt}`;
    const fileData = await getMusicFiles().download(filename);
    const arrayBuffer = await fileData.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': track.format || 'audio/mpeg',
        'Content-Disposition': `inline; filename="${track.fileName || `${id}.mp3`}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error streaming track:', error);
    return NextResponse.json(
      { error: 'Failed to stream audio track' },
      { status: 500 }
    );
  }
}

