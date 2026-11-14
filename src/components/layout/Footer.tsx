"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
const AdminFooter = dynamic(() => import("./AdminFooter"));
export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return <AdminFooter />;
  if (
    pathname === "/" ||
    (pathname?.startsWith("/trips/") ?? false) ||
    pathname?.startsWith("/secret") ||
    pathname?.startsWith("/admin")
  )
    return null;
  return (
    <footer className="public-footer">
      <div>
        <strong>LIFE ATLAS</strong>
        <p>
          A world of places, moments, and possibilities.
          <br />A public demonstration for the endlessly curious.
        </p>
      </div>
      <div>
        <Link href="/about">About the atlas & image credits ↗</Link>
        <span>© 2026 LIFE ATLAS / THE LIVING WORLD</span>
      </div>
    </footer>
  );
}
