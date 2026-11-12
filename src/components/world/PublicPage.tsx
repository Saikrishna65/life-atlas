"use client";
import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "./world.css";
export default function PublicPage({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="living-world public-page">
      <header className="public-page-title">
        <Link href="/" className="world-eyebrow">
          Life Atlas / The Living World
        </Link>
        <h1>{title}</h1>
        <p>{kicker}</p>
      </header>
      {children}
      <nav className="public-crossroads" aria-label="Keep exploring">
        <span className="world-eyebrow">There is more to your world.</span>
        <Link href="/">
          Return to the living world <ArrowUpRight size={18} />
        </Link>
        <Link href="/explore">
          Explore the atlas <ArrowUpRight size={18} />
        </Link>
      </nav>
    </div>
  );
}
