"use client";
import { useEffect, useRef } from "react";
import { ArrowUpLeft, Search } from "lucide-react";
interface Props { id: string; items: string[]; active: number; onActive(index: number): void; onChoose(value: string): void; onFill(value: string): void; }
export default function SearchSuggestions({ id, items, active, onActive, onChoose, onFill }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scroll.current;
    if (!container || active < 0) return;
    const top = active * 44, bottom = top + 44;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
  }, [active]);
  return <div className="video-completion-panel">
    <div className="video-completion-scroll" ref={scroll}>
      <div className="video-completion-content">
        <div role="listbox" id={id} aria-label="Search suggestions">
          {items.map((text, index) => <div key={text} id={`${id}-${index}`} role="option" aria-selected={active === index} aria-label={text}
            className="video-completion-option" onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(text)} onPointerMove={() => { if (active !== index) onActive(index); }}>
            <Search size={16} aria-hidden="true"/><span>{text}</span>
          </div>)}
        </div>
        <div className="video-completion-fills" role="group" aria-label="Fill the search bar">
          {items.map((text) => <button key={text} type="button" tabIndex={-1} aria-label={`Fill search with ${text}`} title="Fill search bar"
            onMouseDown={(event) => event.preventDefault()} onClick={() => onFill(text)}><ArrowUpLeft size={19}/></button>)}
        </div>
      </div>
    </div>
    <div className="video-completion-source">Suggestions from YouTube</div>
  </div>;
}
