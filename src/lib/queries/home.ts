import prisma from '../prisma';

export async function getHomepageData() {
  try {
    const [
      tripsCount,
      placesCount,
      photosCount,
      memoriesCount,
      featuredTrips,
      timelinePreview,
      photos,
      experiences,
      globePlaces
    ] = await Promise.all([
      prisma.trip.count(),
      prisma.place.count(),
      prisma.photo.count(),
      prisma.memory.count(),
      prisma.trip.findMany({ take: 3, orderBy: { startDate: 'desc' } }),
      prisma.timelineEvent.findMany({ take: 5, orderBy: { date: 'desc' } }),
      prisma.photo.findMany({ where: { isFeatured: true }, take: 6, orderBy: { date: 'desc' } }),
      prisma.experience.findMany({
        take: 4,
        orderBy: { date: 'desc' },
        include: { place: true, trip: true }
      }),
      prisma.place.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          name: true,
          slug: true,
          country: true,
          latitude: true,
          longitude: true,
          tripPlaces: {
            select: { trip: { select: { title: true, slug: true } } },
            take: 1
          }
        }
      })
    ]);

    const stats = {
      trips: tripsCount,
      places: placesCount,
      photos: photosCount,
      memories: memoriesCount,
    };

    return { stats, featuredTrips, timelinePreview, photos, experiences, globePlaces };
  } catch (error) {
    console.error('Failed to load homepage data from database, using fallback:', error);
    return {
      stats: { trips: 0, places: 0, photos: 0, memories: 0 },
      featuredTrips: [],
      timelinePreview: [],
      photos: [],
      experiences: [],
      globePlaces: []
    };
  }
}
