"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Search } from "lucide-react";
import { Modal } from "./primitives";
import "./world.css";
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
      <header className="world-nav is-visible public-header">
        <Link
          className="world-wordmark atlas-logo-brand"
          href="/"
          aria-label="Life Atlas home"
        >
          <Image
            src="/brand/life-atlas-black.png"
            width={84}
            height={56}
            sizes="84px"
            alt=""
          />
        </Link>
        <nav className="world-nav-links" aria-label="Public navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="public-header-actions">
          <button
            aria-label="Search the atlas"
            className="world-icon"
            onClick={() => window.dispatchEvent(new Event("open-search"))}
          >
            <Search size={16} />
          </button>
          <button
            aria-label="Open public navigation"
            className="world-icon"
            onClick={() => setOpen(true)}
          >
            <Menu size={17} />
          </button>
        </div>
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
