export const iconApps = [
  { id: "atlas", name: "Atlas", glyph: "M28 79L50 24L72 79M35 63Q50 71 65 63M25 65Q50 58 75 65" },
  { id: "gallery", name: "Atlas Gallery", glyph: "M27 28H73V73H27ZM29 68L43 49L56 62L65 53L72 66M60 40H61" },
  { id: "music", name: "Atlas Music", glyph: "M43 68V34L72 27V61M43 45L72 38M43 68C43 78 26 81 26 72C26 64 43 60 43 68M72 61C72 71 55 74 55 65C55 57 72 53 72 61" },
  { id: "finance", name: "Atlas Finance", glyph: "M25 34H74V73H25ZM26 34L64 24M61 48H77V61H61ZM67 54H68" },
  { id: "trips", name: "Atlas Trips", glyph: "M50 22A28 28 0 1 0 50 78A28 28 0 1 0 50 22M60 39L54 55L38 61L44 45Z" },
  { id: "video", name: "Atlas Video", glyph: "M28 28H73V73H28ZM44 40L61 50L44 61Z" },
] as const;
export type IconModule = typeof iconApps[number]["id"];
export const iconColors = ["#285449", "#20252b", "#31476c", "#735582", "#a44d37", "#b68b44"];
export type IconStyle = "solid" | "light" | "outline";
export type IconShape = "rounded" | "circle" | "square";
export interface IconDesign { module: IconModule; style: IconStyle; shape: IconShape; color: string; zoom: number; x: number; y: number; }
export const defaultDesign = (module: IconModule): IconDesign => ({ module, style: "solid", shape: "rounded", color: iconColors[0], zoom: 1, x: 0.5, y: 0.5 });
export function validIconLabel(value: string) {
  const label = value.trim();
  return [...label].length >= 1 && [...label].length <= 32 && !/[\p{Cc}\p{Cf}]/u.test(label);
}
export function cropRegion(width: number, height: number, zoom: number, x: number, y: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw Error("This image has no usable dimensions.");
  const size = Math.min(width, height) / Math.max(1, Math.min(3, Number.isFinite(zoom) ? zoom : 1));
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
  return { sx: (width - size) * clamp(x), sy: (height - size) * clamp(y), size };
}

/** Local 512px derivative only. Canvas output omits the original photo's EXIF. */
export function drawIcon(canvas: HTMLCanvasElement, design: IconDesign, photo?: CanvasImageSource & { width: number; height: number }) {
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Icon preview is unavailable.");
  ctx.clearRect(0, 0, 512, 512);
  ctx.save();
  ctx.beginPath();
  if (design.shape === "circle") ctx.arc(256, 256, 256, 0, Math.PI * 2);
  else if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, 512, 512, design.shape === "rounded" ? 112 : 0);
  else ctx.rect(0, 0, 512, 512);
  ctx.clip();
  ctx.fillStyle = design.style === "solid" ? design.color : "#f6f6f0";
  ctx.fillRect(0, 0, 512, 512);
  if (photo) {
    const crop = cropRegion(photo.width, photo.height, design.zoom, design.x, design.y);
    ctx.drawImage(photo, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 512, 512);
  } else {
    ctx.scale(5.12, 5.12);
    ctx.lineWidth = design.style === "outline" ? 2.2 : 4.5;
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.strokeStyle = design.style === "solid" ? "#ffffff" : design.color;
    ctx.stroke(new Path2D(iconApps.find((app) => app.id === design.module)!.glyph));
    if (design.style === "outline") { ctx.lineWidth = 1; ctx.strokeRect(15, 15, 70, 70); }
  }
  ctx.restore();
}
