import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const placeUpdates: Record<string, { slug: string, name: string, region: string, city: string, lat: number, lng: number }> = {
  'tokyo': { slug: 'jaipur', name: 'Jaipur', region: 'Rajasthan', city: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  'kyoto': { slug: 'udaipur', name: 'Udaipur', region: 'Rajasthan', city: 'Udaipur', lat: 24.5854, lng: 73.7125 },
  'paris': { slug: 'goa', name: 'Goa', region: 'Goa', city: 'Panaji', lat: 15.2993, lng: 74.1240 },
  'rome': { slug: 'kochi', name: 'Kochi', region: 'Kerala', city: 'Kochi', lat: 9.9312, lng: 76.2673 },
  'new-york': { slug: 'bangalore', name: 'Bangalore', region: 'Karnataka', city: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  'london': { slug: 'hyderabad', name: 'Hyderabad', region: 'Telangana', city: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  'berlin': { slug: 'chennai', name: 'Chennai', region: 'Tamil Nadu', city: 'Chennai', lat: 13.0827, lng: 80.2707 },
};

const tripUpdates: Record<string, { slug: string, title: string, destination: string, description: string }> = {
  'japan-spring': { slug: 'rajasthan-royals', title: 'Rajasthan Royals', destination: 'Rajasthan, India', description: 'Palaces, deserts, and vibrant colors.' },
  'european-summer': { slug: 'southern-sojourn', title: 'Southern Sojourn', destination: 'Kerala & Goa, India', description: 'Beaches, backwaters, and spices.' },
  'nyc-winter': { slug: 'monsoon-magic', title: 'Monsoon Magic', destination: 'Karnataka & Maharashtra, India', description: 'Lush green hills and heavy rains.' },
};

async function main() {
  console.log('Replacing international places with Indian places...');
  for (const [oldSlug, newData] of Object.entries(placeUpdates)) {
    const existing = await prisma.place.findUnique({ where: { slug: oldSlug } });
    if (existing) {
      await prisma.place.update({
        where: { slug: oldSlug },
        data: {
          slug: newData.slug,
          name: newData.name,
          country: 'India',
          region: newData.region,
          city: newData.city,
          latitude: newData.lat,
          longitude: newData.lng,
        }
      });
      console.log(`Updated place: ${oldSlug} -> ${newData.slug}`);
    }
  }

  console.log('Replacing international trips with Indian trips...');
  for (const [oldSlug, newData] of Object.entries(tripUpdates)) {
    const existing = await prisma.trip.findUnique({ where: { slug: oldSlug } });
    if (existing) {
      await prisma.trip.update({
        where: { slug: oldSlug },
        data: {
          slug: newData.slug,
          title: newData.title,
          destination: newData.destination,
          description: newData.description,
        }
      });
      console.log(`Updated trip: ${oldSlug} -> ${newData.slug}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
