import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilename = searchParams.get('filename') || `track_${Date.now()}.mp3`;
    const contentType = searchParams.get('contentType') || 'audio/mpeg';

    const endpoint = process.env.AWS_ENDPOINT_URL_S3;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-2';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { success: false, error: 'Cloud storage credentials not configured' },
        { status: 503 }
      );
    }

    const s3 = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const command = new PutObjectCommand({
      Bucket: 'music',
      Key: sanitizedFilename,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return NextResponse.json({
      success: true,
      uploadUrl,
      filename: sanitizedFilename,
    });
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate upload URL',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

