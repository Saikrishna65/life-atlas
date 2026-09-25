import prisma from '../prisma';

export async function getPlaces() {
  return prisma.place.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function getPlaceBySlug(slug: string) {
  return prisma.place.findUnique({
    where: { slug },
    include: {
      tripPlaces: { include: { trip: true } },
      photos: true,
      experiences: true
    }
  });
}
