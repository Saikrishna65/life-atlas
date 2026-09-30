import { NextResponse } from 'next/server';
import { searchGlobal } from '@/lib/queries/search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  
  const results = await searchGlobal(q);
  return NextResponse.json({ results });
}
