import { PrismaClient, ExperienceType, EventType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Create User
  const user = await prisma.user.upsert({
    where: { email: 'author@lifeatlas.com' },
    update: {},
    create: {
      email: 'author@lifeatlas.com',
      name: 'Author',
    },
  });

  // 2. Create Places
  const placesData = [
    { slug: 'chopta', name: 'Chopta', country: 'India', region: 'Uttarakhand', city: 'Chopta' },
    { slug: 'jaipur', name: 'Jaipur', country: 'India', region: 'Rajasthan', city: 'Jaipur' },
    { slug: 'udaipur', name: 'Udaipur', country: 'India', region: 'Rajasthan', city: 'Udaipur' },
    { slug: 'goa', name: 'Goa', country: 'India', region: 'Goa', city: 'Panaji' },
    { slug: 'kochi', name: 'Kochi', country: 'India', region: 'Kerala', city: 'Kochi' },
    { slug: 'bangalore', name: 'Bangalore', country: 'India', region: 'Karnataka', city: 'Bangalore' },
    { slug: 'hyderabad', name: 'Hyderabad', country: 'India', region: 'Telangana', city: 'Hyderabad' },
    { slug: 'chennai', name: 'Chennai', country: 'India', region: 'Tamil Nadu', city: 'Chennai' },
    { slug: 'mumbai', name: 'Mumbai', country: 'India', region: 'Maharashtra', city: 'Mumbai' },
    { slug: 'delhi', name: 'Delhi', country: 'India', region: 'Delhi', city: 'New Delhi' },
  ];

  const places = await Promise.all(
    placesData.map(p => prisma.place.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, userId: user.id },
    }))
  );

  // 3. Create Trips
  const tripsData = [
    {
      slug: 'himalayan-journey',
      title: 'The Himalayan Journey',
      destination: 'Uttarakhand, India',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-05'),
      duration: '5 days',
      description: 'A road through mountains, mist and quiet places.',
    },
    {
      slug: 'rajasthan-royals',
      title: 'Rajasthan Royals',
      destination: 'Rajasthan, India',
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-20'),
      duration: '10 days',
      description: 'Palaces, deserts, and vibrant colors.',
    },
    {
      slug: 'southern-sojourn',
      title: 'Southern Sojourn',
      destination: 'Kerala & Goa, India',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-07-15'),
      duration: '15 days',
      description: 'Beaches, backwaters, and spices.',
    },
    {
      slug: 'monsoon-magic',
      title: 'Monsoon Magic',
      destination: 'Karnataka & Maharashtra, India',
      startDate: new Date('2025-12-20'),
      endDate: new Date('2025-12-28'),
      duration: '8 days',
      description: 'Lush green hills and heavy rains.',
    }
  ];

  const trips = await Promise.all(
    tripsData.map(t => prisma.trip.upsert({
      where: { slug: t.slug },
      update: {},
      create: { ...t, userId: user.id },
    }))
  );

  // 4. Link TripPlaces
  await prisma.tripPlace.createMany({
    skipDuplicates: true,
    data: [
      { tripId: trips[0].id, placeId: places[0].id },
      { tripId: trips[1].id, placeId: places[1].id },
      { tripId: trips[1].id, placeId: places[2].id },
      { tripId: trips[2].id, placeId: places[3].id },
      { tripId: trips[2].id, placeId: places[4].id },
      { tripId: trips[3].id, placeId: places[5].id },
    ],
  });

  // 5. Create TripDays (15 total)
  const tripDaysData = [];
  for (let i = 0; i < 5; i++) {
    tripDaysData.push({ tripId: trips[0].id, dayIndex: i + 1, date: new Date(`2026-09-0${1 + i}`), title: `Day ${i + 1} in Himalayas` });
  }
  for (let i = 0; i < 5; i++) {
    tripDaysData.push({ tripId: trips[1].id, dayIndex: i + 1, date: new Date(`2026-04-1${i}`), title: `Day ${i + 1} in Japan` });
  }
  for (let i = 0; i < 3; i++) {
    tripDaysData.push({ tripId: trips[2].id, dayIndex: i + 1, date: new Date(`2025-07-0${1 + i}`), title: `Day ${i + 1} in Paris` });
  }
  for (let i = 0; i < 2; i++) {
    tripDaysData.push({ tripId: trips[3].id, dayIndex: i + 1, date: new Date(`2025-12-2${i}`), title: `Day ${i + 1} in NYC` });
  }
  
  await prisma.tripDay.createMany({ skipDuplicates: true, data: tripDaysData });

  // 6. Create Photos (30 total)
  const photosData = [];
  for (let i = 0; i < 30; i++) {
    photosData.push({
      url: `https://images.unsplash.com/photo-1527004013197-251f40424381?w=800&q=80`,
      caption: `Photo ${i + 1}`,
      userId: user.id,
      tripId: trips[i % 4].id,
      placeId: places[i % 10].id,
    });
  }
  await prisma.photo.createMany({ skipDuplicates: true, data: photosData });

  // 7. Create Experiences & Food/Cinema
  for (let i = 0; i < 10; i++) {
    const isFood = i < 5;
    const isCinema = i >= 5 && i < 10;
    
    const exp = await prisma.experience.create({
      data: {
        slug: `experience-${i}`,
        title: `Experience ${i}`,
        type: isFood ? ExperienceType.FOOD : (isCinema ? ExperienceType.CINEMA : ExperienceType.EVENT),
        userId: user.id,
        tripId: trips[i % 4].id,
        placeId: places[i % 10].id,
      }
    });

    if (isFood) {
      await prisma.foodExperience.create({
        data: { experienceId: exp.id, restaurant: `Cafe ${i}`, dish: `Dish ${i}`, rating: 5 }
      });
    } else if (isCinema) {
      await prisma.movie.create({
        data: { experienceId: exp.id, director: `Director ${i}`, year: 2026, rating: 5, review: 'Great movie' }
      });
    }
  }

  // 8. Journal Entries (5)
  for (let i = 0; i < 5; i++) {
    await prisma.journalEntry.upsert({
      where: { slug: `journal-${i}` },
      update: {},
      create: {
        slug: `journal-${i}`,
        title: `Journal Entry ${i}`,
        content: 'This is a journal entry about the moments I want to remember.',
        date: new Date(),
        userId: user.id,
        tripId: trips[0].id,
      }
    });
  }

  // 9. Timeline Events (20)
  const timelineData = [];
  for (let i = 0; i < 20; i++) {
    timelineData.push({
      date: new Date(`2026-0${(i % 9) + 1}-10`),
      title: `Event ${i}`,
      type: EventType.TRIP,
      userId: user.id,
      referenceId: trips[i % 4].id,
    });
  }
  await prisma.timelineEvent.createMany({ skipDuplicates: true, data: timelineData });

  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
