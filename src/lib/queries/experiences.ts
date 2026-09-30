import prisma from '../prisma';

export async function getExperiences() {
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
}

export async function getFoodExperiences() {
  return await prisma.experience.findMany({
    where: { type: 'FOOD' },
    include: {
      foodExperience: true,
      trip: { select: { title: true, slug: true } },
      place: { select: { name: true, slug: true, country: true } }
    },
    orderBy: { date: 'desc' }
  });
}

export async function getCinemaExperiences() {
  return await prisma.experience.findMany({
    where: { type: 'CINEMA' },
    include: {
      movie: true,
      trip: { select: { title: true, slug: true } },
      place: { select: { name: true, slug: true, country: true } }
    },
    orderBy: { date: 'desc' }
  });
}
