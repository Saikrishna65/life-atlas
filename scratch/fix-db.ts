import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up orphaned JOURNAL timeline events...");
  
  // Use raw SQL to delete timeline events with the removed enum value
  // Depending on DB engine (SQLite vs Postgres), we'll try standard SQL
  try {
    const result = await prisma.$executeRawUnsafe(`DELETE FROM "TimelineEvent" WHERE type = 'JOURNAL'`);
    console.log(`Deleted orphaned TimelineEvent rows.`);
  } catch (e) {
    console.log("Error deleting from TimelineEvent, maybe no matching rows.", e);
  }

  console.log("Database cleanup complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
