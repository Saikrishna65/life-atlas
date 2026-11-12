"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
const AdminSearch = dynamic(() => import("./AdminSearchOverlay"));
const PublicSearch = dynamic(() => import("@/components/world/PublicSearch"));
export default function SearchOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (pathname?.startsWith("/secret") || pathname?.startsWith("/admin"))
      return;
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (
        ((e.metaKey || e.ctrlKey) && e.key === "k") ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("open-search", show);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("open-search", show);
      window.removeEventListener("keydown", key);
    };
  }, [pathname]);
  if (pathname?.startsWith("/admin")) return <AdminSearch />;
  if (
    !open ||
    pathname?.startsWith("/secret") ||
    pathname?.startsWith("/admin")
  )
    return null;
  return <PublicSearch onClose={() => setOpen(false)} />;
}
