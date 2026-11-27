import type { Metadata, Viewport } from "next";
import { atlasDisplay } from "@/lib/public-fonts";
import { display, sans, body } from "@/lib/fonts";
import "./globals.css";
import PublicPageLoader from "@/components/layout/PublicPageLoader";
import SmoothScroll from "@/components/layout/SmoothScroll";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import SearchOverlay from "@/components/layout/SearchOverlay";
import MobileAppBridge from "@/components/layout/MobileAppBridge";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#05070a",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://life-atlas-eight-five.vercel.app'),
  title: {
    template: "%s | Atlas",
    default: "Atlas",
  },
  description: "A place for the moments I want to remember.",
  openGraph: {
    title: "Atlas",
    description: "A place for the moments I want to remember.",
    url: "https://life-atlas-eight-five.vercel.app",
    siteName: "Atlas",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atlas",
    description: "A place for the moments I want to remember.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${body.variable} ${atlasDisplay.variable}`}>
      <body suppressHydrationWarning>
        <MobileAppBridge />
        <div className="grain-overlay" />
        <SmoothScroll>
          <PublicPageLoader />
          <Navigation />
          <SearchOverlay />
          <main>
            {children}
          </main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
