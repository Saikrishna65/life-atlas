"use client";
import { LoaderCircle } from "lucide-react";
interface Props { hasMore: boolean; loading: boolean; error: string; attachSentinel(element: HTMLDivElement | null): void; onLoad(retry?: boolean): Promise<void>; }
export default function PaginationFooter({ hasMore, loading, error, attachSentinel, onLoad }: Props) {
  if (!hasMore && !error) return null;
  return <div className="video-pagination" ref={attachSentinel}>
    {loading ? <p role="status"><LoaderCircle size={16}/>Loading more videos…</p> : error
      ? <><p role="alert">{error}</p><button onClick={() => void onLoad(true)}>Retry loading videos</button></>
      : <button onClick={() => void onLoad()}>Load more videos</button>}
  </div>;
}
