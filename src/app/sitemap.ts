import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || "https://life-atlas-eight-five.vercel.app";
  // Public demos remain indexable if the optional original public database is offline.
  const [tripResult, placeResult] = await Promise.allSettled([
    prisma.trip.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.place.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  const routes = [
    "",
    "/trips",
    "/places",
    "/photography",
    "/timeline",
    "/map",
    "/explore",
    "/food",
    "/cinema",
    "/experiences",
    "/about",
  ];
  const records: MetadataRoute.Sitemap = [
    ...routes.map((route) => ({
      url: `${base}${route}`,
      changeFrequency: "monthly" as const,
      priority: route === "" ? 1 : 0.8,
    })),

  ];
  if (tripResult.status === "fulfilled")
    records.push(
      ...tripResult.value.map((t) => ({
        url: `${base}/trips/${t.slug}`,
        lastModified: t.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    );
  if (placeResult.status === "fulfilled")
    records.push(
      ...placeResult.value.map((p) => ({
        url: `${base}/places/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    );
  return [...new Map(records.map((record) => [record.url, record])).values()];
}
