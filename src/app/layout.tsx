import type { Metadata } from "next";
import { display, sans, body } from "@/lib/fonts";
import "./globals.css";
import SmoothScroll from "@/components/layout/SmoothScroll";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import SearchOverlay from "@/components/layout/SearchOverlay";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://lifeatlas.example.com'),
  title: {
    template: "%s | Life Atlas",
    default: "Life Atlas",
  },
  description: "A place for the moments I want to remember.",
  openGraph: {
    title: "Life Atlas",
    description: "A place for the moments I want to remember.",
    url: "https://lifeatlas.example.com",
    siteName: "Life Atlas",
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
    title: "Life Atlas",
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
    <html lang="en" className={`${display.variable} ${sans.variable} ${body.variable}`}>
      <body>
        <SmoothScroll>
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
