/** Vector rendering of the supplied Atlas mark, without raster shading or filters. */
export default function HeroLogo() {
  return (
    <svg
      className="atlas-mark"
      width="96"
      height="64"
      viewBox="0 0 1536 1024"
      fill="var(--atlas-logo-ink, #fff)"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M767 77 443 666C353 662 265 678 194 706 434 668 645 718 766 901 894 718 1110 668 1338 706 1268 678 1179 662 1088 666ZM767 398 609 687C671 706 726 739 766 777 807 739 862 706 923 687Z"
      />
      <path d="m422 714-131 235h180l96-180c-53-27-101-44-145-55Zm689 0 131 235h-180l-96-180c53-27 101-44 145-55Z" />
    </svg>
  );
}
