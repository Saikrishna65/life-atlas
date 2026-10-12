import prisma from '../prisma';

export async function getPhotos() {
  try {
    return await prisma.photo.findMany({
      orderBy: { date: 'desc' },
      include: {
        trip: { select: { title: true, slug: true } },
        place: { select: { name: true, slug: true, country: true } }
      }
    });
  } catch (err) {
    console.warn("Failed to fetch photos:", err);
    return [];
  }
}

