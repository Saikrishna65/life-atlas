"use client";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Search } from "lucide-react";
import { Modal } from "./primitives";
import "./world.css";
import "./observatory.css";
const typography = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-world-navigation", display: "swap" });
const links = [
  ["/explore", "Discover"],
  ["/trips", "Journeys"],
  ["/photography", "Frames & films"],
  ["/map", "The world"],
  ["/timeline", "Timeline"],
  ["/about", "About"],
];
export default function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className={`${typography.variable} world-nav is-visible public-header reference-world-nav`}>
        <button aria-label="Search the atlas" className="reference-nav-round" onClick={() => window.dispatchEvent(new Event("open-search"))}><Search size={17} /></button>
        <nav className="reference-nav-center" aria-label="Public navigation">
          <div className="reference-nav-pill">
            {[["/trips", "The journeys"], ["/places", "The places"], ["/photography", "Frames & films"]].map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
          </div>
          <Link className="reference-nav-brand atlas-logo-brand" href="/" aria-label="Life Atlas home"><Image src="/brand/life-atlas-black.png" width={96} height={64} sizes="96px" alt="" /></Link>
          <div className="reference-nav-pill">
            {[["/map", "The world"], ["/timeline", "Our timeline"], ["/about", "The story"]].map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
          </div>
        </nav>
        <button aria-label="Open public navigation" className="reference-nav-round" onClick={() => setOpen(true)}><Menu size={17} /></button>
      </header>
      {open && (
        <Modal
          title="Explore the atlas"
          className="world-chapter-dialog public-navigation-dialog"
          onClose={() => setOpen(false)}
        >
          <nav className="public-menu">
            {[
              ...links,
              ["/food", "Food & places"],
              ["/cinema", "Cinema"],
              ["/experiences", "Experiences"],
            ].map(([href, label]) => (
              <Link onClick={() => setOpen(false)} href={href} key={href}>
                {label}
                <ArrowUpRight size={23} />
              </Link>
            ))}
          </nav>
        </Modal>
      )}
    </>
  );
}
