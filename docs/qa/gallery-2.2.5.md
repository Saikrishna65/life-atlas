# Atlas Gallery 2.2.5

## Changes

The chronological grid now packs bounded 1×1, 2×1 and 2×2 cell footprints, with no
portrait-height columns. The default phone density is four columns. Dense packing
fills earlier gaps and remains deterministic; date boundaries remain separate.
Images crop only inside the grid, while originals retain their bytes/proportions.
Automatic grid pagination and new thumbnail requests pause while the full viewer
is open. Deliberate navigation near the loaded end still prefetches the next page,
keeping background grid work from competing with the transition.

Shared photo motion now uses two matched compositor transforms and a separate
opacity shade. The previous clip-path animation and second dialog entrance fade
are removed. The crop's inner image counter-scales so its pixels are not stretched.

The shared image is decoded before starting. At completion, the live original is
shown before the shared layer dissolves. If decoding is delayed, a saved poster
remains visible and follows pan/zoom gestures until the original fades in. There
is no fixed 250 ms timeout that removes the only available bitmap. A new gesture
can dismiss the last dissolve without losing the poster. Closing during opening
reverses the same layer, or cancels before the first animation frame.

Videos, reduced motion and unavailable/off-screen source tiles use the simple
fallback. No continuous rendering loop, canvas video snapshot, new native model,
media rewrite, cloud operation or database migration is introduced.

## Checks

- JavaScript unit tests: 495 passed, including square-cell footprints, overlaps,
  deterministic packing and matched image/crop transforms without a clipping mask.
- Focused Chromium tests: normal motion, reduced motion, four-column phone layout,
  opening reversal and deliberately stalled originals passed. The stalled original
  test verifies a visible poster and working zoom before releasing the file.
- A full Gallery normal-motion browser run passed before the final poster-gesture
  refinement; final full/static/build checks are recorded after completion.
- Physical Android frame pacing and visual quality are not measured here; the
  user's phone is still the required check for WebView-specific rendering.

Source changes do not alter search, AI indexes, originals, cloud uploads or signing
identity. Install the update over Atlas rather than uninstalling it.
