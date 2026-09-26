import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const coords: Record<string, { lat: number; lng: number }> = {
  'Chopta': { lat: 30.3568, lng: 79.0493 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Udaipur': { lat: 24.5854, lng: 73.7125 },
  'Goa': { lat: 15.2993, lng: 74.1240 },
  'Kochi': { lat: 9.9312, lng: 76.2673 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi': { lat: 28.7041, lng: 77.1025 },
};

async function main() {
  for (const [name, c] of Object.entries(coords)) {
    const r = await prisma.place.updateMany({
      where: { name },
      data: { latitude: c.lat, longitude: c.lng },
    });
    console.log(`${name}: updated ${r.count} record(s)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
