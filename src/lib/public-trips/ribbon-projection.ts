/** Approved original sizes/tilt with independently tightened horizontal gaps. */
export function projectRibbonFrame(position: number, width: number) {
  const mobile = width < 700;
  const stride = width / (mobile ? 3.8 : 7.3);
  const normal = position * stride / (width / 2);
  const bend = Math.min(1.3, Math.abs(normal));
  return {
    x: position * stride * (1 + .15 * normal * normal) * (mobile ? .98 : .95),
    angle: -normal * 32,
    scale: .88 + .64 * bend * bend,
  };
}
