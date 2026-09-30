import prisma from '../prisma';

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  url: string;
  excerpt?: string;
  image?: string | null;
  date?: Date | null;
  location?: string | null;
}

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  // Search Trips
  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { destination: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    },
    take: 5
  });
  for (const t of trips) {
    results.push({
      id: t.id, title: t.title, type: 'Trip', url: `/trips/${t.slug}`,
      excerpt: t.description ? t.description.substring(0, 100) : undefined,
      image: t.coverImage, date: t.startDate, location: t.destination
    });
  }

  // Search Places
  const places = await prisma.place.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ]
    },
    take: 5
  });
  for (const p of places) {
    results.push({
      id: p.id, title: p.name, type: 'Place', url: `/places/${p.slug}`,
      image: p.coverImage, location: `${p.city ? p.city + ', ' : ''}${p.country}`
    });
  }

  // Search Journal
  const journals = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ]
    },
    take: 5
  });
  for (const j of journals) {
    results.push({
      id: j.id, title: j.title, type: 'Journal', url: `/journal/${j.slug}`,
      excerpt: j.content.substring(0, 100) + '...', date: j.date
    });
  }

  // Search Experiences
  const experiences = await prisma.experience.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    },
    take: 5
  });
  for (const e of experiences) {
    results.push({
      id: e.id, title: e.title, type: e.type, url: e.type === 'FOOD' ? '/food' : e.type === 'CINEMA' ? '/cinema' : '/experiences',
      excerpt: e.description ? e.description.substring(0, 100) : undefined, date: e.date
    });
  }

  // Search Photos
  const photos = await prisma.photo.findMany({
    where: { caption: { contains: q, mode: 'insensitive' } },
    take: 5
  });
  for (const p of photos) {
    results.push({
      id: p.id, title: p.caption || 'Photograph', type: 'Photography', url: `/photography`,
      image: p.url, date: p.date
    });
  }

  return results;
}
