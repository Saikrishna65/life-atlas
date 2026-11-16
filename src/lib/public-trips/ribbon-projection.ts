/** A bounded, gradual envelope: no accelerating height jump at the corners. */
export function projectRibbonFrame(position: number, width: number) {
  const mobile = width < 700;
  const stride = width / (mobile ? 4.2 : 8);
  const normal = position * stride / (width / 2);
  const squared = normal * normal;
  return {
    x: position * stride * (1 + .1 * squared),
    angle: -normal * 28,
    scale: .94 + (mobile ? .45 : .75) * squared / (.8 + squared),
  };
}
