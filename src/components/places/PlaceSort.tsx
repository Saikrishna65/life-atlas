"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PlaceSortOption } from "@/lib/queries/places";

export default function PlaceSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "name";

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
        <option value="name" className="bg-background text-white">Name</option>
        <option value="latest" className="bg-background text-white">Recently Added</option>
        <option value="oldest" className="bg-background text-white">Oldest Added</option>
      </select>
    </div>
  );
}
