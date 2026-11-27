"use client";
import PublicPageReady, {usePublicLoading} from "@/components/layout/PublicPageReady";
import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "./world.css";
import WorldMotion from "./WorldMotion";
export default function PublicPage({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  const publicLoading=usePublicLoading();
  return (
    <div className="living-world public-page">
      <PublicPageReady />
      <header className="public-page-title">
        <Link prefetch={publicLoading?false:null} href="/" className="world-eyebrow">
          Atlas / The Living World
        </Link>
        <h1>{title}</h1>
        <p>{kicker}</p>
      </header>
      <WorldMotion>{children}</WorldMotion>
      <nav className="public-crossroads" aria-label="Keep exploring">
        <span className="world-eyebrow">There is more to your world.</span>
        <Link prefetch={publicLoading?false:null} href="/">
          Return to the living world <ArrowUpRight size={18} />
        </Link>
        <Link prefetch={publicLoading?false:null} href="/explore">
          Explore the atlas <ArrowUpRight size={18} />
        </Link>
      </nav>
    </div>
  );
}
