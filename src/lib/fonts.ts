import { Playfair_Display, Manrope, Inter } from 'next/font/google';

export const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
