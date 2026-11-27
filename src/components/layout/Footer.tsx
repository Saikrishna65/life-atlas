"use client";
import {usePublicLoading} from "./PublicPageReady";
import { usePathname } from "next/navigation";
import { isVideoWebPath } from "@/lib/video/routes";
import Link from "next/link";
import dynamic from "next/dynamic";
const AdminFooter = dynamic(() => import("./AdminFooter"));
export default function Footer() {
  const pathname = usePathname();
  const publicLoading=usePublicLoading();
  if (pathname?.startsWith("/admin")) return <AdminFooter />;
  if (
    isVideoWebPath(pathname) || pathname === "/" ||
    (pathname?.startsWith("/trips/") ?? false) ||
    pathname?.startsWith("/secret") ||
    pathname?.startsWith("/admin")
  )
    return null;
  return (
    <footer className="public-footer" inert={publicLoading} aria-busy={publicLoading}>
      <div>
        <strong>ATLAS</strong>
        <p>
          A world of places, moments, and possibilities.
          <br />My journeys, photographs and films.
        </p>
      </div>
      <div>
        <Link href="/about">About my atlas ↗</Link>
        <span>© 2026 ATLAS / THE LIVING WORLD</span>
      </div>
    </footer>
  );
}
