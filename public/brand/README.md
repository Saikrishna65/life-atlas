# Life Atlas logo assets

- `life-atlas-white.png`: archived white raster derivative.
- `life-atlas-black.png`: archived black raster derivative.

These are transparent web derivatives prepared from the two user-supplied inline
logo images. They are not the original attachment bytes. The source inline files
were not exposed as downloadable attachments in this workspace. Both derivatives
remain unchanged.

The public navigation renders the geometric mark as inline vector paths in
`src/components/home/HeroLogo.tsx`, without the raster glow or runtime colour/alpha
filters. The public theme supplies white ink over films and dark scenes, and
forest ink over light sections. No black logo is used in the navigation.

Logo links have a textual accessible name; the vector inside is decorative.
