import { NextResponse } from 'next/server';
import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

// Lazily initialize the Files SDK so it doesn't crash during build time
// when AWS_* environment variables might not be present.
let filesInstance: Files | null = null;
function getFiles() {
  if (!filesInstance) {
    filesInstance = new Files({ adapter: neon({ bucket: 'images' }) });
  }
  return filesInstance;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate a unique filename to avoid overwrites
    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Neon Object Storage
    await getFiles().upload(uniqueFilename, buffer, {
      contentType: file.type,
    });

    // Generate a URL for the uploaded file
    // Since we set the bucket to public_read, this URL will be accessible
    const fileUrl = await getFiles().url(uniqueFilename);

    return NextResponse.json({ url: fileUrl, filename: uniqueFilename }, { status: 200 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
