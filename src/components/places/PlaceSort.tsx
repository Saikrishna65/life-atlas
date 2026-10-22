"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";

export default function PlaceSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "name";

  const handleSortChange = (e: { target: { value: string } }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground shrink-0">
        Sort by
      </span>
      <Select
        id="sort"
        value={currentSort}
        onChange={handleSortChange}
        className="text-xs font-sans py-1.5 px-3 min-w-[130px]"
        containerClassName="inline-block"
      >
        <option value="name">Name</option>
        <option value="latest">Recently Added</option>
        <option value="oldest">Oldest Added</option>
      </Select>
    </div>
  );
}
