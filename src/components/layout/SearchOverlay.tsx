"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Command } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  url: string;
  excerpt?: string;
  image?: string | null;
  date?: string | null;
  location?: string | null;
}

export default function SearchOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "/" && !isOpen && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomEvent = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-search", handleCustomEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-search", handleCustomEvent);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
      setTimeout(() => {
        setQuery("");
        setResults([]);
      }, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setTimeout(() => setResults([]), 0);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      router.push(results[selectedIndex].url);
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-background/80 backdrop-blur-md px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search Overlay"
    >
      <div className="w-full max-w-2xl bg-muted/20 border border-muted/30 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        
        <div className="flex items-center px-6 py-4 border-b border-muted/30 gap-4">
          <Search size={20} className="text-muted-foreground" aria-hidden="true" />
          <input 
            ref={inputRef}
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search trips, places, journal, photos..."
            className="flex-1 bg-transparent border-none outline-none font-sans text-lg text-foreground placeholder:text-muted-foreground"
            aria-label="Search query"
          />
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground font-sans text-sm">Searching...</div>
          ) : results.length > 0 ? (
            results.map((result, idx) => (
              <Link 
                key={result.id + result.type} 
                href={result.url}
                onClick={() => setIsOpen(false)}
                className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${idx === selectedIndex ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
              >
                {result.image ? (
                  <div className="w-12 h-12 flex-shrink-0 bg-muted rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.image} alt={result.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 flex-shrink-0 bg-muted/50 rounded flex items-center justify-center">
                    <Search size={16} className="text-muted-foreground/50" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="font-display text-lg text-foreground truncate">{result.title}</h4>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">{result.type}</span>
                  </div>
                  {(result.location || result.excerpt) && (
                    <p className="font-sans text-xs text-muted-foreground mt-1 truncate">
                      {result.location || result.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            ))
          ) : query.length >= 2 ? (
            <div className="p-8 text-center text-muted-foreground font-sans text-sm">No results found for &quot;{query}&quot;</div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center gap-4 text-muted-foreground/50">
              <Command size={48} strokeWidth={1} />
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] mt-2">Start typing to search the atlas</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
