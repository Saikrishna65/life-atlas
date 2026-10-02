"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Search } from "lucide-react";
import gsap from "gsap";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/trips", label: "Trips" },
  { href: "/map", label: "Map" },
  { href: "/timeline", label: "Timeline" },
  { href: "/journal", label: "Journal" },
  { href: "/about", label: "About" },
];

const secondaryLinks = [
  { href: "/places", label: "Places" },
  { href: "/photography", label: "Photography" },
  { href: "/experiences", label: "Experiences" },
  { href: "/food", label: "Food" },
  { href: "/cinema", label: "Cinema" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const tlRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Simple GSAP animation for menu items
      tlRef.current = gsap.fromTo(
        ".menu-item",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out" }
      );
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (tlRef.current) {
        tlRef.current.kill();
      }
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-6 md:px-12 md:py-8 mix-blend-difference text-white">
        <Link href="/" className="font-sans text-sm font-medium tracking-widest uppercase z-50">
          LIFE ATLAS
        </Link>

        <div className="hidden md:flex items-center gap-8 z-50">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-sans text-sm font-medium hover:text-white/70 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <button 
            aria-label="Open search" 
            className="hover:text-white/70 transition-colors"
            onClick={() => window.dispatchEvent(new Event("open-search"))}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>

        <button
          className="z-50 flex items-center justify-center p-2 hover:text-white/70 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="fullscreen-menu"
        >
          {isOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </header>

      {/* Fullscreen Menu */}
      <div
        id="fullscreen-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Main Navigation"
        className={`fixed inset-0 z-30 bg-foreground text-background flex flex-col md:flex-row transition-opacity duration-700 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex-1 flex flex-col justify-center px-8 md:px-24 pt-24 pb-12">
          <nav className="flex flex-col gap-4 md:gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="menu-item font-display text-4xl md:text-6xl lg:text-7xl uppercase hover:text-accent transition-colors w-fit"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="md:w-1/3 flex flex-col justify-end px-8 md:px-16 pb-12 md:pb-24">
          <nav className="flex flex-col gap-3">
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="menu-item font-sans text-lg md:text-xl hover:text-accent transition-colors w-fit"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
