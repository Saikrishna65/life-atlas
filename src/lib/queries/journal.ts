import prisma from '../prisma';

export async function getJournalEntries() {
  return await prisma.journalEntry.findMany({
    orderBy: { date: 'desc' },
    include: {
      trip: { 
        select: { title: true, slug: true, coverImage: true }
      }
    }
  });
}

export async function getJournalEntryBySlug(slug: string) {
  return await prisma.journalEntry.findUnique({
    where: { slug },
    include: {
      trip: { 
        include: {
          photos: { take: 6, orderBy: { date: 'desc' } }
        }
      }
    }
  });
}

export async function getNextJournalEntry(date: Date) {
  // Find the closest entry older than the current one
  return await prisma.journalEntry.findFirst({
    where: {
      date: { lt: date }
    },
    orderBy: { date: 'desc' },
    select: { title: true, slug: true }
  });
}
