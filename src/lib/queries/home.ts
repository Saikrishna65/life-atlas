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

  return { stats, featuredTrips, timelinePreview };
}
