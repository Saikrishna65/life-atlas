import { PrismaClient, EventType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found');
    return;
  }

  const trips = await prisma.trip.findMany();
  
  const timelineData = [
    {
      date: new Date('2025-11-15'),
      title: 'Late Autumn Retreat',
      description: 'A quiet time before the winter set in.',
      type: EventType.TRIP,
      userId: user.id,
      referenceId: trips[2]?.id || null,
    },
    {
      date: new Date('2025-08-22'),
      title: 'Summer Coastal Drive',
      description: 'Rented a car and drove along the coast for 3 days.',
      type: EventType.EXPERIENCE,
      userId: user.id,
    },
    {
      date: new Date('2025-04-10'),
      title: 'Spring Festival',
      description: 'The colors were incredibly vibrant this year.',
      type: EventType.MEMORY,
      userId: user.id,
    },

  ];

  await prisma.timelineEvent.createMany({ data: timelineData });
  console.log('Successfully added 2025 (and 2024) timeline events.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
