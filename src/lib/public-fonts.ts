import localFont from 'next/font/local';

export const atlasDisplay = localFont({
  src: '../assets/fonts/oswald.woff2',
  weight: '200 700',
  variable: '--font-atlas-display',
  display: 'swap',
});

// Preserve the existing CSS variables; all three uses share one font asset.
export const heroTypography = localFont({
  src: '../assets/fonts/plus-jakarta-sans.woff2',
  weight: '400 600',
  variable: '--font-hero',
  display: 'swap',
});
export const navigationTypography = localFont({
  src: '../assets/fonts/plus-jakarta-sans.woff2',
  weight: '400 600',
  variable: '--font-world-navigation',
  display: 'swap',
});
export const observatoryTypography = localFont({
  src: '../assets/fonts/plus-jakarta-sans.woff2',
  weight: '400 600',
  variable: '--font-observatory',
  display: 'swap',
});
