"use client";
import {usePublicLoading} from "./PublicPageReady";
import { usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
const AdminFooter = dynamic(() => import("./AdminFooter"));
export default function Footer() {
  const pathname = usePathname();
  const publicLoading=usePublicLoading();
  if (pathname?.startsWith("/admin")) return <AdminFooter />;
  if (
    pathname === "/" ||
    (pathname?.startsWith("/trips/") ?? false) ||
    pathname?.startsWith("/secret") ||
    pathname?.startsWith("/admin")
  )
    return null;
  return (
    <footer className="public-footer" inert={publicLoading} aria-busy={publicLoading}>
      <div>
        <strong>LIFE ATLAS</strong>
        <p>
          A world of places, moments, and possibilities.
          <br />My journeys, photographs and films.
        </p>
      </div>
      <div>
        <Link href="/about">About my atlas ↗</Link>
        <span>© 2026 LIFE ATLAS / THE LIVING WORLD</span>
      </div>
    </footer>
  );
}
