import type { PhotoRecipe } from "./media-tools";
/** Fit a rotated crop entirely inside the source. Panning never reveals empty corners. */
export function editGeometry(
  width: number,
  height: number,
  recipe: PhotoRecipe,
) {
  const angle = (recipe.angle * Math.PI) / 180,
    c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const turned = Math.abs(Math.round(recipe.angle / 90)) % 2 === 1;
  const aspect = recipe.aspect || (turned ? height / width : width / height);
  const cropHeight =
      Math.min(width / (aspect * c + s), height / (aspect * s + c)) /
      recipe.zoom,
    cropWidth = cropHeight * aspect;
  const dx =
      (recipe.x * 2 - 1) *
      Math.max(0, (width - cropWidth * c - cropHeight * s) / 2),
    dy =
      (recipe.y * 2 - 1) *
      Math.max(0, (height - cropWidth * s - cropHeight * c) / 2);
  return {
    cropWidth,
    cropHeight,
    centerX: width / 2 + dx,
    centerY: height / 2 + dy,
    angle,
    aspect,
  };
}
