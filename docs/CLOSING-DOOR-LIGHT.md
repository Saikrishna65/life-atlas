# Closing door: aperture-driven lighting

The ending begins on the shared paper canvas. One component-owned ScrollTrigger
now controls the door leaf, frame approach, light aperture, floor beam and room
shadow. WorldMotion's former independent door tweens have been removed.

The visible opening is computed continuously from the leaf's projected area:
(1 - cos(angle)) / (1 - cos(72 degrees)). Its complement drives room darkness.
A narrowing warm beam moves toward the remaining opening; glow and floor light
fade with the aperture. No background class or colour is swapped at a threshold.
Text colours interpolate toward light ink, while the primary button remains a
readable fixed dark surface. All effects are scoped to the ending section.

The existing Lenis/ScrollTrigger integration is reused; no new scroll listeners,
render loops or GPU contexts are added. Scrolling back restores the light. Motion
contexts and timelines clean up on unmount. Reduced motion keeps a static light
ending with a closed door and the same working controls.

Browser evidence at work/qa-door-light checks five scroll positions, the matched
light/dark values, reverse scrolling, isolation from other sections, mobile,
reduced motion, overflow and runtime errors.

## Full-viewport finale

The ending now has a 100dvh sticky room inside a short 165svh scroll passage.
Closure starts exactly when the section top reaches 50% of the viewport; the
extra passage lets the viewer experience the close with the room fully framed.
At the page end the room covers the viewport, so the previous archive cannot
remain visible above it. Reduced motion uses a single static viewport instead.

Adaptive door/copy proportions keep controls in view on short mobile screens.
A recessed jamb, subtle timber surface and floor/contact shadows add depth to
the existing aperture-driven lighting without assets, audio or a new renderer.

### Door occlusion correction

The illuminated aperture and floor beam now share the projected right edge of the
hinged panel, including the frame's 1000px perspective. The beam begins only at
that opening and projects to the right; the foreground panel occludes it. Removed
the whole-frame glow that also illuminated the opaque leaf. A ResizeObserver
updates the cached door width on viewport changes, with no layout reads during
scroll updates. Browser checks compare the rendered panel edge with both light
origins at five closure positions across four viewport sizes.
