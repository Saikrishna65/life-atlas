import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lifeatlas.example.com';

  // Get dynamic routes
  const trips = await prisma.trip.findMany({ select: { slug: true, updatedAt: true } });
  const places = await prisma.place.findMany({ select: { slug: true, updatedAt: true } });

  const tripUrls = trips.map((trip) => ({
    url: `${baseUrl}/trips/${trip.slug}`,
    lastModified: trip.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const placeUrls = places.map((place) => ({
    url: `${baseUrl}/places/${place.slug}`,
    lastModified: place.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));


  const staticRoutes = [
    '',
    '/trips',
    '/places',
    '/photography',
    '/timeline',
    '/map',
    '/explore',
    '/search',
    '/about',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.9,
  }));

  return [...staticRoutes, ...tripUrls, ...placeUrls];
}
