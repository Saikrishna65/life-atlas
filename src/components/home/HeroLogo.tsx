import Image from "next/image";

/** A white-ink knockout preserves the supplied mark while removing its dark stroke. */
export default function HeroLogo() {
  return (
    <>
      <svg className="atlas-logo-filter" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="atlas-white-ink" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .3333 .3333 .3333 0 0" result="ink" />
            <feComposite in="ink" in2="SourceAlpha" operator="in" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="4" intercept="-2.5" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <Image
        className="atlas-white-ink"
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
