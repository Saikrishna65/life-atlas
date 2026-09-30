import type { Metadata } from "next";
import { display, sans, body } from "@/lib/fonts";
import "./globals.css";
import SmoothScroll from "@/components/layout/SmoothScroll";
import Navigation from "@/components/layout/Navigation";
import Footer from "@/components/layout/Footer";
import SearchOverlay from "@/components/layout/SearchOverlay";

export const metadata: Metadata = {
  title: "Life Atlas",
  description: "A place for the moments I want to remember.",
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
