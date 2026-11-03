"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { triggerHaptic } from "@/lib/deviceAuth";

export interface CategoryTabItem {
  id: string;
  label: string;
  href: string;
  badge?: {
    text: string;
    variant: "orange" | "live";
  };
}

const CATEGORY_TABS: CategoryTabItem[] = [
  {
    id: "your-space",
    label: "Your Space",
    href: "/secret/music",
    badge: { text: "New Track", variant: "orange" },
  },
  {
    id: "podcast",
    label: "Podcast",
    href: "/secret/music/library?filter=podcast",
    badge: { text: "Live", variant: "live" },
  },
  {
    id: "playlists",
    label: "Playlists",
    href: "/secret/music/playlists",
  },
  {
    id: "artists",
    label: "Artists",
    href: "/secret/music/artists",
  },
  {
    id: "vault",
    label: "Vault",
    href: "/secret/music/settings",
  },
];

export default function CategoryTabs({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "";

  const isActive = (item: CategoryTabItem) => {
    if (item.id === "your-space") {
      return pathname === "/secret/music";
    }
    if (item.id === "podcast") {
      return pathname.includes("filter=podcast");
    }
    return pathname.startsWith(item.href);
  };

  return (
    <div
      className={`flex items-end gap-6 sm:gap-7 overflow-x-auto py-1 px-1 -mx-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
      aria-label="Music categories"
    >
      {CATEGORY_TABS.map((tab) => {
        const active = isActive(tab);

        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={() => triggerHaptic("tap")}
            className="group relative flex flex-col items-start shrink-0 select-none cursor-pointer transition-transform active:scale-95"
            role="tab"
            aria-selected={active}
          >
            {/* Top Micro-badge if present */}
            {tab.badge && (
              <span
                className={`text-[10px] font-semibold tracking-wider uppercase mb-0.5 ${
                  tab.badge.variant === "orange"
                    ? "text-[#f95721]"
                    : "px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-white/70 text-[9px]"
                }`}
              >
                {tab.badge.text}
              </span>
            )}
            {!tab.badge && <span className="h-[15px]" aria-hidden="true" />}

            {/* Tab Label */}
            <span
              className={`text-xl sm:text-2xl tracking-tight transition-colors duration-200 ${
                active
                  ? "font-bold text-white"
                  : "font-semibold text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

