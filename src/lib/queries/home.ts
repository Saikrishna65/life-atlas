import prisma from '../prisma';

export async function getHomepageData() {
  const stats = {
    trips: await prisma.trip.count(),
    places: await prisma.place.count(),
    photos: await prisma.photo.count(),
    memories: await prisma.memory.count(),
  };

  const featuredTrips = await prisma.trip.findMany({
    take: 3,
    orderBy: { startDate: 'desc' },
  });

  const timelinePreview = await prisma.timelineEvent.findMany({
    take: 5,
    orderBy: { date: 'desc' },
  });

  const photos = await prisma.photo.findMany({
    where: { isFeatured: true },
    take: 6,
    orderBy: { date: 'desc' },
  });

  const experiences = await prisma.experience.findMany({
    take: 4,
    orderBy: { date: 'desc' },
    include: {
      place: true,
      trip: true
    }
  });

  const globePlaces = await prisma.place.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      latitude: true,
      longitude: true,
      tripPlaces: {
        select: {
          trip: { select: { title: true, slug: true } }
        },
        take: 1
      }
    }
  });

  return { stats, featuredTrips, timelinePreview, photos, experiences, globePlaces };
}
