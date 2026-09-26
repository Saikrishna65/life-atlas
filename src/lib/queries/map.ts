import prisma from '../prisma';

export async function getMapData() {
  const places = await prisma.place.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      tripPlaces: { include: { trip: true } },
    }
  });

  return places;
}
