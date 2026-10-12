import prisma from '../prisma';

export async function getExperiences() {
  try {
    return await prisma.experience.findMany({
      where: {
        type: { notIn: ['FOOD', 'CINEMA'] }
      },
      include: {
        trip: { select: { title: true, slug: true } },
        place: { select: { name: true, slug: true, country: true } }
      },
      orderBy: { date: 'desc' }
    });
  } catch (err) {
    console.warn("Failed to fetch experiences:", err);
    return [];
  }
}

export async function getFoodExperiences() {
  try {
    return await prisma.experience.findMany({
      where: { type: 'FOOD' },
      include: {
        foodExperience: true,
        trip: { select: { title: true, slug: true } },
        place: { select: { name: true, slug: true, country: true } }
      },
      orderBy: { date: 'desc' }
    });
  } catch (err) {
    console.warn("Failed to fetch food experiences:", err);
    return [];
  }
}

export async function getCinemaExperiences() {
  try {
    return await prisma.experience.findMany({
      where: { type: 'CINEMA' },
      include: {
        movie: true,
        trip: { select: { title: true, slug: true } },
        place: { select: { name: true, slug: true, country: true } }
      },
      orderBy: { date: 'desc' }
    });
  } catch (err) {
    console.warn("Failed to fetch cinema experiences:", err);
    return [];
  }
}

