"use client";
import { useEffect, useRef, useState } from "react";
import { formatPaise } from "@/lib/finance/domain/money";

export default function AnimatedMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    const start = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / 650);
      setShown(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-label={formatPaise(value)}><span aria-hidden="true">{formatPaise(shown)}</span></span>;
}
