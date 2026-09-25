import prisma from '../prisma';

export async function getTrips() {
  return prisma.trip.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      tripPlaces: { include: { place: true } }
    }
  });
}

export async function getTripBySlug(slug: string) {
  return prisma.trip.findUnique({
    where: { slug },
    include: {
      tripDays: { orderBy: { dayIndex: 'asc' } },
      photos: true,
      journalEntries: true,
      experiences: {
        include: { foodExperience: true, movie: true }
      }
    }
  });
}
