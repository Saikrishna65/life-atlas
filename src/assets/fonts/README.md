# Bundled website fonts

These are the same open-source families used by Life Atlas, now stored locally
so Next.js builds do not need Google Fonts network access. No runtime font service,
API credential or environment variable is required. `next/font/local` emits the
usual hashed, cacheable static assets and preserves the existing CSS variables.

The full official variable fonts were downloaded from the Google Fonts repository
and losslessly packaged as WOFF2 using fontTools 4.61.1 and Brotli. Glyph sets were
not subsetted. Each family's SIL Open Font License is included beside its font.
Brotli/fontTools are preparation tools only, not application/build dependencies.

| File | Original source | Axes |
|---|---|---|
| plus-jakarta-sans.woff2 | https://github.com/google/fonts/blob/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf | wght 200–800 |
| playfair-display.woff2 | https://github.com/google/fonts/blob/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf | wght 400–900 |
| manrope.woff2 | https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf | wght 200–800 |
| inter.woff2 | https://github.com/google/fonts/blob/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf | opsz 14–32, wght 100–900 |
| oswald.woff2 | https://github.com/google/fonts/blob/main/ofl/oswald/Oswald%5Bwght%5D.ttf | wght 200–700 |

Do not replace these with build-time Google Fonts imports. The shared font
exports live in `src/lib/fonts.ts` and `src/lib/public-fonts.ts`.
