import prisma from '../prisma';

export type PlaceSortOption = 'latest' | 'oldest' | 'name';

export async function getPlaces(sort: PlaceSortOption = 'name') {
  let orderBy: any = { name: 'asc' };
  
  if (sort === 'latest') {
    orderBy = { createdAt: 'desc' };
  } else if (sort === 'oldest') {
    orderBy = { createdAt: 'asc' };
  }

  return prisma.place.findMany({
    orderBy,
    include: {
      tripPlaces: { include: { trip: true } },
      _count: { select: { photos: true, experiences: true } }
    }
  });
}

export async function getPlaceBySlug(slug: string) {
  return prisma.place.findUnique({
    where: { slug },
    include: {
      tripPlaces: { include: { trip: true } },
      photos: { orderBy: { date: 'asc' } },
      experiences: {
        include: { foodExperience: true, movie: true }
      }
    }
  });
}
