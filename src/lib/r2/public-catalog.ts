import type {
  MediaPlacement,
  PublicMediaCatalog,
  PublishedMedia,
} from "./types";
const placements = new Set<MediaPlacement>([
  "destination",
  "expedition",
  "gallery",
  "memory",
  "cinematic",
  "music-artwork",
  "atlas-visual",
]);
const mimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
export const PUBLIC_CATALOG_STORAGE = "atlas-public-catalog-source-v1";
/** Public address only: never accept a presigned credential-bearing URL or send this through a server proxy. */
export function publicCatalogSource(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    !url.pathname.endsWith("/atlas/catalog/current.json") ||
    url.hostname === "localhost" ||
    /(^[\d.]+$|:|\.(localhost|local|internal)$)/.test(url.hostname) ||
    url.hostname.endsWith(".r2.cloudflarestorage.com")
  )
    throw new Error("Invalid public catalog URL");
  return url.href;
}
export function validatePublicCatalog(
  value: unknown,
  source: string,
): PublicMediaCatalog {
  const address = publicCatalogSource(source),
    base = address.slice(0, -"/atlas/catalog/current.json".length);
  const input = value as Partial<PublicMediaCatalog> | null;
  if (
    !input ||
    input.format !== "life-atlas-public-media" ||
    input.version !== 1 ||
    typeof input.revision !== "string" ||
    input.revision.length > 100 ||
    !Number.isFinite(Date.parse(String(input.updatedAt))) ||
    !Array.isArray(input.items) ||
    input.items.length > 5000
  )
    throw new Error("Unsupported public catalog");
  const ids = new Set<string>();
  const text = (value: unknown, max: number, nonempty = false) =>
    typeof value === "string" &&
    value.length <= max &&
    (!nonempty || value.trim().length > 0);
  const items: PublishedMedia[] = input.items.map((item) => {
    if (
      !item ||
      !text(item.id, 80, true) ||
      !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
      ids.has(item.id) ||
      !text(item.key, 1000, true) ||
      item.key.startsWith("encrypted/") ||
      item.key
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            /[\\\u0000-\u001f]/.test(part),
        ) ||
      !text(item.title, 140, true) ||
      !text(item.description, 2000) ||
      !text(item.collection, 140) ||
      !placements.has(item.category) ||
      !mimes.has(item.mimeType) ||
      !Number.isSafeInteger(item.size) ||
      item.size < 0 ||
      item.size > 5 * 1024 ** 4 ||
      !Number.isFinite(Date.parse(item.publishedAt)) ||
      !["removed", "retained"].includes(item.metadataPolicy) ||
      !Array.isArray(item.tags) ||
      item.tags.length > 16 ||
      item.tags.some((tag) => !text(tag, 60, true))
    )
      throw new Error("Invalid public media record");
    const expected = `${base}/${item.key.split("/").map(encodeURIComponent).join("/")}`;
    if (item.url !== expected)
      throw new Error("Media URL does not belong to this public catalog");
    if (item.thumbnailUrl) {
      const thumb = new URL(item.thumbnailUrl);
      if (
        !item.thumbnailUrl.startsWith(`${base}/galleries/previews/`) ||
        thumb.search ||
        thumb.hash ||
        thumb.username ||
        thumb.password ||
        /(?:^|\/)\.\.(?:\/|$)/.test(decodeURIComponent(thumb.pathname)) ||
        !/\.(jpe?g|png|webp)$/i.test(thumb.pathname)
      )
        throw new Error("Invalid preview URL");
    }
    ids.add(item.id);
    return {
      id: item.id,
      key: item.key,
      url: item.url,
      title: item.title,
      description: item.description,
      collection: item.collection,
      category: item.category,
      mimeType: item.mimeType,
      size: item.size,
      publishedAt: item.publishedAt,
      tags: [...item.tags],
      metadataPolicy: item.metadataPolicy,
      ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
    };
  });
  return {
    format: "life-atlas-public-media",
    version: 1,
    revision: input.revision,
    updatedAt: String(input.updatedAt),
    items,
  };
}
export async function readPublicCatalog(
  source: string,
  signal: AbortSignal,
): Promise<PublicMediaCatalog> {
  const address = publicCatalogSource(source);
  const response = await fetch(address, {
    signal,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    cache: "no-cache",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("Public catalog unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Catalog stream unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Public catalog too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return validatePublicCatalog(
    JSON.parse(new TextDecoder().decode(data)),
    address,
  );
}
