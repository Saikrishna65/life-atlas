import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import HomePreloader from "@/components/home/HomePreloader";
import { NativeAppRedirect } from "@/components/native/NativeAppRedirect";
import LivingWorld from "@/components/world/LivingWorld";
export const metadata: Metadata = {
  title: "Life Atlas — The Living World",
  description:
    "A cinematic journey through places, moments, and possibility. Reality meets imagination in the Living World.",
};
export default function Home() {
  return (
    <>
      <NativeAppRedirect />
      <HomePreloader />
      <div className="bg-background text-foreground min-h-screen">
        <Hero />
        <LivingWorld />
      </div>
    </>
  );
}
