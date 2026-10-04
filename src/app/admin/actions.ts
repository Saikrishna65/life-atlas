"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

async function getAuthorId() {
  const user = await prisma.user.findUnique({
    where: { email: 'author@lifeatlas.com' }
  });
  if (!user) throw new Error("Author user not found.");
  return user.id;
}

export async function createTrip(formData: FormData) {
  const userId = await getAuthorId();
  const title = formData.get("title") as string;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  
  await prisma.trip.create({
    data: {
      title,
      slug,
      destination: formData.get("destination") as string,
      startDate: new Date(formData.get("startDate") as string),
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      duration: formData.get("duration") as string || null,
      description: formData.get("description") as string || null,
      coverImage: formData.get("coverImage") as string || null,
      userId,
    }
  });
  revalidatePath("/");
  revalidatePath("/trips");
}

export async function createPlace(formData: FormData) {
  const userId = await getAuthorId();
  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  
  const lat = formData.get("latitude") as string;
  const lng = formData.get("longitude") as string;

  await prisma.place.create({
    data: {
      name,
      slug,
      country: formData.get("country") as string,
      region: formData.get("region") as string || null,
      city: formData.get("city") as string || null,
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      description: formData.get("description") as string || null,
      coverImage: formData.get("coverImage") as string || null,
      userId,
    }
  });
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath("/map");
}

export async function createPhoto(formData: FormData) {
  const userId = await getAuthorId();
  const dateStr = formData.get("date") as string;
  
  await prisma.photo.create({
    data: {
      url: formData.get("url") as string,
      caption: formData.get("caption") as string || null,
      date: dateStr ? new Date(dateStr) : null,
      isFeatured: formData.get("isFeatured") === "true",
      userId,
      tripId: formData.get("tripId") as string || null,
      placeId: formData.get("placeId") as string || null,
    }
  });
  revalidatePath("/");
  revalidatePath("/photography");
}

export async function createMemory(formData: FormData) {
  const userId = await getAuthorId();
  const dateStr = formData.get("date") as string;
  
  await prisma.memory.create({
    data: {
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      date: dateStr ? new Date(dateStr) : null,
      userId,
    }
  });
  revalidatePath("/");
}

export async function createTimelineEvent(formData: FormData) {
  const userId = await getAuthorId();
  
  await prisma.timelineEvent.create({
    data: {
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      date: new Date(formData.get("date") as string),
      // @ts-ignore
      type: formData.get("type") as any,
      userId,
      referenceId: formData.get("referenceId") as string || null,
    }
  });
  revalidatePath("/");
  revalidatePath("/timeline");
}
