import localFont from 'next/font/local';

// Checked-in variable fonts keep builds independent of Google Fonts availability.
export const display = localFont({
  src: '../assets/fonts/playfair-display.woff2',
  weight: '400 900',
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const sans = localFont({
  src: '../assets/fonts/manrope.woff2',
  weight: '200 800',
  variable: '--font-sans',
  display: 'swap',
});

export const body = localFont({
  src: '../assets/fonts/inter.woff2',
  weight: '100 900',
  variable: '--font-body',
  display: 'swap',
});
