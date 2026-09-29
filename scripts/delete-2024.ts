import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dateStr = '2025-01-01';
  
  const result = await prisma.timelineEvent.deleteMany({
    where: {
      date: {
        lt: new Date(dateStr)
      }
    }
  });
  console.log(`Deleted ${result.count} events from before 2025`);
}

main().finally(() => prisma.$disconnect());
