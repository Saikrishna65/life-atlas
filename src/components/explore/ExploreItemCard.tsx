import Link from "next/link";
import Image from "next/image";
import { ExploreItem } from "@/lib/queries/explore";

export default function ExploreItemCard({ item }: { item: ExploreItem }) {
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  
  return (
    <article className="group flex flex-col md:flex-row gap-6 items-start border-b border-muted/20 pb-8 last:border-0 last:pb-0">
      {item.image && (
        <div className="w-full md:w-48 aspect-video md:aspect-square bg-muted/10 overflow-hidden flex-shrink-0 rounded-sm relative">
          <Link href={item.url}>
            <Image
              src={item.image} 
              alt={item.title} 
              fill
              className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
              sizes="(max-width: 768px) 100vw, 12rem"
            />
          </Link>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-accent/80">{item.category}</span>
          {dateStr && (
            <>
              <span className="w-2 h-[1px] bg-muted/50" />
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{dateStr}</span>
            </>
          )}
          {item.location && (
            <>
              <span className="w-2 h-[1px] bg-muted/50" />
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.location}</span>
            </>
          )}
        </div>
        
        <Link href={item.url}>
          <h3 className="font-display text-2xl md:text-3xl text-foreground group-hover:text-accent transition-colors leading-tight mt-1">
            {item.title}
          </h3>
        </Link>
        
        {item.description && (
          <p className="font-body text-base text-muted-foreground line-clamp-2 mt-2 font-light">
            {item.description}
          </p>
        )}
      </div>
    </article>
  );
}
