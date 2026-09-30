"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const CATEGORIES = ["All", "Travel", "Food", "Cinema", "Events", "Photography", "Journal", "Memories", "Places"];

export default function ExploreFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentCategory = searchParams.get("category") || "All";
  const currentYear = searchParams.get("year") || "";
  const currentCountry = searchParams.get("country") || "";

  const [year, setYear] = useState(currentYear);
  const [country, setCountry] = useState(currentCountry);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "All") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (year) params.set("year", year);
    else params.delete("year");
    
    if (country) params.set("country", country);
    else params.delete("country");
    
    router.push(`/explore?${params.toString()}`);
  };

  const handleCategoryClick = (cat: string) => {
    router.push(`/explore?${createQueryString("category", cat)}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 mb-16 border-b border-muted/20 pb-12">
      <div className="flex-1">
        <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-4">Categories</span>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`font-sans text-[10px] md:text-xs uppercase tracking-widest px-4 py-2 rounded-sm transition-colors ${
                currentCategory === cat 
                  ? "bg-foreground text-background" 
                  : "bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      <div className="md:w-1/3 flex flex-col gap-4">
        <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">Filters</span>
        <div className="flex gap-4">
          <input 
            type="number" 
            placeholder="Year" 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-1/2 bg-transparent border-b border-muted/30 focus:border-foreground pb-2 font-sans text-sm text-foreground outline-none transition-colors"
          />
          <input 
            type="text" 
            placeholder="Country" 
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-1/2 bg-transparent border-b border-muted/30 focus:border-foreground pb-2 font-sans text-sm text-foreground outline-none transition-colors"
          />
        </div>
        <button 
          onClick={applyFilters}
          className="mt-2 text-left font-sans text-xs uppercase tracking-[0.1em] text-accent hover:text-accent/80 transition-colors w-fit"
        >
          Apply Filters &rarr;
        </button>
      </div>
    </div>
  );
}
