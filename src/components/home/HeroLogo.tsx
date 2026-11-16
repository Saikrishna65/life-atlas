"use client";
import Image from "next/image";
import { useId } from "react";

/** Preserve the supplied mark without its dark stroke; tint only on light surfaces. */
export default function HeroLogo() {
  const filterId = useId();
  return (
    <>
      <svg className="atlas-logo-filter" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .3333 .3333 .3333 0 0" result="ink" />
            <feComposite in="ink" in2="SourceAlpha" operator="in" />
            <feComponentTransfer result="mark">
              <feFuncA type="linear" slope="4" intercept="-2.5" />
            </feComponentTransfer>
            <feFlood floodColor="var(--atlas-logo-ink, #fff)" result="colour" />
            <feComposite in="colour" in2="mark" operator="in" />
          </filter>
        </defs>
      </svg>
      <Image
        className="atlas-white-ink"
        style={{ filter: `url(#${filterId})` }}
        src="/brand/life-atlas-white.png"
        width={96}
        height={64}
        sizes="96px"
        alt=""
        priority
      />
    </>
  );
}
