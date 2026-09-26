"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TripSortOption } from "@/lib/queries/trips";

export default function TripSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "latest";

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="sort" className="font-sans text-xs uppercase tracking-widest text-white/50">
        Sort by
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={handleSortChange}
        className="bg-transparent border-b border-white/20 text-white font-sans text-sm pb-1 focus:outline-none focus:border-white transition-colors cursor-pointer"
      >
        <option value="latest" className="bg-background text-white">Latest</option>
        <option value="oldest" className="bg-background text-white">Oldest</option>
        <option value="longest" className="bg-background text-white">Longest</option>
        <option value="most-photos" className="bg-background text-white">Most Photographs</option>
      </select>
    </div>
  );
}
