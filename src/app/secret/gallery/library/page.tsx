"use client";
import dynamic from "next/dynamic";
const LibraryHub = dynamic(() => import("@/components/gallery/LibraryHub"), {
  ssr: false,
  loading: () => <p role="status">Opening photo library tools…</p>,
});
export default function Page() {
  return <LibraryHub />;
}
