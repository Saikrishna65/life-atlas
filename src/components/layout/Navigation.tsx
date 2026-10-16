"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import gsap from "gsap";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/trips", label: "Trips" },
  { href: "/map", label: "Map" },
  { href: "/timeline", label: "Timeline" },
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
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isInHero, setIsInHero] = useState(true);
  const isDarkPageInitially = pathname === "/" || pathname?.startsWith('/trips/') || pathname?.startsWith('/places/');
  const [heroTheme, setHeroTheme] = useState<"light" | "dark">(isDarkPageInitially ? "dark" : "light");
  const prevScrollY = useRef(0);
  const tlRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const checkHeroState = () => {
      const heroEl = document.querySelector<HTMLElement>('[data-hero], [aria-label*="Hero"], .hero-section');
      if (!heroEl) {
        setIsInHero(false);
        return false;
      }

      const theme = (heroEl.getAttribute('data-theme') as "light" | "dark") || (pathname === "/" || pathname?.startsWith('/trips/') || pathname?.startsWith('/places/') ? "dark" : "light");
      setHeroTheme(theme);

      const rect = heroEl.getBoundingClientRect();
      const currentScrollY = window.scrollY;
      
      // Hero section is active while any part of it spans the top/viewport
      const inHero = rect.height === 0 
        ? (currentScrollY < 500 || pathname === "/")
        : (rect.top <= 100 && rect.bottom > 0);

      setIsInHero(inHero);
      return inHero;
    };

    const handleScroll = () => {
      if (isOpen) return;

      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);
      checkHeroState();

      // Navbar is scrollable everywhere (both in hero and outside):
      // - Scroll down hides navbar
      // - Scroll up reveals navbar
      // - Near top (< 50px) always reveals navbar
      if (currentScrollY < prevScrollY.current || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > 50 && currentScrollY > prevScrollY.current) {
        setIsVisible(false);
      }

      prevScrollY.current = currentScrollY;
    };

    // Initial check on mount and pathname change
    const initialScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    prevScrollY.current = initialScrollY;
    setIsScrolled(initialScrollY > 20);
    setIsVisible(true);
    checkHeroState();

    // Re-check after hydration or dynamic elements mount
    const rafId = requestAnimationFrame(() => {
      checkHeroState();
    });
    const timerId = setTimeout(() => {
      checkHeroState();
    }, 200);

    const observer = new MutationObserver(() => {
      checkHeroState();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen, pathname]);

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

  // Determine header styling: In hero, always transparent (never white)
  const headerBackgroundClass = isOpen || isInHero || !isScrolled
    ? "bg-transparent border-transparent backdrop-blur-none shadow-none"
    : "bg-background/80 backdrop-blur-xl border-b border-muted/70 shadow-xs";

  const textColorClass = isOpen
    ? "text-foreground"
    : isInHero
    ? heroTheme === "dark"
      ? "text-white"
      : "text-slate-900"
    : "text-foreground";

  const linkHoverClass = isOpen
    ? "hover:text-accent"
    : isInHero && heroTheme === "dark"
    ? "hover:text-white/80"
    : "hover:text-accent";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 md:px-12 md:py-4 transition-all duration-300 ease-out ${headerBackgroundClass} ${textColorClass} ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Link
          href="/"
          className="font-sans text-sm font-bold tracking-[0.2em] uppercase z-50 flex items-center gap-2 transition-colors"
        >
          LIFE ATLAS
        </Link>

        <div className="hidden md:flex items-center gap-8 z-50">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-sans text-sm font-medium transition-colors ${linkHoverClass}`}
            >
              {link.label}
            </Link>
          ))}
          <button
            aria-label="Open search"
            className={`transition-colors ${linkHoverClass}`}
            onClick={() => window.dispatchEvent(new Event("open-search"))}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>

        <button
          className={`z-50 flex items-center justify-center p-2 transition-colors ${linkHoverClass}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="fullscreen-menu"
        >
          {isOpen ? (
            <X size={24} aria-hidden="true" className={isOpen ? "text-accent-red" : ""} />
          ) : (
            <Menu size={24} aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Fullscreen Menu */}
      <div
        id="fullscreen-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Main Navigation"
        className={`fixed inset-0 z-30 bg-background text-foreground flex flex-col md:flex-row transition-opacity duration-700 ${
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
                className="menu-item font-sans text-lg md:text-xl text-muted-foreground hover:text-accent-green transition-colors w-fit"
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
