import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMusicFiles } from '@/lib/music/cloudFiles';

export async function GET() {
  try {
    const rawTracks = await prisma.musicTrack.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const tracks = rawTracks.map((t) => ({
      ...t,
      // Always serve a permanent stream URL instead of 1-hour expiring S3 presigned URLs
      audioUrl:
        t.audioUrl && t.audioUrl.includes('X-Amz-Expires=')
          ? `/api/music/stream/${encodeURIComponent(t.id)}`
          : t.audioUrl || `/api/music/stream/${encodeURIComponent(t.id)}`,
    }));
    const playlists = await prisma.musicPlaylist.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      tracks,
      playlists,
    });
  } catch (error) {
    console.error('Error fetching online music:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tracks from online database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const metadataStr = formData.get('metadata') as string | null;

      if (!metadataStr) {
        return NextResponse.json({ success: false, error: 'Metadata is required' }, { status: 400 });
      }

      const meta = JSON.parse(metadataStr);
      let audioUrl = meta.audioUrl || meta.streamUrl || null;
      let storedFileName: string | null = meta.fileName || (file ? file.name : null);

      if (file) {
        // Upload audio file buffer to Neon Object Storage
        const fileExt =
          (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
        const sanitizedTrackId = (meta.id || `trk_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${sanitizedTrackId}.${fileExt}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        await getMusicFiles().upload(filename, buffer, {
          contentType: file.type || 'audio/mpeg',
        });

        storedFileName = filename;
        audioUrl = `/api/music/stream/${encodeURIComponent(meta.id || sanitizedTrackId)}`;
      }

      // Upsert into Prisma Postgres MusicTrack
      const savedTrack = await prisma.musicTrack.upsert({
        where: { id: meta.id },
        update: {
          title: meta.title,
          artist: meta.artist,
          album: meta.album || null,
          genre: meta.genre || null,
          duration: meta.duration ? Number(meta.duration) : 0,
          format: meta.format || 'audio/mpeg',
          size: meta.size ? Number(meta.size) : (file ? file.size : 0),
          bitrate: meta.bitrate ? Number(meta.bitrate) : null,
          artworkUrl: meta.artworkUrl || null,
          audioUrl: audioUrl || null,
          fileName: storedFileName,
          year: meta.year || null,
          lyrics: meta.lyrics || null,
          source: 'IMPORTED',
          isFavorite: Boolean(meta.isFavorite),
          playCount: Number(meta.playCount || 0),
          tripId: meta.tripId || null,
        },
        create: {
          id: meta.id,
          title: meta.title,
          artist: meta.artist,
          album: meta.album || null,
          genre: meta.genre || null,
          duration: meta.duration ? Number(meta.duration) : 0,
          format: meta.format || 'audio/mpeg',
          size: meta.size ? Number(meta.size) : (file ? file.size : 0),
          bitrate: meta.bitrate ? Number(meta.bitrate) : null,
          artworkUrl: meta.artworkUrl || null,
          audioUrl: audioUrl || null,
          fileName: storedFileName,
          year: meta.year || null,
          lyrics: meta.lyrics || null,
          source: 'IMPORTED',
          isFavorite: Boolean(meta.isFavorite),
          playCount: Number(meta.playCount || 0),
          tripId: meta.tripId || null,
        },
      });

      return NextResponse.json({ success: true, track: savedTrack });
    } else {
      // JSON body for metadata update or syncing
      const body = await request.json();

      if (body.action === 'SYNC_PLAYLIST') {
        const { playlist } = body;
        const saved = await prisma.musicPlaylist.upsert({
          where: { id: playlist.id },
          update: {
            title: playlist.title,
            description: playlist.description || null,
            coverUrl: playlist.coverUrl || null,
            trackIds: playlist.trackIds || [],
            isSmart: Boolean(playlist.isSmart),
            smartType: playlist.smartType || null,
            tripId: playlist.tripId || null,
          },
          create: {
            id: playlist.id,
            title: playlist.title,
            description: playlist.description || null,
            coverUrl: playlist.coverUrl || null,
            trackIds: playlist.trackIds || [],
            isSmart: Boolean(playlist.isSmart),
            smartType: playlist.smartType || null,
            tripId: playlist.tripId || null,
          },
        });
        return NextResponse.json({ success: true, playlist: saved });
      }

      if (body.action === 'DELETE_PLAYLIST') {
        const { id } = body;
        await prisma.musicPlaylist.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true });
      }

      if (body.action === 'UPDATE_METADATA') {
        const { trackId, updates } = body;
        const updated = await prisma.musicTrack.update({
          where: { id: trackId },
          data: updates,
        });
        return NextResponse.json({ success: true, track: updated });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error saving track to online database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process track in online database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing track ID' }, { status: 400 });
    }

    const track = await prisma.musicTrack.findUnique({ where: { id } });
    if (track) {
      await prisma.musicTrack.delete({ where: { id } });

      // Clean up audio file from Neon storage asynchronously in background (never block response!)
      try {
        const fileExt = (track.fileName || 'track.mp3').split('.').pop() || 'mp3';
        const filename = `${id}.${fileExt}`;
        getMusicFiles().delete(filename).catch((err) => {
          console.warn('Async cloud file delete error:', err);
        });
      } catch {
        // File deletion is best-effort
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting track from online database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete track from online database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

