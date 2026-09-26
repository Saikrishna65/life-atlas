import prisma from '../prisma';

export type TripSortOption = 'latest' | 'oldest' | 'longest' | 'most-photos';

export async function getTrips(sort: TripSortOption = 'latest') {
  let orderBy: any = { startDate: 'desc' };
  
  if (sort === 'oldest') {
    orderBy = { startDate: 'asc' };
  } else if (sort === 'most-photos') {
    orderBy = { photos: { _count: 'desc' } };
  } else if (sort === 'longest') {
    // Note: since duration is a string, sorting by duration directly in SQL isn't perfect,
    // but in a real app we might store days as an int. We'll fallback to sorting by trip days count.
    orderBy = { tripDays: { _count: 'desc' } };
  }

  return prisma.trip.findMany({
    orderBy,
    include: {
      tripPlaces: { include: { place: true } },
      _count: { select: { photos: true } }
    }
  });
}

export async function getTripBySlug(slug: string) {
  return prisma.trip.findUnique({
    where: { slug },
    include: {
      tripPlaces: { include: { place: true } },
      tripDays: { orderBy: { dayIndex: 'asc' } },
      photos: { orderBy: { date: 'asc' } },
      journalEntries: true,
      experiences: {
        include: { foodExperience: true, movie: true }
      }
    }
  });
}

export async function getNextTrip(currentDate: Date, currentId: string) {
  const nextTrip = await prisma.trip.findFirst({
    where: {
      startDate: { gte: currentDate },
      id: { not: currentId }
    },
    orderBy: { startDate: 'asc' },
    include: {
      tripPlaces: { include: { place: true } }
    }
  });

  if (!nextTrip) {
    // Fallback to latest
    return prisma.trip.findFirst({
      where: { id: { not: currentId } },
      orderBy: { startDate: 'desc' },
      include: {
        tripPlaces: { include: { place: true } }
      }
    });
  }
  return nextTrip;
}
