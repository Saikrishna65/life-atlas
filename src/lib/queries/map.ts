import prisma from '../prisma';

export async function getMapData() {
  try {
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
  } catch (err) {
    console.warn("Failed to fetch map data:", err);
    return [];
  }
}

